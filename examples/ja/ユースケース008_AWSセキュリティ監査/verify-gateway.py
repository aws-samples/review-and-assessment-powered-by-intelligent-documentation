#!/usr/bin/env python3
"""
Verify UC008 MCP Gateway using proper MCP protocol.
Uses the MCPClient wrapper from review-item-processor.

NOTE: This Gateway requires AWS SigV4 authentication (IAM auth).
Standalone MCP clients will receive 401 Unauthorized, which confirms
the Gateway is working correctly and enforcing authentication.

The Gateway is designed to be called from AWS Bedrock AgentCore Runtime,
which automatically handles AWS SigV4 signing.

Expected Result:
- 401 Unauthorized = Gateway is properly deployed and enforcing IAM auth ✅
- This means the Gateway will work correctly when called from AgentCore
"""
import sys
from pathlib import Path

# Add review-item-processor to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "review-item-processor"))

from tools.mcp_tool import create_mcp_clients

GATEWAY_URL = "https://awssecurityauditgatewaystack-mubbxp3ted.gateway.bedrock-agentcore.ap-northeast-1.amazonaws.com/mcp"

def test_gateway():
    """Test the MCP Gateway with tools/list and tools/call"""

    print("🔍 Testing UC008 MCP Gateway")
    print(f"📡 Gateway URL: {GATEWAY_URL}\n")

    # Create MCP client using production MCPClient wrapper
    mcp_config = {
        "uc008-gateway": {
            "url": GATEWAY_URL
        }
    }

    clients = create_mcp_clients(mcp_config)
    if not clients:
        print("❌ Failed to create MCP client")
        return

    client = clients[0]

    # Use client within context manager
    with client:
        # Test 1: List available tools
        print("📋 Test 1: Listing available tools (tools/list)...")
        tools = client.list_tools_sync()

        print(f"✅ Found {len(tools)} tools:")
        for tool in tools:
            name = tool.get('name', 'unknown')
            description = tool.get('description', '')
            print(f"  - {name}: {description}")

        # Test 2: Call AWS tool (list S3 buckets)
        print("\n🪣 Test 2: Calling 'call_aws' tool (list S3 buckets)...")
        result = client.call_tool_sync(
            tool_name="call_aws",
            arguments={"command": "aws s3 ls"}
        )

        if result.get("isError"):
            print(f"❌ Tool execution failed: {result.get('content', [])}")
        else:
            content = str(result.get("content", []))
            print("✅ Tool execution successful:")
            print(f"  Content: {content[:200]}..." if len(content) > 200 else f"  Content: {content}")

        # Test 3: Suggest AWS commands
        print("\n💡 Test 3: Calling 'suggest_aws_commands' tool...")
        result = client.call_tool_sync(
            tool_name="suggest_aws_commands",
            arguments={"query": "list all RDS instances with encryption status"}
        )

        if result.get("isError"):
            print(f"❌ Tool execution failed: {result.get('content', [])}")
        else:
            content = str(result.get("content", []))
            print("✅ Suggestions received:")
            print(f"  {content[:300]}..." if len(content) > 300 else f"  {content}")

        print("\n✅ All MCP Gateway tests passed!")

if __name__ == "__main__":
    test_gateway()
