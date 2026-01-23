# UC008 Lambda Event Format Fix - Implementation Complete

**Date**: 2026-01-23
**Status**: ✅ Successfully Deployed and Tested

## Problem Fixed

AgentCore Gateway was sending tool invocation events with only parameters, causing `Error: toolName is required`.

**Before Fix**:
```json
{"command": "aws cloudtrail describe-trails"}
{"query": "list all security groups"}
```

**After Fix**: Lambda detects tool type from parameter keys:
- `command` → call_aws
- `query` → suggest_aws_commands
- `task` → get_execution_plan

## Implementation

### File Modified
`examples/ja/ユースケース008_AWSセキュリティ監査/cdk/lib/lambda-tool/lambda_function.py`

**Key Changes**:
1. Removed `toolName` and `input` extraction logic
2. Added parameter-based tool detection
3. Pass entire event to handler functions
4. Updated error messages

### Lambda Handler (lines 11-43)
```python
def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for MCP tool proxy

    AgentCore Gateway sends tool parameters directly without toolName.
    Detect tool type based on parameter keys:
    - 'command' → call_aws
    - 'query' → suggest_aws_commands
    - 'task' → get_execution_plan
    """
    logger.info(f'Lambda invoked with event: {json.dumps(event)}')

    try:
        # Detect tool type from event parameters
        if 'command' in event:
            return handle_call_aws(event)
        elif 'query' in event:
            return handle_suggest_commands(event)
        elif 'task' in event:
            return handle_execution_plan(event)
        else:
            logger.error(f'Unknown event format: {event}')
            return {
                'content': [{'type': 'text', 'text': f'Error: Unknown event format. Expected "command", "query", or "task" parameter.'}],
                'isError': True
            }

    except Exception as e:
        logger.error(f'Unexpected error: {str(e)}', exc_info=True)
        return {
            'content': [{'type': 'text', 'text': f'Error: {str(e)}'}],
            'isError': True
        }
```

## Testing Results

### 1. CDK Deployment
```bash
✅ cdk deploy AwsSecurityAuditGatewayStack --require-approval never
   Deployment time: 47.74s
```

### 2. Direct Lambda Tests

#### call_aws Tool
```bash
aws lambda invoke --payload '{"command": "aws cloudtrail describe-trails --region ap-northeast-1"}'
```
**Result**: ✅ Success
```json
{
  "content": [{"type": "text", "text": "{\n    \"trailList\": [...]\n}"}],
  "isError": false
}
```

#### suggest_aws_commands Tool
```bash
aws lambda invoke --payload '{"query": "list all security groups"}'
```
**Result**: ✅ Success
```json
{
  "content": [{"type": "text", "text": "Suggested AWS CLI commands for 'list all security groups':\n\n1. aws help\n2. # No specific suggestions for: list all security groups"}],
  "isError": false
}
```

#### get_execution_plan Tool
```bash
aws lambda invoke --payload '{"task": "create a new S3 bucket with versioning enabled"}'
```
**Result**: ✅ Success
```json
{
  "content": [{"type": "text", "text": "Execution Plan for: create a new S3 bucket with versioning enabled\n\nThis is an experimental feature..."}],
  "isError": false
}
```

### 3. CloudWatch Logs Verification

**Recent logs** (2026-01-23 07:11 UTC):
```
[INFO] Lambda invoked with event: {"command": "aws cloudtrail describe-trails --region ap-northeast-1"}
[INFO] Executing AWS CLI command: aws cloudtrail describe-trails --region ap-northeast-1
[INFO] Command executed successfully

[INFO] Lambda invoked with event: {"query": "list all security groups"}
[INFO] Suggesting commands for query: list all security groups
```

**Key Observations**:
- ✅ No "Error: toolName is required" messages
- ✅ Events show direct parameter format
- ✅ All tools execute successfully
- ✅ Response format matches MCP standard

## Deployment Information

**Stack**: AwsSecurityAuditGatewayStack
**Lambda Function**: AwsSecurityAuditGatewayStack-McpProxyToolA5246F70-QGG5IMuDddCi
**Gateway ID**: uc8-gateway-uc008-lambda-faujxm5wpf
**Region**: ap-northeast-1

## Next Steps

### Ready for AgentCore Runtime Testing
The Lambda function is now ready to handle tool invocations from AgentCore Gateway. Test in Bedrock Agent console:

1. Open Bedrock Agent console
2. Navigate to Runtime using this Gateway
3. Test tool calls:
   - `call_aws`: Execute AWS CLI commands
   - `suggest_aws_commands`: Get command suggestions
   - `get_execution_plan`: Generate execution plans

### Expected Behavior
- Gateway sends `{"command": "aws cloudtrail describe-trails"}`
- Lambda detects `command` key → routes to `handle_call_aws()`
- Returns MCP-compliant response with `content` and `isError` fields

## Verification Checklist

- [x] Lambda function deploys successfully
- [x] Direct Lambda invocation with `{"command": "..."}` returns results
- [x] Direct Lambda invocation with `{"query": "..."}` returns suggestions
- [x] Direct Lambda invocation with `{"task": "..."}` returns execution plan
- [x] CloudWatch logs show successful tool executions
- [x] No "toolName is required" errors in logs
- [ ] AgentCore Runtime tool calls succeed (ready for manual testing)

## Root Cause Analysis

**Why the Issue Occurred**:
AgentCore Gateway's tool invocation format differs from initial assumptions. The Gateway passes tool parameters directly to Lambda without wrapping them in a `{"toolName": "...", "input": {...}}` structure.

**Why the Fix Works**:
By detecting tool type from parameter keys instead of expecting a `toolName` field, the Lambda function adapts to the Gateway's actual event format. This approach is more flexible and handles the Gateway's native format correctly.

## Related Documents
- DEPLOYMENT-SUCCESS-2026-01-16.md - Initial deployment success
- UC008-IAM-MIGRATION-SUCCESS.md - IAM auth migration
- FAILURE-ROOT-CAUSE.md - Previous Cognito domain issue analysis
