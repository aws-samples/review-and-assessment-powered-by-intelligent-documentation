#!/usr/bin/env python3
"""Real AWS integration test for process_review function"""
import boto3
import json
import os
from agent import process_review

def get_cfn_outputs():
    """Get required values from CloudFormation outputs"""
    cfn = boto3.client('cloudformation')
    response = cfn.describe_stacks(StackName='RapidStack')
    outputs = {o['OutputKey']: o['OutputValue'] for o in response['Stacks'][0]['Outputs']}
    
    return {
        'document_bucket': outputs['DocumentBucketName'],
        'temp_bucket': outputs['TempBucketName'],
        'bedrock_region': outputs['BedrockRegion'],
        'document_model_id': outputs['DocumentProcessingModelId'],
        'image_model_id': outputs['ImageReviewModelId'],
        'runtime_arn': outputs['AgentCoreRuntimeArn']
    }

def create_test_pdf():
    """Create minimal test PDF content"""
    content = """Test Document for Compliance Review

Company Information:
- Company Name: Test Corporation Ltd.
- Address: 123 Business Street, Test City, TC 12345
- Phone: +1-555-0123
- Email: contact@testcorp.com

This document contains the required company information for testing purposes.
The document includes all necessary details for compliance verification.
"""
    
    with open('sample.pdf', 'w') as f:
        f.write(content)
    
    return 'sample.pdf'

def test_process_review():
    """Test process_review with real AWS services"""
    print("🚀 Starting real AWS integration test...")
    
    # Get configuration from CloudFormation
    config = get_cfn_outputs()
    print(f"✅ Retrieved configuration from CloudFormation")
    print(f"   Document Bucket: {config['document_bucket']}")
    print(f"   Bedrock Region: {config['bedrock_region']}")
    print(f"   Model ID: {config['document_model_id']}")
    
    # Create and upload test file
    test_file = create_test_pdf()
    s3 = boto3.client('s3')
    test_key = f'test/{test_file}'
    s3.upload_file(test_file, config['document_bucket'], test_key)
    print(f"✅ Uploaded test file to S3: s3://{config['document_bucket']}/{test_key}")
    
    # Set environment variables
    os.environ.update({
        'DOCUMENT_BUCKET': config['document_bucket'],
        'TEMP_BUCKET': config['temp_bucket'],
        'BEDROCK_REGION': config['bedrock_region'],
        'DOCUMENT_PROCESSING_MODEL_ID': config['document_model_id'],
        'IMAGE_REVIEW_MODEL_ID': config['image_model_id']
    })
    
    # Execute test
    print("🔄 Executing process_review function...")
    result = process_review(
        document_bucket=config['document_bucket'],
        document_paths=[test_key],
        check_name='Company Information Verification',
        check_description='Verify that the document contains complete company information including name, address, and contact details',
        language_name='English',
        model_id=config['document_model_id'],
        mcpServers=[]
    )
    
    # Validate results
    assert 'result' in result, "Missing 'result' field"
    assert result['result'] in ['pass', 'fail'], f"Invalid result value: {result['result']}"
    assert 'confidence' in result, "Missing 'confidence' field"
    assert 0 <= result['confidence'] <= 1, f"Invalid confidence value: {result['confidence']}"
    
    print(f"✅ Test completed successfully!")
    print(f"   Result: {result['result']}")
    print(f"   Confidence: {result['confidence']:.2f}")
    print(f"   Explanation: {result.get('explanation', 'N/A')[:100]}...")
    
    # Cleanup
    s3.delete_object(Bucket=config['document_bucket'], Key=test_key)
    os.remove(test_file)
    print(f"🧹 Cleaned up test files")
    
    return result

if __name__ == '__main__':
    try:
        result = test_process_review()
        print("\n🎉 All tests passed!")
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
