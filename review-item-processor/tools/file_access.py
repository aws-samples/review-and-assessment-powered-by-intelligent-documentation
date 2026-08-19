"""
file_read / image_reader ツールの
ローカルファイルインクルージョン(LFI)対策。

strands_tools の素の file_read / image_reader はパス束縛が無いため、プロンプト
インジェクション経由で /proc/self/environ や /etc/passwd 等の機微ファイルを LLM agent に
読ませることができる（image_reader は PIL が読める画像ファイルに限定されるが、それでも
許可外パスの読み取り＝LFI に該当する）。本モジュールは「許可ディレクトリ配下のファイルのみ」を
読める束縛版を生成するファクトリ create_bounded_file_read_tool /
create_bounded_image_reader_tool を提供し、agent.py がジョブ固有の作業ディレクトリ
（process_review_from_s3 が S3 から DL した temp_dir）に束縛して使用する。

設計方針:
- ツール名は必ず "file_read" / "image_reader" を維持する（プロンプトがツール名を参照する
  ため、名前を変えると LLM がツールを見つけられず審査が回帰する）。
- file_read の mode は安全な読み取り系のみ allowlist（view/lines/search/preview/stats）。
  find/document/diff/time_machine/chunk は拒否する（find は許可外ファイルの列挙、
  diff/time_machine は comparison_path / git 経由で許可外参照やコマンド実行に至りうるため）。
- パスは realpath 正規化し commonpath で許可ディレクトリ配下か判定する（prefix 文字列
  一致の罠を回避: /tmp/jobX と /tmp/jobXY を誤って配下扱いしない）。
- '..' / '~' / グロブメタ文字 (*?[) を含むパスは拒否（トラバーサル・ワイルドカード列挙を封鎖）。
- 許可ディレクトリ側・候補側の双方に realpath を適用する（/tmp -> /private/tmp の symlink 環境で
  正当なファイルを誤って拒否しないため）。
- image_reader は素の file_read のような複数パス（カンマ区切り）/ mode を持たず、単一の
  image_path のみを受ける。それ以外の検証（トラバーサル・グロブ・~ 展開・配下判定）は
  file_read と完全に同型にし、束縛ロジックを共有する（_resolve_within_allowed）。
"""

import os
from typing import Any, Dict, List

from logger import logger
from strands.tools import tool
from strands.types.tools import AgentTool
from strands_tools.file_read import file_read as _strands_file_read
from strands_tools.image_reader import image_reader as _strands_image_reader

# 安全な読み取り系モードのみ許可する。
# - find: ディレクトリ走査で許可外ファイルを列挙しうる
# - document: Bedrock document ブロック生成（許可外ファイルを埋め込みうる）
# - diff: comparison_path で許可外ファイルを読みうる
# - time_machine: git サブプロセスを起動しうる
# - chunk: バイトオフセット読み取りは本ユースケースで不要
_ALLOWED_MODES = {"view", "lines", "search", "preview", "stats"}

# パスに含まれていたら拒否するメタ文字（グロブ・ワイルドカード列挙の封鎖）。
_GLOB_METACHARS = ("*", "?", "[")


def _normalize_allowed_dirs(allowed_dirs: List[str]) -> List[str]:
    """許可ディレクトリを realpath 正規化する（symlink 解決込み）。

    空文字・None 等の不正要素は除外する（フェイルクローズ）。file_read /
    image_reader 双方の束縛ファクトリで共有する。
    """
    return [
        os.path.realpath(d)
        for d in (allowed_dirs or [])
        if isinstance(d, str) and d
    ]


def _is_within_allowed(candidate: str, allowed: List[str]) -> bool:
    """candidate（解決済み実パス）が許可ディレクトリのいずれかの配下か判定する。

    commonpath が base に一致 == real が base 配下（prefix 文字列一致の罠を回避:
    /tmp/jobX と /tmp/jobXY を誤って配下扱いしない）。
    """
    if not allowed:
        return False
    real = os.path.realpath(candidate)
    for base in allowed:
        try:
            if os.path.commonpath([real, base]) == base:
                return True
        except ValueError:
            # 異なるドライブ等で commonpath が失敗した場合は配下ではない扱い。
            continue
    return False


def _error(message: str) -> Dict[str, Any]:
    return {"status": "error", "content": [{"text": message}]}


def _has_disallowed_path_chars(path: str) -> bool:
    """トラバーサル('..')・ホーム展開('~')・グロブメタ文字(*?[)を含むか判定する。"""
    return ".." in path or "~" in path or any(m in path for m in _GLOB_METACHARS)


def create_bounded_file_read_tool(allowed_dirs: List[str]) -> AgentTool:
    """許可ディレクトリ配下のファイルのみ読める束縛版 file_read ツールを生成する。

    Args:
        allowed_dirs: 読み取りを許可するディレクトリの絶対パスのリスト。
            内部で realpath 正規化してクロージャに捕捉する。

    Returns:
        @tool でデコレートされた束縛版 file_read（ツール名は "file_read"）。
    """
    # 許可ディレクトリを realpath 正規化して捕捉する（symlink 解決込み）。
    _allowed = _normalize_allowed_dirs(allowed_dirs)

    @tool(
        name="file_read",
        description=(
            "Read the contents of attached review files. "
            "Access is restricted to the files provided for this review job. "
            "Supported modes: view, lines, search, preview, stats."
        ),
    )
    def file_read(path: str, mode: str = "view", **kwargs: Any) -> Dict[str, Any]:
        """Read attached review files (restricted to this job's files)."""
        try:
            if not isinstance(path, str) or not path:
                return _error("file_read error: 'path' must be a non-empty string")

            if mode not in _ALLOWED_MODES:
                # 汎用文言（許可外パスは含めない）。
                return _error(
                    f"file_read error: mode '{mode}' is not permitted. "
                    f"Allowed modes: {', '.join(sorted(_ALLOWED_MODES))}"
                )

            # トラバーサル・ホーム展開・グロブメタ文字を含むパスは拒否する。
            if _has_disallowed_path_chars(path):
                return _error(
                    "file_read error: path contains disallowed characters "
                    "('..', '~', or glob metacharacters)"
                )

            # 複数パス（カンマ区切り）を許容しつつ、各パスを許可判定する。
            raw_paths = [p.strip() for p in path.split(",") if p.strip()]
            if not raw_paths:
                return _error("file_read error: no valid path provided")

            resolved_paths = []
            for p in raw_paths:
                # 相対パスは allowed_dirs[0] 基準で解決する。
                if not os.path.isabs(p):
                    base = _allowed[0] if _allowed else os.getcwd()
                    p = os.path.join(base, p)
                resolved = os.path.realpath(p)
                if not _is_within_allowed(resolved, _allowed):
                    # 汎用文言（許可外の実パスは含めない＝情報漏洩を防ぐ）。
                    return _error(
                        "file_read error: access to the requested path is not permitted"
                    )
                resolved_paths.append(resolved)

            # 全パスが許可内 → 解決済み実パスで素の file_read（ToolUse dict 委譲）を呼ぶ。
            tool_input: Dict[str, Any] = dict(kwargs)
            tool_input["path"] = ",".join(resolved_paths)
            tool_input["mode"] = mode

            return _strands_file_read(
                {"toolUseId": "bounded-file-read", "input": tool_input}
            )

        except Exception as e:  # noqa: BLE001 - ツールは例外を握ってエラー返却する
            logger.error(f"bounded file_read failed: {e}")
            return _error(f"file_read error: {e}")

    logger.debug(
        f"Created bounded file_read tool restricted to {len(_allowed)} director(y/ies)"
    )
    return file_read


def create_bounded_image_reader_tool(allowed_dirs: List[str]) -> AgentTool:
    """許可ディレクトリ配下の画像のみ読める束縛版 image_reader ツールを生成する。

    素の strands_tools.image_reader は image_path を
    expanduser で ~ 展開し、存在すれば任意パスの画像を読み込むため LFI に至る
    （/proc/self/environ 等のテキストは PIL が弾くが、許可外ディレクトリの画像は読める）。
    create_bounded_file_read_tool と同型に、image_path を realpath+commonpath で
    allowed_dirs 配下に検証し、'..'/'~'/グロブメタ文字を拒否してから素の image_reader へ委譲する。

    Args:
        allowed_dirs: 読み取りを許可するディレクトリの絶対パスのリスト。
            内部で realpath 正規化してクロージャに捕捉する。

    Returns:
        @tool でデコレートされた束縛版 image_reader（ツール名は "image_reader"）。
    """
    # 許可ディレクトリを realpath 正規化して捕捉する（file_read と共有のヘルパ）。
    _allowed = _normalize_allowed_dirs(allowed_dirs)

    @tool(
        name="image_reader",
        description=(
            "Read an attached review image and return it for analysis via the "
            "Converse API. Access is restricted to the image files provided for "
            "this review job."
        ),
    )
    def image_reader(image_path: str, **kwargs: Any) -> Dict[str, Any]:
        """Read an attached review image (restricted to this job's files)."""
        try:
            if not isinstance(image_path, str) or not image_path:
                return _error(
                    "image_reader error: 'image_path' must be a non-empty string"
                )

            # トラバーサル・ホーム展開・グロブメタ文字を含むパスは拒否する
            # （素の image_reader は expanduser で ~ を展開してしまうため、ここで遮断する）。
            if _has_disallowed_path_chars(image_path):
                return _error(
                    "image_reader error: path contains disallowed characters "
                    "('..', '~', or glob metacharacters)"
                )

            # 単一パスのみ受ける（image_reader はカンマ区切り/mode を持たない）。
            candidate = image_path.strip()
            if not candidate:
                return _error("image_reader error: no valid path provided")

            # 相対パスは allowed_dirs[0] 基準で解決する（file_read と同一方針）。
            if not os.path.isabs(candidate):
                base = _allowed[0] if _allowed else os.getcwd()
                candidate = os.path.join(base, candidate)
            resolved = os.path.realpath(candidate)
            if not _is_within_allowed(resolved, _allowed):
                # 汎用文言（許可外の実パスは含めない＝情報漏洩を防ぐ）。
                return _error(
                    "image_reader error: access to the requested path is not permitted"
                )

            # 許可内 → 解決済み実パスで素の image_reader（ToolUse dict 委譲）を呼ぶ。
            tool_input: Dict[str, Any] = dict(kwargs)
            tool_input["image_path"] = resolved

            return _strands_image_reader(
                {"toolUseId": "bounded-image-reader", "input": tool_input}
            )

        except Exception as e:  # noqa: BLE001 - ツールは例外を握ってエラー返却する
            logger.error(f"bounded image_reader failed: {e}")
            return _error(f"image_reader error: {e}")

    logger.debug(
        f"Created bounded image_reader tool restricted to {len(_allowed)} director(y/ies)"
    )
    return image_reader
