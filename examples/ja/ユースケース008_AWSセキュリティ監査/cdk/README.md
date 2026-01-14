# AWS Security Audit Gateway - CDK Deployment

This CDK project deploys an independent AgentCore Gateway for UC008 (AWS Security Audit) using aws-api-mcp-server.

## Architecture

```
AgentCore Runtime (review-item-processor)
  └─> MCP Client calls Gateway with IAM auth
        └─> UC008 MCP Gateway
              └─> Lambda Tool (MCP proxy)
                    └─> aws-api-mcp-server (stdio)
                          └─> AWS APIs (12 read-only permissions)
```

## Prerequisites

- AWS CLI configured with credentials
- Node.js 18+ and npm
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Docker installed (for Lambda Docker image build)

## Deployment Steps

### 1. Install Dependencies

```bash
cd examples/ja/ユースケース008_AWSセキュリティ監査/cdk
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Bootstrap CDK (First Time Only)

```bash
npx cdk bootstrap
```

### 4. Deploy Stack

```bash
npx cdk deploy AwsSecurityAuditGatewayStack
```

### 5. Get Stack Outputs

After deployment, retrieve the stack outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name AwsSecurityAuditGatewayStack \
  --query 'Stacks[0].Outputs' \
  --output table
```

Expected outputs:
- **GatewayEndpoint**: Gateway URL
- **GatewayArn**: Gateway ARN for IAM permissions
- **GatewayId**: Gateway ID
- **McpConfiguration**: Ready-to-copy MCP config JSON
- **IamPermissionRequired**: Permission to add to AgentCore Runtime

## Configuration

### 1. Add IAM Permission to AgentCore Runtime

The AgentCore Runtime needs permission to invoke the Gateway. Add this to `cdk/lib/constructs/agent.ts`:

```typescript
// Gateway呼び出し権限（UC008 AWS Security Audit Gateway用）
role.addToPolicy(
  new PolicyStatement({
    sid: 'InvokeGatewayForAwsSecurityAudit',
    effect: Effect.ALLOW,
    actions: ['bedrock-agentcore:InvokeGateway'],
    resources: [
      `arn:aws:bedrock-agentcore:${region}:${accountId}:gateway/aws-security-audit-gateway-*`,
    ],
  })
);
```

Then redeploy the main CDK stack:

```bash
cd ../../../../cdk
npm run build
npx cdk deploy RapidStack
```

### 2. Create Tool Configuration

1. Copy the `McpConfiguration` output from the stack
2. In RAPID UI, go to Tool Configuration and create new configuration
3. Paste the MCP configuration:

```json
{
  "aws-security-audit-gateway": {
    "url": "https://xxx.gateway.bedrock-agentcore.us-west-2.amazonaws.com"
  }
}
```

4. Preview to verify 3 tools are available:
   - `call_aws`
   - `suggest_aws_commands`
   - `get_execution_plan`

### 3. Use in Checklist

1. Upload UC008 checklist (AWSセキュリティ監査チェックリスト.pdf)
2. Assign the Tool Configuration created above
3. Upload review documents (AWSアカウント利用申請書.pdf)
4. Run review - AgentCore Runtime will call the Gateway with AWS API tools

## Stack Outputs Explained

### McpConfiguration
Ready-to-copy JSON for Tool Configuration UI:
```json
{
  "aws-security-audit-gateway": {
    "url": "https://xxx.gateway.bedrock-agentcore.us-west-2.amazonaws.com"
  }
}
```

### IamPermissionRequired
Permission to add to AgentCore Runtime role:
```json
{
  "Action": "bedrock-agentcore:InvokeGateway",
  "Resource": "arn:aws:bedrock-agentcore:us-west-2:123456789:gateway/aws-security-audit-gateway-xxxxx"
}
```

## Lambda Tool Details

The Lambda Tool acts as an MCP proxy:
- **Runtime**: Node.js 22 + Python 3.13
- **Architecture**: ARM64
- **Timeout**: 60 seconds
- **Memory**: 512 MB
- **Environment**:
  - `HOME=/tmp` - Redirects aws-api-mcp-server writes to /tmp
  - `AWS_CONFIG_FILE=/tmp/.aws/config`
  - `UV_CACHE_DIR=/tmp/.uv`

### IAM Permissions (12 AWS APIs)
- `rds:DescribeDBInstances` - RDS encryption status
- `s3:ListBuckets`, `s3:GetPublicAccessBlock` - S3 public access
- `iam:ListUsers`, `iam:ListMFADevices`, `iam:GetAccountPasswordPolicy` - IAM security
- `cloudtrail:DescribeTrails`, `cloudtrail:GetTrailStatus` - CloudTrail logging
- `ec2:DescribeVpcs`, `ec2:DescribeFlowLogs`, `ec2:DescribeSecurityGroups`, `ec2:DescribeVolumes` - VPC and EC2 security
- `config:DescribeConfigurationRecorders`, `config:DescribeConfigurationRecorderStatus` - AWS Config
- `guardduty:ListDetectors`, `guardduty:GetDetector` - GuardDuty threat detection

## Verification

### 1. Check Gateway Deployment

```bash
aws bedrock-agentcore get-gateway \
  --gateway-id <GatewayId from output>
```

### 2. Check Lambda Function

```bash
aws lambda get-function \
  --function-name AwsSecurityAuditGatewayStack-McpProxyTool
```

### 3. Test Lambda Locally (Optional)

```bash
cd lib/lambda-tool
npm install
npm run build
```

## Troubleshooting

### Error: "No space left on device"
**Cause**: Docker image build filling up disk
**Solution**: Clean up Docker: `docker system prune -a`

### Error: "Failed to load tool schema"
**Cause**: tool-schema.json not found or invalid
**Solution**: Verify `lib/lambda-tool/tool-schema.json` exists and is valid JSON

### Lambda Error: "FileNotFoundError: /home/sbx_user1051/.aws"
**Cause**: `HOME` environment variable not set correctly
**Solution**: Verify Dockerfile sets `ENV HOME=/tmp`

### Gateway Not Accessible
**Check**:
1. Gateway deployment status in AWS Console
2. AgentCore Runtime has `bedrock-agentcore:InvokeGateway` permission
3. Gateway ARN matches in IAM policy

## Clean Up

To delete all resources:

```bash
cd examples/ja/ユースケース008_AWSセキュリティ監査/cdk
npx cdk destroy AwsSecurityAuditGatewayStack
```

**Note**: This will delete:
- AgentCore Gateway
- Lambda function and Docker image
- IAM roles (created by CDK)

## Architecture Benefits

1. **Isolation**: Completely independent from main RAPID stack
2. **Security**: IAM authentication, no API keys needed
3. **Write Permissions**: Solved with `HOME=/tmp` environment variable
4. **Direct MCP**: Uses aws-api-mcp-server without wrapping
5. **Extensibility**: Easy to add more tools or modify permissions

## Related Documentation

- [AgentCore Gateway Implementation](../../../../agentcore-gateway/README.md)
- [MCP Protocol Documentation](https://github.com/awslabs/mcp)
- [aws-api-mcp-server](https://github.com/awslabs/mcp/tree/main/src/aws-api-mcp-server)

---

**For support**: Refer to the main RAPID documentation and AWS Bedrock AgentCore documentation.
