from typing import Any, Dict, List, Optional, TypedDict, Union
from strands.types.tools import AgentTool
from strands.tools.mcp import MCPClient
from tools.code_interpreter import create_code_interpreter_tool
from tools.knowledge_base import create_knowledge_base_tool
from tools.mcp_tool import create_mcp_clients
from logger import logger


class KnowledgeBaseConfig(TypedDict):
    knowledgeBaseId: str
    dataSourceIds: Optional[List[str]]


class ToolConfiguration(TypedDict, total=False):
    knowledgeBase: Optional[List[KnowledgeBaseConfig]]
    codeInterpreter: bool
    mcpConfig: Optional[Any]


def create_custom_tools(
    tool_config: Optional[ToolConfiguration] = None,
) -> List[Union[AgentTool, MCPClient]]:
    """
    Create custom tools based on configuration.

    Args:
        tool_config: Tool configuration from database

    Returns:
        List of enabled custom tools (including MCP clients)
    """
    tools = []

    if not tool_config:
        logger.debug("No tool configuration provided, returning empty tool list")
        return tools

    logger.debug(f"Creating tools with configuration: {tool_config}")

    # Code Interpreter
    if tool_config.get("codeInterpreter", False):
        code_tool = create_code_interpreter_tool()
        if code_tool:
            tools.append(code_tool)
            logger.debug("Enabled: Code Interpreter")

    # Knowledge Base
    kb_config = tool_config.get("knowledgeBase")
    if kb_config:
        kb_tool = create_knowledge_base_tool(kb_config)
        if kb_tool:
            tools.append(kb_tool)
            logger.debug(f"Enabled: Knowledge Base with {len(kb_config)} KB(s)")
            for kb in kb_config:
                logger.debug(
                    f"  - KB ID: {kb['knowledgeBaseId']}, Data Sources: {kb.get('dataSourceIds', 'All')}"
                )

    # MCP Config
    mcp_config = tool_config.get("mcpConfig")
    if mcp_config:
        mcp_clients = create_mcp_clients(mcp_config)
        tools.extend(mcp_clients)
        logger.debug(f"Enabled: {len(mcp_clients)} MCP client(s)")

    logger.info(f"Created {len(tools)} custom tool(s) from configuration")
    return tools
