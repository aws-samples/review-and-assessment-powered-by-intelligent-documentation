#!/usr/bin/env python3
"""Test MCP tool integration with uvx"""
import os
import boto3
from agent import process_review


def get_config():
    """Get AWS configuration"""
    try:
        cfn = boto3.client("cloudformation")
        response = cfn.describe_stacks(StackName="RapidStack")
        outputs = {
            o["OutputKey"]: o["OutputValue"] for o in response["Stacks"][0]["Outputs"]
        }
        return {
            "document_bucket": outputs["DocumentBucketName"],
            "document_model_id": outputs["DocumentProcessingModelId"],
        }
    except:
        return {
            "document_bucket": os.environ.get("DOCUMENT_BUCKET", "test-bucket"),
            "document_model_id": os.environ.get(
                "DOCUMENT_PROCESSING_MODEL_ID",
                "global.anthropic.claude-sonnet-4-20250514-v1:0",
            ),
        }


def test_mcp_with_uvx():
    """Test MCP integration using uvx and AWS docs MCP server"""
    print("🧪 Testing MCP integration with AWS documentation server...")

    config = get_config()

    # Use real PDF from examples
    test_pdf = "../examples/ja/ユースケース003_車庫申請/申請書例.pdf"
    
    if not os.path.exists(test_pdf):
        print(f"❌ Test PDF not found: {test_pdf}")
        return

    # Upload to S3
    s3 = boto3.client("s3")
    test_key = "test/test_mcp_doc.pdf"
    s3.upload_file(test_pdf, config["document_bucket"], test_key)
    print(f"✅ Uploaded to S3: {test_key}")

    try:
        # MCP configuration - AWS documentation server via uvx
        mcp_config = [{"package": "awslabs.aws-documentation-mcp-server@latest"}]

        # Tool configuration with MCP
        tool_config = {"mcpConfig": mcp_config}

        result = process_review(
            document_bucket=config["document_bucket"],
            document_paths=[test_key],
            check_name="AWS Lambda Documentation Test",
            check_description="What is AWS Lambda? Search AWS documentation using MCP tools to find information about Lambda functions, their use cases, and key features.",
            language_name="English",
            model_id=config["document_model_id"],
            toolConfiguration=tool_config,
        )

        print(f"\n✅ Test completed successfully")
        print(f"   Result: {result.get('result')}")
        print(f"   Confidence: {result.get('confidence')}")

        if "explanation" in result:
            explanation = result["explanation"]
            print(f"   Explanation length: {len(explanation)} chars")
            print(f"   Explanation preview: {explanation[:300]}...")

        # Check if MCP tools were used
        if "verificationDetails" in result:
            sources = result["verificationDetails"].get("sourcesDetails", [])
            print(f"\n   📋 Tool usage:")
            print(f"      Total tool calls: {len(sources)}")

            mcp_tools_used = [
                s
                for s in sources
                if any(
                    mcp_tool in s.get("toolName", "")
                    for mcp_tool in [
                        "search_documentation",
                        "read_documentation",
                        "recommend",
                    ]
                )
            ]

            if mcp_tools_used:
                print(f"      ✅ MCP tools used: {len(mcp_tools_used)}")
                for tool in mcp_tools_used[:3]:  # Show first 3
                    print(f"         - {tool.get('toolName')}")
            else:
                print(f"      ⚠️  No MCP tools detected in tool history")
        else:
            print(f"\n   ❌ verificationDetails field missing!")

        if "reviewMeta" in result:
            meta = result["reviewMeta"]
            print(f"\n   💰 Cost:")
            print(
                f"      Tokens: {meta.get('input_tokens', 0)} input, {meta.get('output_tokens', 0)} output"
            )
            print(f"      Cost: ${meta.get('total_cost', 0):.6f}")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback

        traceback.print_exc()
    finally:
        # Cleanup
        try:
            s3.delete_object(Bucket=config["document_bucket"], Key=test_key)
            print(f"🧹 Cleaned up")
        except Exception as e:
            print(f"Cleanup error: {e}")


if __name__ == "__main__":
    test_mcp_with_uvx()
