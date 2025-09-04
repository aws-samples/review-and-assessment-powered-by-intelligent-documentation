import json
import logging
import os
import shutil
import sys
from pathlib import Path
from typing import List, Mapping, Optional, Sequence

import anyio
from mcp.client.stdio import StdioServerParameters

# Ref: https://github.com/awslabs/run-model-context-protocol-servers-with-aws-lambda
from mcp_lambda.server_adapter.adapter import stdio_server_adapter
from pydantic import BaseModel, Field, model_validator

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

LATEST_PROTOCOL_VERSION = "2025-06-18"
SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26"]

# ---------------------------------------------------------------------------------
# Why we override these environment variables
#
#  ▸ UV_CACHE_DIR
#      Wheel / HTTP cache.  The default is ~/.cache/uv, which maps to a read-only
#      EFS-style path (/home/sbx_userXXXX/.cache/uv) on AWS Lambda.  We redirect it
#      to /tmp so that uv can write at runtime.  /tmp is the only writable
#      filesystem in Lambda and persists for the lifetime of the warm container.
#
#  ▸ UV_PYTHON_INSTALL_DIR
#      Location where uv stores its managed CPython builds (downloaded the first
#      time “uvx” runs).  Each build is ~35 MB; putting it in /tmp keeps everything
#      inside the 512 MB ephemeral storage budget while avoiding read-only paths.
#
#  ▸ UV_TOOL_DIR
#      Virtual-env directory for tools started with “uvx <tool>”.  Placed in /tmp
#      for the same reason as above so that package installs and byte-code cache
#      files succeed.
#
#  ▸ XDG_CACHE_HOME / XDG_DATA_HOME / HOME
#      Some third-party dependencies still respect the XDG spec or $HOME when they
#      decide where to write cache or data files (e.g. Pygments, pip, or
#      pydantic-core).  Pointing them to /tmp guarantees write access and prevents
#      polluting $LAMBDA_TASK_ROOT.
#
#  ▸ **os.environ
#      We expand the existing Lambda environment first so that AWS-provided
#      variables (AWS_REGION, _HANDLER, etc.) are not lost—mcp passes *only* the
#      mapping supplied here to the child process.
#
# References
# ----------
# * uv documentation – Configuration / Environment Variables section
# * AWS Lambda execution environment – Ephemeral storage (/tmp) & read-only code
# * GitHub astral-sh/uv issue #5731 – No automatic cache pruning
# ---------------------------------------------------------------------------------
FIXED_ENV = {
    "UV_CACHE_DIR": "/tmp/uv_cache",
    "UV_PYTHON_INSTALL_DIR": "/tmp/uv_python",
    "UV_TOOL_DIR": "/tmp/uv_tools",
    "XDG_CACHE_HOME": "/tmp/uv_cache",
    "XDG_DATA_HOME": "/tmp/uv_data",
    "HOME": "/tmp",
}
SIZE_LIMIT = 400 * 1024 * 1024  # 400 MB


async def maybe_prune_uv():
    """
    Prune the uv cache if it exceeds the size limit.
    """
    used = (
        shutil.disk_usage(FIXED_ENV["UV_CACHE_DIR"]).used
        if os.path.isdir(FIXED_ENV["UV_CACHE_DIR"])
        else 0
    )
    if used >= SIZE_LIMIT:
        logger.info(
            f"[uv] cache {used/1e6:.1f}MB exceeds limit {SIZE_LIMIT/1e6:.1f}MB, pruning..."
        )
        await anyio.open_process(["/var/task/bin/uv", "cache", "prune", "--ci"])


class McpServerSpec(BaseModel):
    """
    Schema for the `mcpServer` section of an invocation event.

    All fields are optional; if absent we fall back to the default uvx server.
    Unknown keys are rejected (extra = "forbid").
    """

    command: Optional[str] = Field(
        default=None,
        description="Executable or interpreter to launch (e.g. 'uvx')",
    )
    args: Optional[Sequence[str]] = Field(
        default=None,
        description="Command-line arguments array",
    )
    env: Optional[Mapping[str, str]] = Field(
        default=None,
        description="Extra environment variables passed to the child process",
    )
    cwd: Optional[str] = Field(
        default=None,
        description="Working directory for the child process",
    )

    model_config = {"extra": "forbid"}  # <- reject typo keys

    # tiny sanity-check: args must be non-empty if supplied
    @model_validator(mode="after")
    def _validate_command_and_args(cls, m):
        # Ensure command is either None (→ default ‘uvx’) or exactly 'uvx'.
        if m.command is not None and m.command != "uvx":
            raise ValueError("Only 'uvx' is supported as command for now.")
        if m.args is not None and len(m.args) == 0:
            raise ValueError("`args` must contain at least one element if provided.")
        return m


def build_stdio_server_params(spec: Optional[McpServerSpec]) -> StdioServerParameters:
    """
    Convert a validated McpServerSpec (or None) into StdioServerParameters.
    """
    logger.info(f"Building server params from spec: {spec}")

    for d in FIXED_ENV.values():
        # Ensure the directories exist
        Path(d).mkdir(parents=True, exist_ok=True)

    # Defaults when the caller omits mcpServer completely
    command = spec.command if spec and spec.command else "uvx"
    args = (
        list(spec.args)
        if spec and spec.args
        else ["awslabs.aws-documentation-mcp-server@latest"]
    )

    logger.info(f"Final MCP server command: {command}, args: {args}")

    merged_env = {**os.environ, **FIXED_ENV}
    if spec and spec.env:
        for k, v in spec.env.items():
            if k not in FIXED_ENV:
                merged_env[k] = v
            else:
                logger.warning("Ignoring user env %s; protected by Lambda policy", k)

    return StdioServerParameters(
        command=command,
        args=args,
        env=merged_env,
        cwd=spec.cwd if spec and spec.cwd else None,
    )


def handle_initialize(params, request_id):
    """
    Handle initialize request by negotiating protocol version and capabilities

    Args:
        params: Initialize request parameters
        request_id: JSON-RPC request ID

    Returns:
        Initialize response or error
    """
    # Protocol version negotiation
    client_version = params.get("protocolVersion")

    # Check if client version is supported
    if client_version not in SUPPORTED_PROTOCOL_VERSIONS:
        return {
            "jsonrpc": "2.0",
            "error": {
                "code": -32602,
                "message": "Unsupported protocol version",
                "data": {
                    "supported": SUPPORTED_PROTOCOL_VERSIONS,
                    "requested": client_version,
                },
            },
            "id": request_id,
        }

    # Return capabilities
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "result": {
            "protocolVersion": LATEST_PROTOCOL_VERSION,
            "capabilities": {
                "logging": {},
                "prompts": {"listChanged": True},
                "resources": {"subscribe": True, "listChanged": True},
                "tools": {"listChanged": True},
            },
            "serverInfo": {"name": "MCPLambdaServer", "version": "1.0.0"},
        },
    }


def handler(event, context):
    """
    Lambda handler function that uses MCP server adapter for a time server

    Args:
        event: Lambda event containing the request
        context: Lambda execution context

    Returns:
        MCP server response
    """
    # Ensure the uv cache is pruned if necessary
    anyio.run(maybe_prune_uv)

    logger.debug(
        "Received event JSON:\n%s", json.dumps(event, ensure_ascii=False, indent=2)
    )

    # Special handling for initialize requests
    if event.get("method") == "initialize" and "params" in event:
        logger.info("Handling initialize request")
        return handle_initialize(event["params"], event.get("id"))

    # Ignore initialized notification (no response needed for stateless implementation)
    if event.get("method") == "initialized" and "id" not in event:
        logger.info("Ignoring initialized notification")
        return None

    spec_json = event.get("mcpServer")
    logger.info(f"Received mcpServer configuration: {spec_json}")
    spec: Optional[McpServerSpec] = None
    if spec_json is not None:
        try:
            spec = McpServerSpec.model_validate(spec_json)
        except Exception as e:
            # convert to JSON-RPC error object (id is preserved by the adapter)
            return {
                "jsonrpc": "2.0",
                "error": {
                    "code": -32602,  # invalid params
                    "message": f"Invalid mcpServer specification: {e}",
                },
                "id": event.get("id"),
            }

    logger.info("Building server parameters from spec: %s", spec)
    server_params = build_stdio_server_params(spec)

    # Pass through all other requests to the adapter
    response = stdio_server_adapter(server_params, event, context)
    logger.debug("Response JSON:\n%s", json.dumps(response, ensure_ascii=False, indent=2))
    return response
