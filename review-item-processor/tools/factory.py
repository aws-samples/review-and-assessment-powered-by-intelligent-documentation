import logging
from typing import List

from strands.types.tools import AgentTool
from tools.code_interpreter import create_code_interpreter_tool
from tools.knowledge_base import create_knowledge_base_tool

logger = logging.getLogger(__name__)


def create_custom_tools() -> List[AgentTool]:
    """
    Create all custom tools for the agent.

    Returns:
        List of enabled custom tools
    """
    tools = []

    # Code Interpreter
    code_tool = create_code_interpreter_tool()
    if code_tool:
        tools.append(code_tool)
        logger.debug("Added Code Interpreter tool")

    # Knowledge Base
    kb_tool = create_knowledge_base_tool()
    if kb_tool:
        tools.append(kb_tool)
        logger.debug("Added Knowledge Base query tool")

    logger.info(f"Created {len(tools)} custom tool(s)")
    return tools
