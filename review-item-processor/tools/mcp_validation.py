"""
MCP ツール実行（stdio / HTTP）の入力検証。

backend/src/api/features/tool-configuration/domain/service/mcp-validation.ts の
ルールを「同一」にミラーする。TS 側を単一の真実源とし、本ファイルは
同じ allowlist / メタ文字集合 / 予約環境変数集合 / SSRF 判定ロジックを Python で再現する。

- stdio: 実行ファイルを allowlist（uvx / npx）に限定、command/args のシェル
  メタ文字を拒否。os.environ を無条件に渡さず（既存の SDK 既定 env を維持）、
  config.env の予約キーを拒否。
- http: 接続先 URL のスキーム・ホスト（リンクローカル/ループバック/プライベート/予約）を
  検証して SSRF を防ぐ。解決失敗・検証不能時は拒否（フェイルクローズ）。

検証違反は ValueError を送出する。呼び出し側（mcp_tool.create_mcp_clients）は ValueError を
per-server のユーザー修正可能エラーとして捕捉し、当該サーバーをスキップする（フェイルクローズ）。
"""

import ipaddress
import re
import socket
from typing import Any, Dict, List, Tuple
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx

# stdio で起動を許可する実行ファイル（basename のみ）。TS 側 ALLOWED_MCP_COMMANDS と一致。
ALLOWED_MCP_COMMANDS = ["uvx", "npx"]

# command / args に出現を禁止するシェルメタ文字・制御文字（TS 側 SHELL_METACHAR_RE と一致）。
_SHELL_METACHAR_RE = re.compile(r"""[;&|`$(){}<>\n\r\t*?!\\"' ]""")

# config.env で設定を禁止する予約環境変数。TS 側 RESERVED_ENV_KEYS と一致。
# UV_CACHE_DIR/UV_TOOL_DIR/NPM_CONFIG_CACHE/NPM_CONFIG_PREFIX は下記の
# UV_/NPM_CONFIG_ プレフィックスでも一括カバーされるが、可読性のため残す。
RESERVED_ENV_KEYS = {
    "PATH",
    "LD_PRELOAD",
    "LD_LIBRARY_PATH",
    "NODE_OPTIONS",
    "PYTHONPATH",
    "PYTHONSTARTUP",
    "BASH_ENV",
    "ENV",
    "IFS",
    # HOME をユーザー入力で上書きさせない。
    # HOME を攻撃者制御ディレクトリに向けると uvx/npx やその子プロセス (pip/git) の設定ファイル
    # 探索先（~/.npmrc, ~/.config/uv, ~/.gitconfig 等）を差し替えられる。TS 側 RESERVED_ENV_KEYS
    # と同期。build_minimal_mcp_env の base_env がシステム値で固定する。
    "HOME",
    "UV_CACHE_DIR",
    "UV_TOOL_DIR",
    "NPM_CONFIG_CACHE",
    "NPM_CONFIG_PREFIX",
    # パッケージ DL の MitM を塞ぐ。
    # TS 側 RESERVED_ENV_KEYS と同一キー集合で同期させること。プロキシ / CA 信頼 /
    # TLS 検証無効化系を子プロセス(uvx/npx 及び pip/git)へ渡させない。npm/pip/uv 固有キーは
    # 既存の NPM_CONFIG_ / PIP_ / UV_ プレフィックスでカバー済みのため、ここでは
    # プレフィックスを持たない汎用・Node・Python・curl・OpenSSL・git 系のみを列挙する。
    # 小文字 http_proxy 等も _is_reserved_env_key の upper 比較で一致する。
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "FTP_PROXY",
    "NODE_EXTRA_CA_CERTS",
    "NODE_TLS_REJECT_UNAUTHORIZED",
    "REQUESTS_CA_BUNDLE",
    "CURL_CA_BUNDLE",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "GIT_SSL_CAINFO",
    "GIT_SSL_NO_VERIFY",
    "GIT_PROXY_COMMAND",
}

# パッケージレジストリ/インデックスの上書き系
# 環境変数（UV_INDEX_URL / UV_DEFAULT_INDEX / PIP_INDEX_URL / NPM_CONFIG_REGISTRY 等）を
# プレフィックスで一括拒否する。これらは uvx/npx(+pip) のパッケージ解決先を攻撃者制御
# レジストリへ向け、悪意パッケージ実行（RCE）に至るため。_is_reserved_env_key は upper
# 比較なので小文字 npm_config_registry / uv_index_url も一致する。TS 側
# RESERVED_ENV_PREFIXES と単一真実源で同期させること。
_RESERVED_ENV_PREFIXES = ("DYLD_", "LD_", "UV_", "PIP_", "NPM_CONFIG_")

_ALLOWED_URL_SCHEMES = ("http", "https")


def _is_reserved_env_key(key: str) -> bool:
    upper = key.upper()
    if upper in RESERVED_ENV_KEYS:
        return True
    return any(upper.startswith(p) for p in _RESERVED_ENV_PREFIXES)


def assert_allowed_mcp_command(command: str) -> None:
    """実行ファイル名 (command) を検証する。"""
    if not isinstance(command, str) or not command:
        raise ValueError("MCP command must be a non-empty string")
    if "/" in command or "\\" in command or _SHELL_METACHAR_RE.search(command):
        raise ValueError(
            f"MCP command must be a bare executable name without path "
            f"separators or shell metacharacters: {command}"
        )
    if command not in ALLOWED_MCP_COMMANDS:
        raise ValueError(
            f"MCP command not allowed: {command}. "
            f"Allowed: {', '.join(ALLOWED_MCP_COMMANDS)}"
        )


def assert_safe_mcp_args(args: Any) -> None:
    """args（配列）を検証する。各要素は文字列でシェルメタ文字を含まないこと。"""
    if not isinstance(args, list):
        raise ValueError("MCP args must be a list of strings")
    for arg in args:
        if not isinstance(arg, str):
            raise ValueError("MCP args must all be strings")
        if _SHELL_METACHAR_RE.search(arg):
            raise ValueError(
                f"MCP arg contains disallowed shell metacharacters: {arg}"
            )


def sanitize_mcp_env(env: Any) -> Dict[str, str]:
    """config.env から予約キーを除いた安全なエントリのみを返す。予約キーは拒否。"""
    if env is None:
        return {}
    if not isinstance(env, dict):
        raise ValueError("MCP env must be a mapping of string to string")
    safe: Dict[str, str] = {}
    for key, value in env.items():
        if _is_reserved_env_key(str(key)):
            raise ValueError(
                f"MCP env must not set reserved environment variable: {key}"
            )
        if not isinstance(value, str):
            raise ValueError(f"MCP env value for {key} must be a string")
        safe[str(key)] = value
    return safe


def validate_stdio_config(config: Dict[str, Any]) -> Dict[str, str]:
    """stdio 設定 (command / args / env) を一括検証する。

    検証を通過した安全な env（予約キー除外済み）を返す。
    """
    command = config.get("command", "uvx")
    assert_allowed_mcp_command(command)
    assert_safe_mcp_args(config.get("args", []))
    return sanitize_mcp_env(config.get("env"))


# CGNAT 共有アドレス空間 100.64.0.0/10（RFC 6598）。
# Python 3.13 の ipaddress.is_private は CGNAT を
# 含まないため（TS 実装 isBlockedIpv4Octets は 100.64-127 を明示ブロック）、ここで
# 明示的に判定して TS と網羅性を揃える。クラウド内部サービス（VPC エンドポイント・
# 内部 LB 等）が CGNAT を使う環境への SSRF を防ぐ。
_CGNAT_NETWORK = ipaddress.IPv4Network("100.64.0.0/10")


def _classify_blocked(addr) -> bool:
    """ipaddress オブジェクトに対する内部/危険レンジ判定。"""
    if (
        addr.is_loopback
        or addr.is_link_local  # 169.254.0.0/16, fe80::/10（IMDS を含む）
        or addr.is_private  # 10/8, 172.16/12, 192.168/16, fc00::/7
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
    ):
        return True
    # CGNAT 100.64.0.0/10 を明示ブロック（TS の isBlockedIpv4Octets と一致）。
    if isinstance(addr, ipaddress.IPv4Address) and addr in _CGNAT_NETWORK:
        return True
    return False


def _is_blocked_ip(ip: str) -> bool:
    """内部 / 危険な IP かどうかを判定する。TS 側 isBlockedIp と一致。

    IPv4-mapped に加え、6to4 (2002::/16) と
    NAT64 well-known (64:ff9b::/96) の埋め込み IPv4 も取り出して再帰判定し、TS と網羅性を揃える。
    """
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        # IP として解釈できない値は安全側で拒否（フェイルクローズ）。
        return True

    if isinstance(addr, ipaddress.IPv6Address):
        # IPv4-mapped ::ffff:0:0/96
        if addr.ipv4_mapped:
            return _classify_blocked(addr.ipv4_mapped)
        # 6to4 2002::/16
        if addr.sixtofour:
            return _classify_blocked(addr.sixtofour)
        # NAT64 well-known 64:ff9b::/96 → 末尾 32bit を IPv4 として判定
        if addr in ipaddress.IPv6Network("64:ff9b::/96"):
            embedded = ipaddress.IPv4Address(int(addr) & 0xFFFFFFFF)
            return _classify_blocked(embedded)

    return _classify_blocked(addr)


def resolve_and_validate_mcp_url(raw_url: str) -> Tuple[str, List[str]]:
    """MCP HTTP トランスポートの接続先 URL を検証し、(hostname, 安全なIPリスト) を返す。

    MCP HTTP は「検証→接続」の2段階で、両者が独立に
    DNS を解決するため TOCTOU(DNS rebinding)が成立しうる（検証時に解決した IP と接続時に
    解決される IP が異なり、169.254.169.254 等の内部へすり替えられる）。本関数は検証時に
    解決した『安全と確認できた IP』を呼び出し側へ返し、呼び出し側がその IP をピン留めして
    接続することで、解決先のすり替え窓を閉じる。

    - スキームが http/https 以外なら拒否。
    - ホストが localhost / 内部 IP リテラルなら拒否。
    - IP リテラル時は解決を伴わない（TOCTOU 無し）ため [hostname] を返す（挙動不変）。
    - ホスト名は DNS 解決し、解決された全 IP が内部レンジでないことを確認する。安全な IP
      のみを返す。解決不能・安全な IP ゼロ時は拒否（フェイルクローズ）。

    Returns:
        (hostname, safe_ips): hostname は小文字化したホスト。safe_ips は接続に使える
        安全な IP のリスト（IP リテラル時はその IP のみ）。
    """
    try:
        parsed = urlparse(raw_url)
    except Exception:
        raise ValueError(f"Invalid MCP URL: {raw_url}")

    if parsed.scheme not in _ALLOWED_URL_SCHEMES:
        raise ValueError(
            f"MCP URL scheme not allowed: {parsed.scheme} (only http/https)"
        )

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        raise ValueError(f"MCP URL has no host (fail-closed): {raw_url}")
    if hostname == "localhost" or hostname.endswith(".localhost"):
        raise ValueError("MCP URL must not target localhost")

    # ホストが IP リテラルならそのまま判定。
    try:
        ipaddress.ip_address(hostname)
        is_ip_literal = True
    except ValueError:
        is_ip_literal = False

    if is_ip_literal:
        if _is_blocked_ip(hostname):
            raise ValueError(
                f"MCP URL targets a blocked (internal/loopback/link-local) "
                f"address: {hostname}"
            )
        # IP リテラルは解決が無く TOCTOU 無し。そのまま接続先として返す。
        return hostname, [hostname]

    # ホスト名は DNS 解決して全 IP を検証する（解決不能ならフェイルクローズ）。
    try:
        infos = socket.getaddrinfo(hostname, None)
    except Exception:
        raise ValueError(
            f"MCP URL host could not be resolved (fail-closed): {hostname}"
        )
    addresses: List[str] = []
    for info in infos:
        sockaddr = info[4]
        if sockaddr and len(sockaddr) >= 1:
            addresses.append(sockaddr[0])
    if not addresses:
        raise ValueError(
            f"MCP URL host resolved to no addresses (fail-closed): {hostname}"
        )
    # 解決された全 IP が安全でなければ拒否する（従来挙動）。
    # 加えて、安全と確認できた IP のみを safe_ips として返し、接続時のピン留めに使う。
    safe_ips: List[str] = []
    for address in addresses:
        if _is_blocked_ip(address):
            raise ValueError(
                f"MCP URL host {hostname} resolves to a blocked address: {address}"
            )
        safe_ips.append(address)
    if not safe_ips:
        # 上の for で全件 raise されるため通常到達しないが、防御的にフェイルクローズ。
        raise ValueError(
            f"MCP URL host resolved to no safe addresses (fail-closed): {hostname}"
        )
    return hostname, safe_ips


def assert_safe_mcp_url(raw_url: str) -> None:
    """MCP HTTP トランスポートの接続先 URL を検証する。

    後方互換のための薄いラッパ。検証ロジックは resolve_and_validate_mcp_url に集約し、
    本関数は戻り値（安全な IP）を捨てて副作用（検証）のみを行う。既存の呼び出し側・
    既存テストの互換を維持する。
    """
    resolve_and_validate_mcp_url(raw_url)


def create_no_redirect_mcp_http_client(
    headers=None,
    timeout=None,
    auth=None,
):
    """MCP HTTP トランスポート用の httpx クライアント。
    mcp SDK 既定の create_mcp_http_client は follow_redirects=True を常時設定するため、
    接続前 URL 検証(assert_safe_mcp_url)を通過後に 3xx で内部(IMDS/VPC)へ誘導される
    SSRF が成立する。本ファクトリは follow_redirects=False を強制する(フェイルクローズ)。
    mcp の McpHttpClientFactory Protocol(headers/timeout/auth)と同一シグネチャ。
    """
    kwargs = {"follow_redirects": False}
    kwargs["timeout"] = timeout if timeout is not None else httpx.Timeout(30.0)
    if headers is not None:
        kwargs["headers"] = headers
    if auth is not None:
        kwargs["auth"] = auth
    return httpx.AsyncClient(**kwargs)


class _PinnedAsyncHTTPTransport(httpx.AsyncHTTPTransport):
    """検証済み IP へ接続先を固定する httpx トランスポート。

    MCP HTTP の「検証→接続」2段階は両者が独立に DNS 解決するため、検証通過後・接続前に
    攻撃者が DNS を rebind すると内部(IMDS 169.254.169.254 / VPC)へすり替えられる
    （TOCTOU / DNS rebinding）。本トランスポートは検証時に安全と確認した IP を接続先へ
    固定し、すり替え窓を閉じる。

    HTTPS の証明書検証を壊さないため、IP に直結しつつ TLS は元ホスト名で検証する:
      - request.url.host = pinned_ip      接続先を固定 IP に
      - Host ヘッダ       = original_host  仮想ホスト・サーバ側ルーティングを維持
      - extensions['sni_hostname'] = original_host  SNI と証明書検証を元ホスト名で実施
    """

    def __init__(self, pinned_ip: str, original_host: str, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._pinned_ip = pinned_ip
        self._original_host = original_host

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        # 接続先 IP を固定（元ホスト名は Host/SNI で維持）。
        request.url = request.url.copy_with(host=self._pinned_ip)
        # Host ヘッダを元ホスト名へ（IP 直結でも仮想ホストが解決されるように）。
        request.headers["Host"] = self._original_host
        # TLS の SNI と証明書検証を元ホスト名で行う（IP 直結でも証明書検証を維持）。
        request.extensions = dict(request.extensions or {})
        request.extensions["sni_hostname"] = self._original_host
        return await super().handle_async_request(request)


def create_pinned_mcp_http_client_factory(pinned_ip: str, original_host: str):
    """検証済み IP をピン留めする McpHttpClientFactory を返す。

    mcp の McpHttpClientFactory Protocol(headers/timeout/auth)と同一シグネチャの factory を返す。
    生成されるクライアントは:
      - follow_redirects=False を維持（リダイレクト無効化を併存）。
      - _PinnedAsyncHTTPTransport により接続先 IP を pinned_ip に固定（DNS rebinding 緩和）。
        TLS/SNI/Host は original_host を維持するため証明書検証は壊れない。
    """

    def factory(headers=None, timeout=None, auth=None) -> httpx.AsyncClient:
        transport = _PinnedAsyncHTTPTransport(
            pinned_ip=pinned_ip, original_host=original_host
        )
        kwargs: Dict[str, Any] = {
            "follow_redirects": False,
            "transport": transport,
        }
        kwargs["timeout"] = timeout if timeout is not None else httpx.Timeout(30.0)
        if headers is not None:
            kwargs["headers"] = headers
        if auth is not None:
            kwargs["auth"] = auth
        return httpx.AsyncClient(**kwargs)

    return factory


# ログ出力用に MCP サーバ設定の機微情報をマスクする。
# backend/.../tool-configuration.ts の maskToolConfiguration / maskUrlSecrets をミラー。
_REDACTED = "***REDACTED***"


def _mask_url_secrets(raw: str) -> str:
    """URL の userinfo・クエリ値をマスク。パース不能なら ? 以降を落とす（防御的）。"""
    try:
        parsed = urlparse(raw)
        netloc = parsed.hostname or ""
        if parsed.port:
            netloc = f"{netloc}:{parsed.port}"
        masked_query = ""
        if parsed.query:
            pairs = parse_qsl(parsed.query, keep_blank_values=True)
            masked_query = urlencode([(k, _REDACTED) for k, _ in pairs])
        return urlunparse((
            parsed.scheme, netloc, parsed.path,
            parsed.params, masked_query, parsed.fragment,
        ))
    except Exception:
        idx = raw.find("?")
        return raw[:idx] if idx >= 0 else raw


def mask_mcp_server_config(cfg: Any) -> Any:
    """単一 MCP サーバ設定のクローンを返し headers/env のキー値・args 各要素・url 秘密をマスク。
    形状が想定外でも例外を投げず可能な範囲でマスクして返す（防御的・ログ専用）。"""
    if not isinstance(cfg, dict):
        return cfg
    masked = dict(cfg)
    if isinstance(masked.get("headers"), dict):
        masked["headers"] = {k: _REDACTED for k in masked["headers"].keys()}
    if isinstance(masked.get("env"), dict):
        masked["env"] = {k: _REDACTED for k in masked["env"].keys()}
    if isinstance(masked.get("args"), list):
        masked["args"] = [_REDACTED for _ in masked["args"]]
    if isinstance(masked.get("url"), str) and masked["url"]:
        masked["url"] = _mask_url_secrets(masked["url"])
    return masked
