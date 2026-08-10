from pathlib import Path
from typing import List, Optional, Any, Dict
from strands.tools.mcp import MCPClient
from mcp.client.stdio import (
    get_default_environment,
    stdio_client,
    StdioServerParameters,
)
from mcp.client.streamable_http import streamablehttp_client
from logger import logger
from tools.mcp_validation import (
    _mask_url_secrets,
    create_pinned_mcp_http_client_factory,
    mask_mcp_server_config,
    resolve_and_validate_mcp_url,
    validate_stdio_config,
)


# uvx が MCP サーバの依存を解決するときに適用する制約ファイル (mcp<2)。
# イメージ内では Dockerfile の COPY により /app/mcp-uv-constraints.txt に置かれる
# (このファイルの親ディレクトリ = review-item-processor/ 直下)。
_UV_CONSTRAINTS_FILE = Path(__file__).resolve().parent.parent / "mcp-uv-constraints.txt"


def _build_stdio_env() -> Optional[Dict[str, str]]:
    """stdio MCP 子プロセスへ渡す env を構築する。

    SDK 既定 env（os.environ を継承しないため AWS 資格情報等は渡らない）に
    UV_CONSTRAINT だけを加算する。制約が無いと、上限を宣言しない MCP サーバ
    (mcp-server-fetch 等) が mcp 2.0.0 (2026-07-28 公開・破壊的変更) を解決して
    import 時に即死し、"MCP error -32000: Connection closed" になる。
    制約ファイルが無い環境（ローカル実行・テスト）では None を返し、
    SDK 既定の env 構築（従来の挙動）に委ねる。
    """
    if not _UV_CONSTRAINTS_FILE.is_file():
        return None
    path = str(_UV_CONSTRAINTS_FILE)
    # uv は UV_CONSTRAINT を空白区切りの複数ファイル指定として解釈するため、
    # パスに空白を含むと分割されて "File not found" になる。イメージ内 (/app) は
    # 空白を含まないが、空白を含むディレクトリでのローカル開発では制約なしに
    # フォールバックする。
    if any(ch.isspace() for ch in path):
        logger.warning(
            "Skipping MCP uv constraints: path contains whitespace, which uv "
            "would split into multiple files."
        )
        return None
    return {**get_default_environment(), "UV_CONSTRAINT": path}


def create_mcp_clients(mcp_config: Optional[Dict[str, Dict[str, Any]]]) -> List[MCPClient]:
    """
    Create MCP clients from configuration.

    Args:
        mcp_config: Dict of MCP server configurations
            Key: server name (str)
            Value: server config (Dict) with:
            - HTTP: url (str, starting with http/https)
            - stdio: command (str), args (List[str])
            Optional: headers, oauthScopes, env, timeout, disabled, disabledTools

    Returns:
        List of MCPClient instances
    """
    if not mcp_config:
        logger.debug("No MCP configuration provided")
        return []

    if not isinstance(mcp_config, dict):
        logger.error(f"Invalid mcp_config type: expected dict, got {type(mcp_config).__name__}")
        raise TypeError(f"mcp_config must be a dictionary, got {type(mcp_config).__name__}")

    clients = []
    failed_servers = []

    for server_name, server_cfg in mcp_config.items():
        try:
            if _is_http_config(server_cfg):
                client = _create_http_client(server_cfg, server_name)
            elif _is_stdio_config(server_cfg):
                client = _create_stdio_client(server_cfg, server_name)
            else:
                error_msg = f"Invalid config: missing url or (command + args)"
                # server_cfg は headers/env の秘密・
                # url の api_key・args 等を含みうるため verbatim 出力せずマスクする。
                logger.error(
                    f"Invalid MCP config for '{server_name}': {mask_mcp_server_config(server_cfg)}"
                )
                failed_servers.append((server_name, error_msg))
                continue

            if client:
                clients.append(client)
            else:
                warning_msg = f"Client creation returned None - check configuration"
                logger.warning(f"MCP client creation returned None for '{server_name}': {warning_msg}")
                failed_servers.append((server_name, warning_msg))

        except (ValueError, KeyError, TypeError) as e:
            # Expected configuration errors - user fixable
            error_msg = f"Invalid configuration: {e}"
            logger.error(f"Configuration error for MCP server '{server_name}': {e}")
            failed_servers.append((server_name, error_msg))

        except (ConnectionError, TimeoutError, OSError) as e:
            # Expected network/system errors
            error_msg = f"Connection failed: {e}"
            logger.error(f"Failed to connect to MCP server '{server_name}': {e}")
            failed_servers.append((server_name, error_msg))

        except Exception as e:
            # Unexpected errors - log with full traceback
            error_msg = f"Unexpected error: {e}"
            logger.error(f"UNEXPECTED ERROR creating MCP client for '{server_name}': {e}", exc_info=True)
            failed_servers.append((server_name, error_msg))

    if failed_servers:
        failed_list = "; ".join([f"{name}: {error}" for name, error in failed_servers])
        logger.warning(f"Failed to initialize {len(failed_servers)} MCP server(s): {failed_list}")

    logger.info(f"Successfully created {len(clients)} MCP client(s) out of {len(mcp_config)} configured")
    return clients


def _is_http_config(config: Dict[str, Any]) -> bool:
    """HTTP MCPサーバー設定か判定"""
    url = config.get("url", "").strip()
    return bool(url and (url.startswith("http://") or url.startswith("https://")))


def _is_stdio_config(config: Dict[str, Any]) -> bool:
    """stdio MCPサーバー設定か判定"""
    return "command" in config and "args" in config and config["args"]


def _create_stdio_client(config: Dict[str, Any], server_name: str) -> Optional[MCPClient]:
    """Create stdio-based MCP client (uvx or npx).

    TS 側と同一ルールで command/args/env を
    検証する。command は allowlist（uvx/npx）に限定し、シェルメタ文字を拒否。config.env の
    予約環境変数は拒否する。検証違反は ValueError（呼び出し側が per-server エラーとして捕捉）。
    """
    command = config.get("command", "uvx")
    args = config["args"]

    # 検証（不正なら ValueError を送出してフェイルクローズ）。
    # 既存挙動どおり os.environ は無条件展開せず、SDK 既定の安全な env を用いる。
    # 加算するのは UV_CONSTRAINT (mcp<2) のみ（_build_stdio_env 参照）。
    validate_stdio_config(config)

    env = _build_stdio_env()
    client = MCPClient(
        lambda a=args, c=command, e=env: stdio_client(
            StdioServerParameters(command=c, args=a, env=e)
        )
    )
    # args は秘密（--api-key 等）を含みうるので件数のみ。
    # command は allowlist(uvx/npx)済みで非機密。
    logger.debug(
        f"Created stdio MCP client '{server_name}': {command} ({len(args)} arg(s))"
    )
    return client


def _create_http_client(config: Dict[str, Any], server_name: str) -> Optional[MCPClient]:
    """Create HTTP-based MCP client.

    接続先 URL を検証して SSRF を防ぐ。内部 IP /
    リンクローカル / ループバック / 非 http(s) を拒否し、ホスト名は DNS 解決して全 IP を検査。
    検証不能時はフェイルクローズ（ValueError）。

    リダイレクト追従を無効化した httpx クライアントを注入し、
    接続後の 3xx で内部（IMDS/VPC）へ誘導される SSRF サイロ漏れを防ぐ。

    「検証→接続」の2段階で各々が独立に DNS 解決すると
    TOCTOU(DNS rebinding)で接続先がすり替わりうる。resolve_and_validate_mcp_url が検証時に
    安全と確認した IP をピン留めして接続する factory を注入し、すり替え窓を閉じる。TLS は
    元ホスト名(SNI/Host)で検証するため証明書検証は壊さない。
    """
    url = config["url"].strip()
    hostname, safe_ips = resolve_and_validate_mcp_url(url)
    # 検証済みの安全な IP を接続先へピン留め（複数解決時は先頭を採用）。
    httpx_client_factory = create_pinned_mcp_http_client_factory(
        pinned_ip=safe_ips[0], original_host=hostname
    )
    client = MCPClient(
        lambda u=url, f=httpx_client_factory: streamablehttp_client(
            u, httpx_client_factory=f
        )
    )
    # url の userinfo/クエリ値（api_key 等）はマスクする。
    logger.debug(
        f"Created HTTP MCP client '{server_name}': {_mask_url_secrets(url)}"
    )
    return client
