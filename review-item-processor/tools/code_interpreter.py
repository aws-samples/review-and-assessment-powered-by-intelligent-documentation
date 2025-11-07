import json
import logging
import os
from typing import Literal

from bedrock_agentcore.tools.code_interpreter_client import code_session
from strands.tools import tool

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get("AWS_REGION", "us-west-2")
# Ref: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/code-interpreter-tool.html
SUPPORTED_LANGUAGE = Literal["python", "typescript", "javascript"]


@tool
def code_interpreter(code: str, language: SUPPORTED_LANGUAGE) -> str:
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
                result = json.dumps(event["result"])
                logger.debug("Code execution completed successfully")
                return result

    except Exception as e:
        error_msg = f"Code execution failed: {str(e)}"
        logger.error(error_msg)
        return error_msg
