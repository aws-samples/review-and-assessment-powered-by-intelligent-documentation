#!/usr/bin/env python3
"""Test citation with real use case PDF"""
import json
import logging
import os

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

os.environ["AWS_REGION"] = "us-west-2"
os.environ["BEDROCK_REGION"] = "us-west-2"
os.environ["ENABLE_CITATIONS"] = "true"
os.environ["DOCUMENT_PROCESSING_MODEL_ID"] = "us.anthropic.claude-sonnet-4-20250514-v1:0"

from agent import _run_strands_agent_with_citations, _get_document_review_prompt_with_citations


def test_with_real_pdf():
    """Test with actual use case PDF"""
    
    # Use a real example PDF (relative to beacon root)
    pdf_path = "../examples/ja/ユースケース003_車庫申請/申請書例.pdf"
    
    if not os.path.exists(pdf_path):
        print(f"❌ PDF not found: {pdf_path}")
        return
    
    print(f"📄 Testing with: {pdf_path}")
    
    # Check relevant to the PDF
    check_name = "申請者氏名の記載確認"
    check_description = "申請書に申請者の氏名が明確に記載されていることを確認してください"
    
    prompt = _get_document_review_prompt_with_citations(
        language_name="日本語",
        check_name=check_name,
        check_description=check_description,
        tool_config=None
    )
    
    system_prompt = "You are an expert document reviewer. All responses must be in 日本語."
    
    print("\n🤖 Running agent...")
    
    result = _run_strands_agent_with_citations(
        prompt=prompt,
        file_paths=[pdf_path],
        model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
        system_prompt=system_prompt,
        toolConfiguration=None
    )
    
    print("\n📊 Result:")
    print(f"  result: {result.get('result')}")
    print(f"  confidence: {result.get('confidence')}")
    
    print("\n📝 Explanation:")
    explanation = result.get('explanation', 'N/A')
    print(f"  Length: {len(explanation)} chars")
    print(f"  Content: {explanation[:500]}")
    
    print("\n📚 Extracted Text:")
    extracted = result.get('extractedText', 'N/A')
    print(f"  Type: {type(extracted)}")
    if isinstance(extracted, str):
        print(f"  Length: {len(extracted)} chars")
        print(f"  Preview: {extracted[:500]}")
    
    print("\n💰 Cost:")
    if 'reviewMeta' in result:
        meta = result['reviewMeta']
        print(f"  ${meta.get('total_cost', 0):.6f}")


if __name__ == "__main__":
    test_with_real_pdf()
