#!/usr/bin/env python3
"""
Integration tests for lambda_function_client.py

Unit tests (no AWS resources required):
    poetry run pytest tests/test_lambda_function_client.py::TestLambdaFunctionClientUnit -v

Integration tests (requires AWS Lambda ARN):
    export PY_MCP_LAMBDA_ARN="arn:aws:lambda:region:account:function:your-mcp-lambda-function"
    export AWS_REGION="your-region"
    poetry run pytest tests/test_lambda_function_client.py::TestLambdaFunctionClientIntegration -v

Debug payload format:
    poetry run pytest tests/test_lambda_function_client.py::TestDebugPayloadFormat -v -s

All tests:
    poetry run pytest tests/test_lambda_function_client.py -v
"""

import asyncio
import json
import os
import unittest
from unittest.mock import Mock, patch

from lambda_function_client import lambda_function_client, LambdaFunctionParameters
from mcp.shared.message import SessionMessage
from mcp.types import JSONRPCRequest


class TestLambdaFunctionClientUnit(unittest.TestCase):
    """Unit tests with mocked Lambda client"""
    
    @patch('lambda_function_client.boto3.client')
    def test_message_payload_format(self, mock_boto3_client):
        """Test that SessionMessage is correctly serialized to JSON-RPC format"""
        # Setup mock
        mock_lambda_client = Mock()
        mock_boto3_client.return_value = mock_lambda_client
        mock_lambda_client.invoke.return_value = {
            'Payload': Mock(read=lambda: b'{"jsonrpc": "2.0", "id": 1, "result": {"success": true}}')
        }
        
        # Create test message
        json_rpc_msg = JSONRPCRequest(
            method="initialize",
            params={"protocolVersion": "2025-03-26", "capabilities": {}},
            jsonrpc="2.0",
            id=1
        )
        session_msg = SessionMessage(json_rpc_msg)
        
        # Test payload format (using inner message)
        expected_payload = session_msg.message.model_dump(by_alias=True, exclude_none=True)
        
        # Verify JSON-RPC structure
        self.assertEqual(expected_payload['method'], 'initialize')
        self.assertEqual(expected_payload['jsonrpc'], '2.0')
        self.assertEqual(expected_payload['id'], 1)
        self.assertIn('params', expected_payload)


class TestLambdaFunctionClientIntegration(unittest.TestCase):
    """Integration tests with actual Lambda function"""
    
    def setUp(self):
        """Setup test environment"""
        self.lambda_arn = os.environ.get('PY_MCP_LAMBDA_ARN')
        self.aws_region = os.environ.get('AWS_REGION', 'ap-northeast-1')
        
        if not self.lambda_arn:
            self.skipTest("PY_MCP_LAMBDA_ARN environment variable not set")
    
    def test_initialize_request(self):
        """Test initialize request to actual Lambda"""
        asyncio.run(self._test_initialize_request())
    
    async def _test_initialize_request(self):
        """Async test for initialize request"""
        params = LambdaFunctionParameters(
            function_name=self.lambda_arn,
            region_name=self.aws_region,
            mcp_server={
                "command": "uvx",
                "args": ["awslabs.aws-documentation-mcp-server@latest"]
            }
        )
        
        # Create initialize message
        init_msg = SessionMessage(JSONRPCRequest(
            method="initialize",
            params={"protocolVersion": "2025-03-26", "capabilities": {}},
            jsonrpc="2.0",
            id=1
        ))
        
        async with lambda_function_client(params) as (read_stream, write_stream):
            # Send initialize message
            await write_stream.send(init_msg)
            
            # Receive response
            response = await read_stream.receive()
            
            # Verify response
            self.assertIsInstance(response, SessionMessage)
            # Should not contain error
            response_str = str(response).lower()
            self.assertNotIn('error', response_str)
            print(f"Initialize response: {response}")
    
    def test_full_mcp_workflow(self):
        """Test complete MCP workflow"""
        asyncio.run(self._test_full_mcp_workflow())
    
    async def _test_full_mcp_workflow(self):
        """Test initialize -> list tools -> call tool workflow"""
        params = LambdaFunctionParameters(
            function_name=self.lambda_arn,
            region_name=self.aws_region,
            mcp_server={
                "command": "uvx",
                "args": ["awslabs.aws-documentation-mcp-server@latest"]
            }
        )
        
        async with lambda_function_client(params) as (read_stream, write_stream):
            # 1. Initialize
            init_msg = SessionMessage(JSONRPCRequest(
                method="initialize",
                params={"protocolVersion": "2025-03-26", "capabilities": {}},
                jsonrpc="2.0",
                id=1
            ))
            await write_stream.send(init_msg)
            init_response = await read_stream.receive()
            print(f"Initialize response: {init_response}")
            
            # 2. List tools
            tools_msg = SessionMessage(JSONRPCRequest(
                method="tools/list",
                params={},
                jsonrpc="2.0",
                id=2
            ))
            await write_stream.send(tools_msg)
            tools_response = await read_stream.receive()
            print(f"Tools response: {tools_response}")
            
            # 3. Call search tool
            search_msg = SessionMessage(JSONRPCRequest(
                method="tools/call",
                params={
                    "name": "search_documentation",
                    "arguments": {"search_phrase": "S3 bucket"}
                },
                jsonrpc="2.0",
                id=3
            ))
            await write_stream.send(search_msg)
            search_response = await read_stream.receive()
            print(f"Search response: {search_response}")
            
            # Verify all responses are successful
            for response in [init_response, tools_response, search_response]:
                response_str = str(response).lower()
                self.assertNotIn('error', response_str, f"Error in response: {response}")


class TestDebugPayloadFormat(unittest.TestCase):
    """Debug test to verify payload format"""
    
    def test_session_message_serialization(self):
        """Debug SessionMessage serialization"""
        # Create test message
        json_rpc_msg = JSONRPCRequest(
            method="initialize",
            params={"protocolVersion": "2025-03-26"},
            jsonrpc="2.0",
            id=0
        )
        session_msg = SessionMessage(json_rpc_msg)
        
        print(f"SessionMessage type: {type(session_msg)}")
        print(f"SessionMessage attributes: {dir(session_msg)}")
        print(f"SessionMessage: {session_msg}")
        
        # Check if SessionMessage has message attribute
        if hasattr(session_msg, 'message'):
            print(f"session_msg.message type: {type(session_msg.message)}")
            print(f"session_msg.message: {session_msg.message}")
            
            # Try to get model_dump from the inner message
            if hasattr(session_msg.message, 'model_dump'):
                payload = session_msg.message.model_dump(by_alias=True, exclude_none=True)
                print("Inner message payload format:")
                print(json.dumps(payload, indent=2))
                
                # Verify structure
                self.assertIn('method', payload)
                self.assertIn('jsonrpc', payload)
                self.assertIn('id', payload)
                self.assertEqual(payload['method'], 'initialize')
            else:
                print("Inner message has no model_dump method")
        else:
            print("SessionMessage has no message attribute")


if __name__ == '__main__':
    # Set test environment variables if not set
    if not os.environ.get('PY_MCP_LAMBDA_ARN'):
        print("Warning: PY_MCP_LAMBDA_ARN not set. Integration tests will be skipped.")
        print("Set environment variable: export PY_MCP_LAMBDA_ARN=arn:aws:lambda:region:account:function:your-lambda-name")
    
    unittest.main()
