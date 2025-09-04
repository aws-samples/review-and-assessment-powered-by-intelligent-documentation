"""Lambda function MCP transport implementation"""

import json
import logging
import boto3
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from anyio.streams.memory import MemoryObjectReceiveStream, MemoryObjectSendStream
from anyio import create_memory_object_stream
from mcp.shared.message import SessionMessage
from pydantic import BaseModel
import anyio

logger = logging.getLogger(__name__)


class LambdaFunctionParameters(BaseModel):
    function_name: str
    """The name or ARN of the Lambda function, version, or alias."""
    region_name: str = "us-west-2"
    """AWS region name."""
    mcp_server: dict = {}
    """MCP server configuration."""


@asynccontextmanager
async def lambda_function_client(lambda_params: LambdaFunctionParameters):
    """Lambda function implementation for use as MCP transport"""
    
    # Create MessageStream (read_stream, write_stream)
    read_stream_writer, read_stream = create_memory_object_stream[SessionMessage | Exception](0)
    write_stream, write_stream_reader = create_memory_object_stream[SessionMessage](0)
    
    # Initialize Lambda client
    lambda_client = boto3.client('lambda', region_name=lambda_params.region_name)
    
    async def handle_messages():
        """Process messages from Lambda function"""
        async with write_stream_reader:
            async for message in write_stream_reader:
                try:
                    # Send SessionMessage's internal message in JSON-RPC format
                    payload = message.message.model_dump(by_alias=True, exclude_none=True)
                    
                    # Add MCP server configuration
                    if lambda_params.mcp_server:
                        payload["mcpServer"] = lambda_params.mcp_server
                    
                    # Add logging
                    logger.info(f"Sending payload to Lambda: method={payload.get('method')}, mcp_server={lambda_params.mcp_server}")
                    
                    response = lambda_client.invoke(
                        FunctionName=lambda_params.function_name,
                        Payload=json.dumps(payload)
                    )
                    
                    result = json.loads(response['Payload'].read())
                    
                    # Convert response to SessionMessage and send
                    from mcp.types import JSONRPCMessage
                    response_message = JSONRPCMessage.model_validate(result)
                    session_message = SessionMessage(response_message)
                    await read_stream_writer.send(session_message)
                    
                except Exception as e:
                    await read_stream_writer.send(e)
    
    # Start background task
    async with anyio.create_task_group() as tg:
        tg.start_soon(handle_messages)
        
        try:
            # Return MessageStream tuple
            yield (read_stream, write_stream)
        finally:
            await read_stream_writer.aclose()
            await write_stream.aclose()
