from typing import List, Optional, Any, Dict
from strands.tools.mcp import MCPClient
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.streamable_http import streamablehttp_client
from logger import logger


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

    clients = []
    for server_name, server_cfg in mcp_config.items():
        try:
            if _is_http_config(server_cfg):
                client = _create_http_client(server_cfg, server_name)
            elif _is_stdio_config(server_cfg):
                client = _create_stdio_client(server_cfg, server_name)
            else:
                logger.error(f"Invalid MCP config for '{server_name}': {server_cfg}")
                continue

            if client:
                clients.append(client)
        except Exception as e:
            logger.error(f"Failed to create MCP client for '{server_name}': {e}")

    logger.info(f"Created {len(clients)} MCP client(s)")
    return clients


def _is_http_config(config: Dict[str, Any]) -> bool:
    """HTTP MCPサーバー設定か判定"""
    url = config.get("url", "").strip()
    return bool(url and (url.startswith("http://") or url.startswith("https://")))


def _is_stdio_config(config: Dict[str, Any]) -> bool:
    """stdio MCPサーバー設定か判定"""
    return "command" in config and "args" in config and config["args"]


def _create_stdio_client(config: Dict[str, Any], server_name: str) -> Optional[MCPClient]:
    """Create stdio-based MCP client (uvx or npx)."""
    command = config.get("command", "uvx")
    args = config["args"]

    client = MCPClient(
        lambda a=args, c=command: stdio_client(
            StdioServerParameters(command=c, args=a)
        )
    )
    logger.debug(f"Created stdio MCP client '{server_name}': {command} {args}")
    return client


def _create_http_client(config: Dict[str, Any], server_name: str) -> Optional[MCPClient]:
    """Create HTTP-based MCP client."""
    url = config["url"].strip()
    client = MCPClient(lambda u=url: streamablehttp_client(u))
    logger.debug(f"Created HTTP MCP client '{server_name}': {url}")
    return client
