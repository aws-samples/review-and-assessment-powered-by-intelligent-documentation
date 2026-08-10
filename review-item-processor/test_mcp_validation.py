#!/usr/bin/env python3
"""
mcp_validation の SSRF IP 判定（_is_blocked_ip）の純粋ユニットテスト。

Python の SSRF 検証が CGNAT(100.64.0.0/10) を素通りしていた回帰を防ぐ。
TS 実装（mcp-validation.ts の isBlockedIpv4Octets）と網羅性を一致させることを
検証する。AWS リソース非依存・ネットワーク非依存。
"""
import pytest

import socket
from urllib.parse import urlparse

from tools.mcp_validation import (
    _SHELL_METACHAR_RE,
    _is_blocked_ip,
    _mask_url_secrets,
    assert_safe_mcp_args,
    mask_mcp_server_config,
    resolve_and_validate_mcp_url,
    sanitize_mcp_env,
    validate_stdio_config,
)


@pytest.mark.parametrize(
    "ip,expected_blocked",
    [
        # CGNAT 100.64.0.0/10（RFC 6598）— 本修正の対象
        ("100.64.0.1", True),
        ("100.100.100.100", True),
        ("100.127.255.254", True),
        # CGNAT の境界外（パブリック）は許可
        ("100.63.255.255", False),
        ("100.128.0.1", False),
        # 既存のブロック対象（回帰確認）
        ("169.254.169.254", True),  # IMDS link-local
        ("127.0.0.1", True),  # loopback
        ("10.0.0.5", True),  # private
        ("172.16.0.1", True),  # private
        ("192.168.1.1", True),  # private
        ("0.0.0.0", True),  # unspecified
        # IPv4-mapped IPv6 経由の CGNAT / IMDS（バイパス対策）
        ("::ffff:100.64.0.1", True),
        ("::ffff:169.254.169.254", True),
        # パブリックは許可
        ("8.8.8.8", False),
        ("1.1.1.1", False),
        # IP として解釈不能はフェイルクローズ（ブロック）
        ("not-an-ip", True),
    ],
)
def test_is_blocked_ip(ip, expected_blocked):
    assert _is_blocked_ip(ip) is expected_blocked


# TS 側 SHELL_METACHAR_RE に NULL バイトが混入してスペースを検出できていなかった
# 回帰の、Python ミラーとの一致を担保する。
# Python の _SHELL_METACHAR_RE はスペース(0x20)を含み NULL(0x00)は含まない正が保たれている。
def test_shell_metachar_re_matches_space_not_null():
    assert _SHELL_METACHAR_RE.search(" ") is not None
    assert _SHELL_METACHAR_RE.search("\x00") is None


def test_assert_safe_mcp_args_rejects_space():
    with pytest.raises(ValueError):
        assert_safe_mcp_args(["foo bar"])
    with pytest.raises(ValueError):
        assert_safe_mcp_args(["--config", "a b c"])


def test_assert_safe_mcp_args_allows_normal_args():
    # スペースを含まない正常な args は通過する（回帰確認）
    assert_safe_mcp_args(["--directory", "/tmp/x", "mcp-server-fetch"])
    assert_safe_mcp_args([])


# パッケージレジストリ/インデックス上書き系の env を拒否する。
# TS 側 (mcp-validation.env.test.ts) と同一キー集合で同期させること。
_REGISTRY_OVERRIDE_KEYS = [
    # uv
    "UV_INDEX_URL",
    "UV_DEFAULT_INDEX",
    "UV_INDEX",
    "UV_EXTRA_INDEX_URL",
    "UV_FIND_LINKS",
    "UV_PYTHON",
    "UV_CONFIG_FILE",
    "UV_NATIVE_TLS",
    "UV_INSECURE_HOST",
    "UV_INDEX_FOO_USERNAME",
    # pip
    "PIP_INDEX_URL",
    "PIP_EXTRA_INDEX_URL",
    # npm
    "NPM_CONFIG_REGISTRY",
    "NPM_CONFIG_USERCONFIG",
    "NPM_CONFIG_GLOBALCONFIG",
]


@pytest.mark.parametrize("key", _REGISTRY_OVERRIDE_KEYS)
def test_sanitize_mcp_env_rejects_registry_overrides(key):
    with pytest.raises(ValueError):
        sanitize_mcp_env({key: "http://evil.example"})


def test_sanitize_mcp_env_rejects_lowercase_registry_overrides():
    # _is_reserved_env_key は upper 比較なので小文字も拒否される（回帰確認）
    with pytest.raises(ValueError):
        sanitize_mcp_env({"npm_config_registry": "http://evil"})
    with pytest.raises(ValueError):
        sanitize_mcp_env({"uv_index_url": "http://evil"})


# パッケージ DL の MitM を塞ぐ。プロキシ / CA 信頼 /
# TLS 検証無効化系の env を拒否する。TS 側 (mcp-validation.env.test.ts の
# PROXY_CA_OVERRIDE_KEYS) と同一キー集合で同期させること。npm/pip/uv 固有キーは既存
# プレフィックスでカバー済みのため、ここではプレフィックスを持たない汎用・Node・Python・
# curl・OpenSSL・git 系を列挙する。
_PROXY_CA_OVERRIDE_KEYS = [
    # 汎用プロキシ
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "FTP_PROXY",
    # Node CA / TLS
    "NODE_EXTRA_CA_CERTS",
    "NODE_TLS_REJECT_UNAUTHORIZED",
    # Python / curl / OpenSSL CA
    "REQUESTS_CA_BUNDLE",
    "CURL_CA_BUNDLE",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    # git
    "GIT_SSL_CAINFO",
    "GIT_SSL_NO_VERIFY",
    "GIT_PROXY_COMMAND",
]


@pytest.mark.parametrize("key", _PROXY_CA_OVERRIDE_KEYS)
def test_sanitize_mcp_env_rejects_proxy_ca_overrides(key):
    with pytest.raises(ValueError):
        sanitize_mcp_env({key: "http://evil.example"})


def test_sanitize_mcp_env_rejects_lowercase_proxy_ca_overrides():
    # _is_reserved_env_key は upper 比較なので小文字も拒否される（回帰確認）
    with pytest.raises(ValueError):
        sanitize_mcp_env({"http_proxy": "http://evil"})
    with pytest.raises(ValueError):
        sanitize_mcp_env({"node_extra_ca_certs": "/tmp/evil-ca.pem"})


# HOME をユーザー入力で上書きさせない。
# TS 側 sanitizeMcpEnv と同期。HOME を攻撃者制御ディレクトリに向けると uvx/npx や
# その子プロセス (pip/git) の設定ファイル探索先を差し替えられるため拒否する。
def test_sanitize_mcp_env_rejects_home():
    with pytest.raises(ValueError):
        sanitize_mcp_env({"HOME": "/tmp/attacker"})
    # _is_reserved_env_key は upper 比較なので小文字 home も拒否される（回帰確認）
    with pytest.raises(ValueError):
        sanitize_mcp_env({"home": "/tmp/attacker"})


def test_sanitize_mcp_env_allows_normal_keys():
    safe = sanitize_mcp_env({"API_KEY": "sk-xxx", "MY_TOKEN": "abc"})
    assert safe["API_KEY"] == "sk-xxx"
    assert safe["MY_TOKEN"] == "abc"


def test_validate_stdio_config_rejects_registry_override_env():
    with pytest.raises(ValueError):
        validate_stdio_config(
            {
                "command": "uvx",
                "args": [],
                "env": {"NPM_CONFIG_REGISTRY": "http://evil"},
            }
        )


# MCP HTTP トランスポートのリダイレクト追従を無効化した
# httpx クライアントファクトリが follow_redirects=False を強制することを担保する。
# ネットワーク非依存（クライアントは生成して即 close するだけ）。
def test_no_redirect_http_client_disables_follow():
    from tools.mcp_validation import create_no_redirect_mcp_http_client

    client = create_no_redirect_mcp_http_client()
    assert client.follow_redirects is False
    import anyio

    anyio.run(client.aclose)


# mcp_tool.py が不正 config 時に server_cfg を verbatim
# ログ出力していた情報漏洩を防ぐマスキング関数（TS の maskToolConfiguration をミラー）の
# 純粋ユニットテスト。ネットワーク非依存。
def test_mask_mcp_server_config_masks_headers_env_and_clones():
    cfg = {
        "url": "https://example.com/mcp",
        "headers": {"Authorization": "Bearer sk-secret", "X-Api-Key": "sk-secret"},
        "env": {"API_KEY": "sk-secret", "TOKEN": "sk-secret"},
    }
    masked = mask_mcp_server_config(cfg)

    # headers / env はキー名を保持し値のみ ***REDACTED***
    assert masked["headers"] == {
        "Authorization": "***REDACTED***",
        "X-Api-Key": "***REDACTED***",
    }
    assert masked["env"] == {"API_KEY": "***REDACTED***", "TOKEN": "***REDACTED***"}
    # クローンであり元 cfg は変更されない
    assert cfg["headers"]["Authorization"] == "Bearer sk-secret"
    assert cfg["env"]["API_KEY"] == "sk-secret"


def test_mask_mcp_server_config_masks_args_and_preserves_count():
    cfg = {"command": "uvx", "args": ["--api-key", "sk-secret", "mcp-server"]}
    masked = mask_mcp_server_config(cfg)

    assert masked["args"] == ["***REDACTED***", "***REDACTED***", "***REDACTED***"]
    # 件数（長さ）は保持
    assert len(masked["args"]) == len(cfg["args"])
    # 元 cfg は変更されない
    assert cfg["args"] == ["--api-key", "sk-secret", "mcp-server"]


def test_mask_mcp_server_config_masks_url_secrets():
    cfg = {"url": "https://user:pass@example.com/mcp?api_key=sk-secret&mode=fast"}
    masked = mask_mcp_server_config(cfg)

    url = masked["url"]
    # host / path / クエリキーは保持
    assert urlparse(url).hostname == "example.com"
    assert "/mcp" in url
    assert "api_key=" in url
    assert "mode=" in url
    # userinfo とクエリ値はマスクされ秘密が消えている
    assert "user" not in url
    assert "pass" not in url
    assert "sk-secret" not in url


def test_mask_url_secrets_unparseable_drops_query():
    # urlparse が例外を投げる（不正ポート）入力で except 経路へ落ち、? 以降を落とす。
    # 秘密を含まず、? も残らないこと（防御的）。
    out = _mask_url_secrets("http://example.com:99999999999/p?api_key=sk-secret")
    assert "sk-secret" not in out
    assert "?" not in out


def test_mask_mcp_server_config_non_dict_returned_as_is():
    assert mask_mcp_server_config("foo") == "foo"
    assert mask_mcp_server_config(None) is None


# MCP HTTP の TOCTOU(DNS rebinding) 緩和。
# resolve_and_validate_mcp_url が検証時に安全と確認した IP を返し（接続時のピン留め元）、
# ピン留め transport が follow_redirects=False と host/Host/sni_hostname を設定することを
# 検証する。ネットワーク非依存（getaddrinfo を monkeypatch、transport は直接呼ぶ）。


def _fake_getaddrinfo(addresses):
    """getaddrinfo の戻り（(family, type, proto, canonname, sockaddr) のリスト）を作る。"""

    def _impl(host, port, *args, **kwargs):
        return [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", (addr, 0))
            for addr in addresses
        ]

    return _impl


def test_resolve_and_validate_public_ip_literal_returns_itself():
    # 公開IPリテラルは解決せず [そのIP] を返す（挙動不変）。
    hostname, ips = resolve_and_validate_mcp_url("https://93.184.216.34/mcp")
    assert hostname == "93.184.216.34"
    assert ips == ["93.184.216.34"]


def test_resolve_and_validate_blocked_ip_literal_raises():
    # 内部IPリテラル（IMDS）は ValueError。
    with pytest.raises(ValueError):
        resolve_and_validate_mcp_url("http://169.254.169.254/latest/meta-data")


def test_resolve_and_validate_public_hostname_returns_safe_ips(monkeypatch):
    monkeypatch.setattr(
        socket, "getaddrinfo", _fake_getaddrinfo(["93.184.216.34", "8.8.8.8"])
    )
    hostname, ips = resolve_and_validate_mcp_url("https://example.com/mcp")
    assert hostname == "example.com"
    assert ips == ["93.184.216.34", "8.8.8.8"]


def test_resolve_and_validate_mixed_public_and_internal_raises(monkeypatch):
    # 公開と内部が混在 → フェイルクローズ（ValueError）。
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        _fake_getaddrinfo(["93.184.216.34", "169.254.169.254"]),
    )
    with pytest.raises(ValueError):
        resolve_and_validate_mcp_url("https://example.com/mcp")


def test_resolve_and_validate_all_internal_raises(monkeypatch):
    # 全て内部 → フェイルクローズ（ValueError）。
    monkeypatch.setattr(
        socket, "getaddrinfo", _fake_getaddrinfo(["10.0.0.5", "169.254.169.254"])
    )
    with pytest.raises(ValueError):
        resolve_and_validate_mcp_url("https://internal.example/mcp")


def test_resolve_and_validate_unresolvable_raises(monkeypatch):
    def _raise(*args, **kwargs):
        raise socket.gaierror("name or service not known")

    monkeypatch.setattr(socket, "getaddrinfo", _raise)
    with pytest.raises(ValueError):
        resolve_and_validate_mcp_url("https://nope.example/mcp")


def test_pinned_transport_sets_host_hostheader_and_sni_and_no_redirect():
    # ピン留め factory が follow_redirects=False を維持し、生成 transport の
    # handle_async_request が url.host=pinned_ip / Host=original_host /
    # sni_hostname=original_host を設定することを検証（ネットワーク非依存）。
    import anyio
    import httpx

    from tools.mcp_validation import (
        _PinnedAsyncHTTPTransport,
        create_pinned_mcp_http_client_factory,
    )

    factory = create_pinned_mcp_http_client_factory(
        pinned_ip="93.184.216.34", original_host="example.com"
    )
    client = factory()
    try:
        assert client.follow_redirects is False
    finally:
        anyio.run(client.aclose)

    # transport.handle_async_request を直接呼び、super を呼ぶ前の request 改変を観測する。
    transport = _PinnedAsyncHTTPTransport(
        pinned_ip="93.184.216.34", original_host="example.com"
    )

    captured = {}

    async def _fake_super(self, request):
        captured["host"] = request.url.host
        captured["host_header"] = request.headers.get("Host")
        captured["sni"] = request.extensions.get("sni_hostname")
        return httpx.Response(200, request=request)

    # super().handle_async_request を差し替えて I/O を発生させない。
    orig = httpx.AsyncHTTPTransport.handle_async_request
    httpx.AsyncHTTPTransport.handle_async_request = _fake_super  # type: ignore[assignment]
    try:
        request = httpx.Request("GET", "https://example.com/mcp")
        anyio.run(transport.handle_async_request, request)
    finally:
        httpx.AsyncHTTPTransport.handle_async_request = orig  # type: ignore[assignment]

    assert captured["host"] == "93.184.216.34"
    assert captured["host_header"] == "example.com"
    assert captured["sni"] == "example.com"


def test_mask_mcp_server_config_no_secret_leaks_in_str():
    # 回帰確認: 秘密文字列が str(masked) に一切現れない。
    cfg = {
        "url": "https://example.com/mcp?api_key=sk-secret",
        "headers": {"Authorization": "Bearer sk-secret"},
        "env": {"API_KEY": "sk-secret"},
        "args": ["--token", "sk-secret"],
    }
    masked = mask_mcp_server_config(cfg)
    assert "sk-secret" not in str(masked)


if __name__ == "__main__":
    import sys

    sys.exit(pytest.main([__file__, "-v"]))
