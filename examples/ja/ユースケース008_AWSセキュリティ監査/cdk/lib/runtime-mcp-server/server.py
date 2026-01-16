"""FastMCP wrapper for aws-api-mcp-server.

This server wraps the stdio-based aws-api-mcp-server as an HTTP server
for deployment on AgentCore Runtime.
"""

from mcp.server.fastmcp import FastMCP
import subprocess
import json
import logging
from typing import Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastMCP with stateless_http=True for AgentCore Runtime
mcp = FastMCP(host="0.0.0.0", stateless_http=True)


@mcp.tool()
def call_aws(command: str) -> str:
    """Execute AWS CLI command and return results.

    Args:
        command: AWS CLI command to execute (e.g., "aws s3 ls")

    Returns:
        Command output as string
    """
    logger.info(f"Executing call_aws with command: {command}")
    return _invoke_aws_api_mcp_server("call_aws", {"command": command})


@mcp.tool()
def suggest_aws_commands(natural_language_query: str) -> str:
    """Suggest AWS CLI commands from natural language description.

    Args:
        natural_language_query: Natural language description of what you want to do

    Returns:
        Suggested AWS CLI commands
    """
    logger.info(f"Executing suggest_aws_commands with query: {natural_language_query}")
    return _invoke_aws_api_mcp_server("suggest_aws_commands", {
        "natural_language_query": natural_language_query
    })


@mcp.tool()
def get_execution_plan(task_description: str) -> str:
    """Get step-by-step execution plan for complex AWS tasks.

    Args:
        task_description: Description of the AWS task to accomplish

    Returns:
        Execution plan with step-by-step AWS CLI commands
    """
    logger.info(f"Executing get_execution_plan with task: {task_description}")
    return _invoke_aws_api_mcp_server("get_execution_plan", {
        "task_description": task_description
    })


def _invoke_aws_api_mcp_server(tool_name: str, arguments: dict[str, Any]) -> str:
    """Invoke aws-api-mcp-server subprocess and return result.

    Args:
        tool_name: Name of the MCP tool to invoke
        arguments: Tool arguments

    Returns:
        Tool execution result as string
    """
    try:
        proc = subprocess.Popen(
            ["uvx", "awslabs.aws-api-mcp-server@latest"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }

        logger.debug(f"Sending request to aws-api-mcp-server: {request}")
        stdout, stderr = proc.communicate(json.dumps(request))

        if stderr:
            logger.warning(f"aws-api-mcp-server stderr: {stderr}")

        response = json.loads(stdout)
        logger.debug(f"Received response: {response}")

        if "error" in response:
            error_msg = response["error"].get("message", "Unknown error")
            logger.error(f"MCP error: {error_msg}")
            return f"Error: {error_msg}"

        # Extract text content from result
        result = response.get("result", {})
        content = result.get("content", [])

        if content and len(content) > 0:
            return content[0].get("text", "")

        return json.dumps(result)

    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}, stdout: {stdout}")
        return f"Error parsing MCP response: {e}"
    except Exception as e:
        logger.error(f"Error invoking aws-api-mcp-server: {e}")
        return f"Error: {str(e)}"


if __name__ == "__main__":
    logger.info("Starting AWS Security Audit MCP Server with streamable-http transport")
    # Port 8000 is configured in FastMCP constructor, not here
    mcp.run(transport="streamable-http")
