#!/usr/bin/env python3
"""
Test script to invoke real AgentCore runtime with same payload as Lambda
"""
import json
import os
import boto3
from botocore.exceptions import ClientError

def test_agentcore_runtime():
    """Test the real AgentCore runtime with the same payload"""
    
    # Same payload as the Lambda receives
    agent_payload = {
        "reviewJobId": "01K9BSW8TAVRJN25V74ED0GZPE",
        "checkId": "01K99NMC9Y85GXR0C082JRN36T",
        "reviewResultId": "01K9BSW8TA6VMK0YG82FA93G45",
        "documentPaths": ["review/original/01K9BSW4D3BWQV5ZA61B0HAQE6/審査対象書類.pdf"],
        "checkName": "面積計算の整合性",
        "checkDescription": "床面積求積図・建築面積求積図の面積合算と住宅の外皮平均熱貫流率及び平均日射熱取得率計算書の整合性が取れていることを確認する",
        "languageName": "Japanese",
        "mcpServers": []
    }
    
    # Get environment variables (same as Lambda)
    agent_runtime_arn = os.environ.get('AGENT_RUNTIME_ARN')
    aws_region = os.environ.get('AWS_REGION', 'ap-northeast-1')
    
    if not agent_runtime_arn:
        print("ERROR: AGENT_RUNTIME_ARN environment variable not set")
        print("Please set: export AGENT_RUNTIME_ARN=arn:aws:bedrock-agentcore:ap-northeast-1:151364017355:runtime/RapidStackReviewessorReviewAgent82551766-TsZekOF05m")
        return
    
    print("=== Testing Real AgentCore Runtime ===")
    print(f"Agent Runtime ARN: {agent_runtime_arn}")
    print(f"AWS Region: {aws_region}")
    print(f"Payload: {json.dumps(agent_payload, indent=2, ensure_ascii=False)}")
    
    # Create bedrock-agentcore client
    try:
        client = boto3.client('bedrock-agentcore', region_name=aws_region)
        print(f"✓ Created bedrock-agentcore client for region: {aws_region}")
    except Exception as e:
        print(f"✗ Failed to create client: {e}")
        return
    
    # Transform reviewJobId to meet 33+ character requirement (same as Lambda)
    review_job_id = agent_payload["reviewJobId"]
    runtime_session_id = review_job_id.ljust(33, '0')
    print(f"Runtime Session ID: {runtime_session_id} (length: {len(runtime_session_id)})")
    
    try:
        print("\n=== Invoking AgentCore Runtime ===")
        response = client.invoke_agent_runtime(
            agentRuntimeArn=agent_runtime_arn,
            runtimeSessionId=runtime_session_id,
            payload=json.dumps(agent_payload).encode('utf-8'),
            contentType='application/json',
            accept='application/json'
        )
        
        print("✓ AgentCore invocation successful!")
        print(f"Status Code: {response.get('statusCode')}")
        print(f"Content Type: {response.get('contentType')}")
        print(f"Runtime Session ID: {response.get('runtimeSessionId')}")
        
        # Read the streaming response
        if 'response' in response:
            print("\n=== Reading Response Stream ===")
            response_body = b''
            for chunk in response['response']:
                response_body += chunk
            
            response_text = response_body.decode('utf-8')
            print(f"Response: {response_text}")
            
            try:
                parsed_response = json.loads(response_text)
                print(f"Parsed Response: {json.dumps(parsed_response, indent=2, ensure_ascii=False)}")
            except json.JSONDecodeError:
                print("Response is not valid JSON")
        
        return response
        
    except ClientError as e:
        print(f"✗ AWS Client Error: {e}")
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        print(f"Error Code: {error_code}")
        print(f"Error Message: {error_message}")
        
        if error_code == 'RuntimeClientError':
            print("\n=== RuntimeClientError Troubleshooting ===")
            print("This usually means the agent runtime failed to start.")
            print("Check CloudWatch logs at: /aws/bedrock-agentcore/runtimes/[runtime-name]")
            print("Common causes:")
            print("- Docker image build failures")
            print("- Missing Python dependencies")
            print("- Import errors in agent code")
            print("- Environment variable issues")
            
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        import traceback
        print(f"Traceback:\n{traceback.format_exc()}")

if __name__ == "__main__":
    print("Required environment variables:")
    print("  export AGENT_RUNTIME_ARN=arn:aws:bedrock-agentcore:ap-northeast-1:151364017355:runtime/RapidStackReviewessorReviewAgent82551766-TsZekOF05m")
    print("  export AWS_REGION=ap-northeast-1")
    print()
    
    test_agentcore_runtime()
