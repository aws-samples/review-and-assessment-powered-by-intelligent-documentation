#!/usr/bin/env python3
"""Test code interpreter with numerical PDF data"""
import os
import urllib.request

import boto3
from agent import process_review


def download_numerical_pdf():
    """Download PDF with numerical data"""
    # Try multiple sources with numerical data
    urls = [
        "https://www.irs.gov/pub/irs-pdf/f1040.pdf",  # IRS form with numbers
        "https://www.census.gov/content/dam/Census/library/publications/2020/demo/p60-270.pdf",  # Census data
        "https://www.bls.gov/news.release/pdf/empsit.pdf",  # Employment statistics
    ]

    filename = "numerical_data.pdf"

    for i, url in enumerate(urls):
        try:
            print(f"Trying URL {i+1}: {url}")
            urllib.request.urlretrieve(url, filename)
            print(f"✅ Downloaded: {filename}")
            return filename
        except Exception as e:
            print(f"Failed: {e}")
            continue

    print("❌ All downloads failed")
    return None


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
            "bedrock_region": outputs["BedrockRegion"],
            "document_model_id": outputs["DocumentProcessingModelId"],
        }
    except:
        return {
            "document_bucket": os.environ.get("DOCUMENT_BUCKET", "test-bucket"),
            "bedrock_region": os.environ.get("BEDROCK_REGION", "us-west-2"),
            "document_model_id": os.environ.get(
                "DOCUMENT_PROCESSING_MODEL_ID",
                "global.anthropic.claude-sonnet-4-20250514-v1:0",
            ),
        }


def test_code_interpreter_with_numbers():
    """Test code interpreter with numerical PDF"""
    print("🧮 Testing code interpreter with numerical PDF...")

    # Enable code interpreter
    os.environ["ENABLE_CODE_INTERPRETER"] = "true"

    config = get_config()
    pdf_file = download_numerical_pdf()

    if not pdf_file:
        print("❌ No PDF downloaded")
        return

    # Upload to S3
    s3 = boto3.client("s3")
    test_key = f"test/{pdf_file}"
    s3.upload_file(pdf_file, config["document_bucket"], test_key)
    print(f"✅ Uploaded to S3: {test_key}")

    # Test with code interpreter for numerical analysis
    try:
        result = process_review(
            document_bucket=config["document_bucket"],
            document_paths=[test_key],
            check_name="Numerical Data Analysis",
            check_description="Extract all numerical values from this document and perform statistical analysis. Calculate totals, averages, and identify patterns in the data. Use code interpreter to process the numbers and provide computational analysis with Python code to verify your answers.",
            # language_name="English",
            language_name="Japanese",
            model_id=config["document_model_id"],
            mcpServers=[],
        )

        print(f"✅ Code interpreter test with numbers completed")
        print(f"   Result: {result.get('result')}")
        print(f"   Confidence: {result.get('confidence')}")

        if "explanation" in result:
            explanation = result["explanation"]
            print(f"   Explanation length: {len(explanation)} chars")
            print(f"   Explanation preview: {explanation[:300]}...")

            # Check if code was used
            if any(
                keyword in explanation.lower()
                for keyword in [
                    "calculate",
                    "computation",
                    "analysis",
                    "statistics",
                    "total",
                    "average",
                ]
            ):
                print("   ✅ Appears to include computational analysis")
            else:
                print("   ⚠️  May not have used code interpreter")

        if "reviewMeta" in result:
            meta = result["reviewMeta"]
            print(
                f"   Tokens: {meta.get('input_tokens', 0)} input, {meta.get('output_tokens', 0)} output"
            )
            print(f"   Cost: ${meta.get('total_cost', 0):.6f}")

        # Check verificationDetails
        if "verificationDetails" in result:
            verification = result["verificationDetails"]
            sources = verification.get("sourcesDetails", [])
            print(f"\n   📋 verificationDetails:")
            print(f"      sourcesDetails count: {len(sources)}")
            if sources:
                import json

                for i, source in enumerate(sources):
                    print(f"      [{i}] {json.dumps(source, indent=10)}")
            else:
                print(f"      ⚠️  No sources recorded")
        else:
            print(f"\n   ❌ verificationDetails field missing!")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback

        traceback.print_exc()

    # Cleanup
    try:
        s3.delete_object(Bucket=config["document_bucket"], Key=test_key)
        os.remove(pdf_file)
        print(f"🧹 Cleaned up")
    except Exception as e:
        print(f"Cleanup error: {e}")


if __name__ == "__main__":
    test_code_interpreter_with_numbers()
