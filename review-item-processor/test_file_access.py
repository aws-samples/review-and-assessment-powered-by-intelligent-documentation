#!/usr/bin/env python3
"""
束縛版 file_read / image_reader
（create_bounded_file_read_tool / create_bounded_image_reader_tool）の LFI 対策を
検証するユニットテスト。

許可ディレクトリ配下のファイルは読めるが、/etc/passwd・/proc/self/environ・トラバーサル・
グロブ・~ 展開・prefix confusion・symlink escape・許可外 mode は全て拒否されることを担保する。
AWS リソース非依存・ネットワーク非依存（tmp_path fixture のみ使用）。
"""
import os

import pytest

from tools.file_access import (
    create_bounded_file_read_tool,
    create_bounded_image_reader_tool,
)


def _make_tool(tmp_path):
    job_dir = tmp_path / "jobX"
    job_dir.mkdir()
    target = job_dir / "doc.txt"
    target.write_text("HELLO_DOCUMENT_CONTENT")
    tool = create_bounded_file_read_tool([str(job_dir)])
    return tool, job_dir, target


def test_reads_file_within_allowed_dir(tmp_path):
    tool, _job_dir, target = _make_tool(tmp_path)
    result = tool(path=str(target), mode="view")
    assert result["status"] == "success"
    # 内容が返ってくること。
    text = "".join(
        block.get("text", "") for block in result["content"] if isinstance(block, dict)
    )
    assert "HELLO_DOCUMENT_CONTENT" in text


def test_rejects_etc_passwd(tmp_path):
    tool, _job_dir, _target = _make_tool(tmp_path)
    result = tool(path="/etc/passwd", mode="view")
    assert result["status"] == "error"
    # 汎用文言で許可外パスを含めない（情報漏洩防止）。
    assert "/etc/passwd" not in str(result)


def test_rejects_proc_self_environ(tmp_path):
    tool, _job_dir, _target = _make_tool(tmp_path)
    result = tool(path="/proc/self/environ", mode="view")
    assert result["status"] == "error"


def test_rejects_parent_traversal(tmp_path):
    tool, job_dir, _target = _make_tool(tmp_path)
    # job_dir/../ で許可外へ抜けようとする。
    result = tool(path=os.path.join(str(job_dir), "..", "secret.txt"), mode="view")
    assert result["status"] == "error"


def test_rejects_glob_metacharacters(tmp_path):
    tool, job_dir, _target = _make_tool(tmp_path)
    result = tool(path=os.path.join(str(job_dir), "*.txt"), mode="view")
    assert result["status"] == "error"


def test_rejects_tilde_expansion(tmp_path):
    tool, _job_dir, _target = _make_tool(tmp_path)
    result = tool(path="~/.aws/credentials", mode="view")
    assert result["status"] == "error"


def test_rejects_prefix_confusion(tmp_path):
    # /tmp/jobX に束縛されている状態で /tmp/jobXY を読もうとしても拒否される
    # （prefix 文字列一致の罠を回避できていることの確認）。
    job_dir = tmp_path / "jobX"
    job_dir.mkdir()
    sibling = tmp_path / "jobXY"
    sibling.mkdir()
    secret = sibling / "secret.txt"
    secret.write_text("SHOULD_NOT_BE_READABLE")

    tool = create_bounded_file_read_tool([str(job_dir)])
    result = tool(path=str(secret), mode="view")
    assert result["status"] == "error"
    assert "SHOULD_NOT_BE_READABLE" not in str(result)


def test_rejects_symlink_escape(tmp_path):
    # 許可ディレクトリ内に許可外ファイルを指す symlink を置いても、realpath 解決で拒否される。
    job_dir = tmp_path / "jobX"
    job_dir.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("OUTSIDE_SECRET")
    link = job_dir / "link.txt"
    link.symlink_to(outside)

    tool = create_bounded_file_read_tool([str(job_dir)])
    result = tool(path=str(link), mode="view")
    assert result["status"] == "error"
    assert "OUTSIDE_SECRET" not in str(result)


def test_rejects_disallowed_mode_document(tmp_path):
    tool, _job_dir, target = _make_tool(tmp_path)
    # 許可内パスでも document mode は拒否される。
    result = tool(path=str(target), mode="document")
    assert result["status"] == "error"


def test_rejects_disallowed_mode_diff(tmp_path):
    tool, _job_dir, target = _make_tool(tmp_path)
    result = tool(path=str(target), mode="diff")
    assert result["status"] == "error"


def test_rejects_disallowed_mode_find(tmp_path):
    tool, job_dir, _target = _make_tool(tmp_path)
    result = tool(path=str(job_dir), mode="find")
    assert result["status"] == "error"


def test_tool_name_is_file_read(tmp_path):
    # プロンプトが参照する "file_read" の名前が維持されていること（回帰防止）。
    tool, _job_dir, _target = _make_tool(tmp_path)
    assert tool.tool_name == "file_read"


# ---------------------------------------------------------------------------
# 束縛版 image_reader のユニットテスト。
# 素の image_reader は image_path を expanduser で ~ 展開し任意パスの画像を読むため LFI。
# file_read 束縛と同型に allowed_dirs 配下のみ許可されることを担保する。
# ---------------------------------------------------------------------------


def _write_png(path) -> None:
    """PIL で最小の有効な PNG を書き出す（image_reader が format 判定できるように）。"""
    from PIL import Image

    Image.new("RGB", (2, 2), color=(123, 45, 67)).save(str(path), format="PNG")


def _make_image_tool(tmp_path):
    job_dir = tmp_path / "jobX"
    job_dir.mkdir()
    image = job_dir / "photo.png"
    _write_png(image)
    tool = create_bounded_image_reader_tool([str(job_dir)])
    return tool, job_dir, image


def test_image_reads_within_allowed_dir(tmp_path):
    tool, _job_dir, image = _make_image_tool(tmp_path)
    result = tool(image_path=str(image))
    assert result["status"] == "success"
    # 画像バイトが image ブロックで返ってくること。
    assert any(
        isinstance(block, dict) and "image" in block
        for block in result["content"]
    )


def test_image_rejects_outside_allowed_dir(tmp_path):
    # 許可ディレクトリ外の画像（兄弟ディレクトリ）は拒否される。
    job_dir = tmp_path / "jobX"
    job_dir.mkdir()
    outside_dir = tmp_path / "secret"
    outside_dir.mkdir()
    outside_image = outside_dir / "leak.png"
    _write_png(outside_image)

    tool = create_bounded_image_reader_tool([str(job_dir)])
    result = tool(image_path=str(outside_image))
    assert result["status"] == "error"
    assert str(outside_image) not in str(result)


def test_image_rejects_parent_traversal(tmp_path):
    tool, job_dir, _image = _make_image_tool(tmp_path)
    result = tool(
        image_path=os.path.join(str(job_dir), "..", "secret.png")
    )
    assert result["status"] == "error"


def test_image_rejects_tilde_expansion(tmp_path):
    tool, _job_dir, _image = _make_image_tool(tmp_path)
    # 素の image_reader は ~ を expanduser で展開してしまうため、束縛版で遮断する。
    result = tool(image_path="~/.aws/credentials")
    assert result["status"] == "error"


def test_image_rejects_glob_metacharacters(tmp_path):
    tool, job_dir, _image = _make_image_tool(tmp_path)
    result = tool(image_path=os.path.join(str(job_dir), "*.png"))
    assert result["status"] == "error"


def test_image_rejects_etc_path(tmp_path):
    tool, _job_dir, _image = _make_image_tool(tmp_path)
    # 許可外の絶対パス（/etc/...）は拒否される（汎用文言・パス非開示）。
    result = tool(image_path="/etc/hosts")
    assert result["status"] == "error"
    assert "/etc/hosts" not in str(result)


def test_image_rejects_prefix_confusion(tmp_path):
    # /tmp/jobX 束縛で /tmp/jobXY を読もうとしても拒否される（prefix 文字列一致の罠回避）。
    job_dir = tmp_path / "jobX"
    job_dir.mkdir()
    sibling = tmp_path / "jobXY"
    sibling.mkdir()
    secret = sibling / "secret.png"
    _write_png(secret)

    tool = create_bounded_image_reader_tool([str(job_dir)])
    result = tool(image_path=str(secret))
    assert result["status"] == "error"


def test_image_rejects_symlink_escape(tmp_path):
    # 許可ディレクトリ内に許可外画像を指す symlink を置いても realpath 解決で拒否される。
    job_dir = tmp_path / "jobX"
    job_dir.mkdir()
    outside = tmp_path / "outside.png"
    _write_png(outside)
    link = job_dir / "link.png"
    link.symlink_to(outside)

    tool = create_bounded_image_reader_tool([str(job_dir)])
    result = tool(image_path=str(link))
    assert result["status"] == "error"


def test_image_rejects_empty_path(tmp_path):
    tool, _job_dir, _image = _make_image_tool(tmp_path)
    result = tool(image_path="")
    assert result["status"] == "error"


def test_image_tool_name_is_image_reader(tmp_path):
    # プロンプトが参照する "image_reader" の名前が維持されていること（回帰防止）。
    tool, _job_dir, _image = _make_image_tool(tmp_path)
    assert tool.tool_name == "image_reader"


if __name__ == "__main__":
    import sys

    sys.exit(pytest.main([__file__, "-v"]))
