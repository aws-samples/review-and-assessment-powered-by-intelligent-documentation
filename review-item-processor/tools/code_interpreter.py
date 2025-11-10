import json
import logging
import os
from typing import Literal, Optional

from bedrock_agentcore.tools.code_interpreter_client import code_session
from strands.tools import tool
from strands.types.tools import ToolResult, AgentTool

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get("AWS_REGION", "us-west-2")
# Ref: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/code-interpreter-tool.html
SUPPORTED_LANGUAGE = Literal["python", "typescript", "javascript"]

ENABLE_CODE_INTERPRETER = os.environ.get("ENABLE_CODE_INTERPRETER", "true").lower() == "true"


def create_code_interpreter_tool() -> Optional[AgentTool]:
    """
    Create custom code interpreter tool if enabled.

    Returns:
        Code interpreter tool function or None if disabled
    """
    if not ENABLE_CODE_INTERPRETER:
        logger.debug("Code Interpreter disabled, skipping tool creation")
        return None

    try:
        logger.info("Creating custom code interpreter tool")
        return code_interpreter
    except Exception as e:
        logger.error(f"Failed to create code interpreter tool: {e}")
        return None


@tool
def code_interpreter(code: str) -> dict | None:
    """
    Execute Python code.
    This tool provides a secure execution environment for data analysis,
    calculations, and code execution tasks during document review processes.
    """
    try:
        # Use bedrock-agentcore's code_session context manager for secure execution
        with code_session(AWS_REGION) as code_client:
            response = code_client.invoke(
                "executeCode", {"code": code, "language": "python", "clearContext": False}
            )

            # Extract result from response stream
            for event in response["stream"]:
                result_data = event["result"]
                structured = result_data.get("structuredContent", {})
                is_error = result_data.get("isError", False)

                status = "error" if is_error else "success"
                logger.debug(f"Code execution completed with status: {status}")

                # Return as ToolResult
                # see: https://github.com/strands-agents/sdk-python/blob/1df45be924226985008814a508fab5d952a06201/src/strands/types/tools.py#L90
                return {"status": status, "content": [{"json": structured}]}

    except Exception as e:
        error_msg = f"Code execution failed: {str(e)}"
        logger.error(error_msg)
        return {
            "status": "error",
            "content": [{"text": f"An error occurred during code interpreter: {str(e)}"}],
        }
