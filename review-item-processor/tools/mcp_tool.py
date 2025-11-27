from typing import List, Optional, Any, Dict
from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters
from logger import logger


def create_mcp_clients(mcp_config: Optional[List[Dict[str, Any]]]) -> List[MCPClient]:
    """
    Create MCP clients from configuration.

    Args:
        mcp_config: List of MCP server configurations

    Returns:
        List of MCPClient instances
    """
    if not mcp_config:
        logger.debug("No MCP configuration provided")
        return []

    clients = []
    for server_cfg in mcp_config:
        package = server_cfg.get("package")
        if not package:
            logger.warning(f"MCP server config missing 'package': {server_cfg}")
            continue

        try:
            client = MCPClient(
                lambda pkg=package: stdio_client(
                    StdioServerParameters(command="uvx", args=[pkg])
                )
            )
            clients.append(client)
            logger.debug(f"Created MCP client for package: {package}")
        except Exception as e:
            logger.error(f"Failed to create MCP client for {package}: {e}")

    logger.info(f"Created {len(clients)} MCP client(s)")
    return clients
