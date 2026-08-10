#!/usr/bin/env python3
"""
mcp_tool._build_stdio_env の純粋ユニットテスト。
stdio MCP 子プロセスへ渡す env が「SDK 既定 env + UV_CONSTRAINT の加算のみ」で
あることを固定する（os.environ の AWS 資格情報等が混入しないことの担保を兼ねる）。
UV_CONSTRAINT が uvx の依存解決に mcp<2 を適用できないと、上限を宣言しない
MCP サーバ (mcp-server-fetch 等) が mcp 2.0.0 (2026-07-28 公開・破壊的変更) を
解決して import 時に即死し、"MCP error -32000: Connection closed" になる。
AWS リソース非依存・ネットワーク非依存。
"""
import os

import pytest

import tools.mcp_tool as mcp_tool
from mcp.client.stdio import get_default_environment


def test_env_is_default_plus_constraint_only(tmp_path, monkeypatch):
    """制約ファイルがあるとき: SDK 既定 env + UV_CONSTRAINT だけを返す。"""
    constraints = tmp_path / "mcp-uv-constraints.txt"
    constraints.write_text("mcp<2\n")
    assert not any(ch.isspace() for ch in str(constraints)), (
        "前提: pytest の tmp_path は空白を含まない"
    )
    monkeypatch.setattr(mcp_tool, "_UV_CONSTRAINTS_FILE", constraints)
    # os.environ 由来の秘密が混入しないことを、目印を置いて確認する。
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "must-not-leak")

    env = mcp_tool._build_stdio_env()

    assert env is not None
    assert env["UV_CONSTRAINT"] == str(constraints)
    assert "AWS_SECRET_ACCESS_KEY" not in env
    # UV_CONSTRAINT 以外は SDK 既定 env と完全一致（勝手なキーを足さない）。
    without_constraint = {k: v for k, v in env.items() if k != "UV_CONSTRAINT"}
    assert without_constraint == get_default_environment()


def test_env_falls_back_to_none_when_file_missing(tmp_path, monkeypatch):
    """制約ファイルが無い環境（ローカル実行等）では None = SDK 既定に委ねる。"""
    monkeypatch.setattr(
        mcp_tool, "_UV_CONSTRAINTS_FILE", tmp_path / "does-not-exist.txt"
    )
    assert mcp_tool._build_stdio_env() is None


def test_env_falls_back_when_path_contains_whitespace(tmp_path, monkeypatch):
    """uv は UV_CONSTRAINT を空白区切りの複数ファイルとして解釈するため、
    空白を含むパスでは制約なし（None）へフォールバックする。"""
    spaced_dir = tmp_path / "dir with space"
    spaced_dir.mkdir()
    constraints = spaced_dir / "mcp-uv-constraints.txt"
    constraints.write_text("mcp<2\n")
    monkeypatch.setattr(mcp_tool, "_UV_CONSTRAINTS_FILE", constraints)
    assert mcp_tool._build_stdio_env() is None


def test_repo_constraints_file_pins_mcp_below_2():
    """リポジトリ同梱の制約ファイルが存在し mcp<2 を含む（Dockerfile の COPY 元）。"""
    repo_file = mcp_tool._UV_CONSTRAINTS_FILE
    assert repo_file.name == "mcp-uv-constraints.txt"
    assert repo_file.is_file(), f"missing: {repo_file}"
    lines = [
        line.strip()
        for line in repo_file.read_text().splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    assert lines == ["mcp<2"]
