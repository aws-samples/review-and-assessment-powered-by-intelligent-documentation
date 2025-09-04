#!/usr/bin/env python3
"""
Local test for process_review function with citation functionality

Run with: poetry run pytest tests/test_citation.py -v
"""
import os
import sys
import tempfile
import shutil
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def setup_test_environment():
    """Setup test environment variables"""
    os.environ["ENABLE_CITATIONS"] = "true"
    os.environ["BEDROCK_REGION"] = "us-west-2"
    os.environ["DOCUMENT_PROCESSING_MODEL_ID"] = "us.anthropic.claude-3-7-sonnet-20250219-v1:0"
    os.environ["IMAGE_REVIEW_MODEL_ID"] = "us.anthropic.claude-3-7-sonnet-20250219-v1:0"
    
    print("Environment variables set:")
    print(f"  ENABLE_CITATIONS: {os.environ.get('ENABLE_CITATIONS')}")
    print(f"  BEDROCK_REGION: {os.environ.get('BEDROCK_REGION')}")
    print(f"  DOCUMENT_MODEL: {os.environ.get('DOCUMENT_PROCESSING_MODEL_ID')}")

def test_citation_functionality():
    """Test citation functionality with local PDF file"""
    
    # Setup environment
    setup_test_environment()
    
    # Create temporary directory and copy test file
    temp_dir = tempfile.mkdtemp()
    test_pdf_path = Path(__file__).parent / "office_planning.pdf"
    
    if not test_pdf_path.exists():
        print(f"Error: Test file not found at {test_pdf_path}")
        return
    
    # Copy to temp directory with a simple name
    temp_pdf_path = Path(temp_dir) / "office_planning.pdf"
    shutil.copy2(test_pdf_path, temp_pdf_path)
    
    print(f"Test file copied to: {temp_pdf_path}")
    
    try:
        # Test parameters
        check_name = "保管スペース確保"
        check_description = "指定エリア内に整理保管され、避難経路を塞いでいない"
        
        print(f"\nTesting with:")
        print(f"  Check Name: {check_name}")
        print(f"  Check Description: {check_description}")
        print(f"  File: {temp_pdf_path}")
        
        # Mock S3 by using local file paths directly
        # We'll modify process_review to handle local files for testing
        result = test_process_review_local(
            document_paths=[str(temp_pdf_path)],
            check_name=check_name,
            check_description=check_description,
            language_name="日本語",
            mcpServers=[]
        )
        
        print("\n" + "="*50)
        print("RESULT:")
        print("="*50)
        print(f"Status: {result.get('result', 'unknown')}")
        print(f"Confidence: {result.get('confidence', 0)}")
        print(f"Explanation: {result.get('explanation', 'No explanation')}")
        print(f"Short Explanation: {result.get('shortExplanation', 'No short explanation')}")
        
        if 'extractedText' in result:
            print(f"\nExtracted Text (Citations):")
            print("-" * 30)
            print(result['extractedText'])
        
        if 'reviewMeta' in result:
            meta = result['reviewMeta']
            print(f"\nToken Usage:")
            print(f"  Input: {meta.get('input_tokens', 0)}")
            print(f"  Output: {meta.get('output_tokens', 0)}")
            print(f"  Cost: ${meta.get('total_cost', 0):.6f}")
        
        # Assertions for pytest
        assert result.get('result') in ['pass', 'fail']
        assert 0 <= result.get('confidence', 0) <= 1
        assert result.get('explanation', '') != ''
        
    except Exception as e:
        print(f"Error during test: {e}")
        import traceback
        traceback.print_exc()
        raise
    
    finally:
        # Cleanup
        shutil.rmtree(temp_dir)
        print(f"\nCleaned up temp directory: {temp_dir}")

def test_process_review_local(document_paths, check_name, check_description, language_name, mcpServers):
    """Modified process_review for local testing without S3"""
    from agent import (
        get_document_review_prompt, 
        _run_strands_agent_with_citations, 
        _run_strands_agent_legacy,
        supports_citations,
        ENABLE_CITATIONS,
        DOCUMENT_MODEL_ID,
        IMAGE_MODEL_ID,
        IMAGE_FILE_EXTENSIONS
    )
    from strands_tools import file_read, image_reader
    import logging
    
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    logger.info(f"Testing with {len(document_paths)} files")
    
    # Check file types
    has_images = False
    for path in document_paths:
        ext = os.path.splitext(path)[1].lower()
        if ext in IMAGE_FILE_EXTENSIONS:
            has_images = True
            break
    
    # Select model and prompt
    if has_images:
        selected_model_id = IMAGE_MODEL_ID
        from agent import get_image_review_prompt
        prompt = get_image_review_prompt(
            language_name, check_name, check_description, selected_model_id
        )
        tools = [file_read, image_reader]
        use_citations = False
    else:
        selected_model_id = DOCUMENT_MODEL_ID
        use_citations = ENABLE_CITATIONS and supports_citations(selected_model_id)
        
        prompt = get_document_review_prompt(
            language_name, check_name, check_description, use_citations=use_citations
        )
        tools = [file_read]
    
    logger.info(f"Using model: {selected_model_id}")
    logger.info(f"Citations enabled: {use_citations}")
    
    # System prompt
    system_prompt = f"You are an expert document reviewer. Analyze the provided files and evaluate the check item. All responses must be in {language_name}."
    
    # Run agent
    if use_citations:
        result = _run_strands_agent_with_citations(
            prompt=prompt,
            file_paths=document_paths,
            model_id=selected_model_id,
            system_prompt=system_prompt,
            mcpServers=mcpServers,
        )
    else:
        result = _run_strands_agent_legacy(
            prompt=prompt,
            file_paths=document_paths,
            model_id=selected_model_id,
            system_prompt=system_prompt,
            base_tools=tools,
            mcpServers=mcpServers,
        )
    
    # Add missing fields
    if "result" not in result:
        result["result"] = "fail"
    if "confidence" not in result:
        result["confidence"] = 0.5
    if "explanation" not in result:
        result["explanation"] = "No explanation provided"
    if "shortExplanation" not in result:
        result["shortExplanation"] = "No short explanation provided"
    if "verificationDetails" not in result:
        result["verificationDetails"] = {"sourcesDetails": []}
    
    if has_images:
        result["reviewType"] = "IMAGE"
        if "usedImageIndexes" not in result:
            result["usedImageIndexes"] = []
        if "boundingBoxes" not in result:
            result["boundingBoxes"] = []
    else:
        result["reviewType"] = "PDF"
        if "extractedText" not in result:
            result["extractedText"] = ""
        if "pageNumber" not in result:
            result["pageNumber"] = 1
    
    return result

if __name__ == "__main__":
    test_citation_functionality()
