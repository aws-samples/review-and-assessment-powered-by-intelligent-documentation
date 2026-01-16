---
name: deploy-cdk-stack
description: Deploy AWS infrastructure using CDK
---

# Deploy CDK Stack

This skill guides you through deploying the RAPID application to AWS using CDK.

**⚠️ IMPORTANT: Only execute when explicitly asked to "please deploy"**

## Prerequisites

### 1. AWS Credentials

```bash
# Verify AWS credentials are configured
aws sts get-caller-identity
```

### 2. Docker Running

```bash
# macOS: Ensure Docker Desktop is running
docker ps

# Linux: Ensure Docker service is active
sudo systemctl status docker
```

### 3. Build Backend

```bash
cd backend
npm ci
npm run prisma:generate
npm run build
```

### 4. Install CDK Dependencies

```bash
cd cdk
npm ci
```

## Deployment Sequence

### Full Deployment

```bash
# From project root

# 1. Prepare backend
cd backend
npm ci
npm run prisma:generate
npm run build

# 2. Install CDK dependencies
cd ../cdk
npm ci

# 3. Validate CDK synthesis (optional but recommended)
npx cdk synth

# 4. Deploy all stacks
npx cdk deploy --require-approval never --all
```

### First-Time Deployment

If this is the first deployment in a region:

```bash
cd cdk

# Bootstrap CDK in the target region
npx cdk bootstrap

# Then deploy
npx cdk deploy --require-approval never --all
```

## Parameter Customization

### Method 1: Edit parameter.ts File

Edit `cdk/lib/parameter.ts`:

```typescript
export const parameters = {
  // WAF IP restrictions
  allowedIpV4AddressRanges: [
    "192.168.0.0/16",  // Internal network
    "203.0.113.0/24"   // Office IP range
  ],

  // Bedrock configuration
  bedrockRegion: "ap-northeast-1",
  documentProcessingModelId: "apac.anthropic.claude-sonnet-4-20250514-v1:0",
  imageReviewModelId: "apac.amazon.nova-premier-v1:0",

  // Cognito settings
  cognitoSelfSignUpEnabled: false,  // Disable self-signup for production

  // Migration
  autoMigrate: false,  // Manual control in production
};
```

### Method 2: Command Line Parameters

```bash
# Single parameter (dot notation)
npx cdk deploy --context rapid.bedrockRegion="ap-northeast-1"

# Multiple parameters (JSON)
npx cdk deploy --context rapid='{"bedrockRegion":"us-west-2","documentProcessingModelId":"us.anthropic.claude-sonnet-4-20250514-v1:0"}'
```

### Parameter Precedence

1. **Command line** (highest priority)
2. **parameter.ts** file
3. **parameter-schema.ts** defaults (lowest priority)

## Deployment Scenarios

### Scenario 1: Code Changes Only

Backend or Lambda code updated, no infrastructure changes:

```bash
cd backend
npm run build

cd ../cdk
npx cdk deploy --require-approval never
```

### Scenario 2: Infrastructure Changes Only

CDK constructs modified, no code changes:

```bash
cd cdk
npx cdk synth  # Validate changes
npx cdk deploy --require-approval never
```

### Scenario 3: Database Schema Changes

Prisma schema modified:

```bash
# 1. Build backend with new schema
cd backend
npm run prisma:generate
npm run build

# 2. Deploy stack
cd ../cdk
npx cdk deploy --require-approval never

# 3. Run migration
MIGRATION_COMMAND=$(aws cloudformation describe-stacks \
  --stack-name RapidStack \
  --query "Stacks[0].Outputs[?OutputKey=='DeployMigrationCommand'].OutputValue" \
  --output text)
eval $MIGRATION_COMMAND
```

### Scenario 4: Full Stack Update

Everything updated:

```bash
# Build everything
cd backend
npm ci
npm run prisma:generate
npm run build

cd ../frontend
npm ci
npm run build

cd ../cdk
npm ci

# Deploy
npx cdk deploy --require-approval never --all

# Migrate if schema changed
MIGRATION_COMMAND=$(aws cloudformation describe-stacks \
  --stack-name RapidStack \
  --query "Stacks[0].Outputs[?OutputKey=='DeployMigrationCommand'].OutputValue" \
  --output text)
eval $MIGRATION_COMMAND
```

## Post-Deployment

### 1. Get Deployment Outputs

```bash
# Frontend URL
aws cloudformation describe-stacks \
  --stack-name RapidStack \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendURL'].OutputValue" \
  --output text

# API Endpoint
aws cloudformation describe-stacks \
  --stack-name RapidStack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text
```

### 2. Verify Health

```bash
# Test API health endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name RapidStack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)

curl $API_ENDPOINT/health
```

### 3. Check CloudWatch Logs

```bash
# View API Lambda logs
aws logs tail /aws/lambda/RapidStack-ApiHandler --follow

# View migration logs
aws logs tail /aws/lambda/RapidStack-MigrationFunction --follow
```

## Database Migration

### Automatic Migration

By default, migrations run automatically during deployment if `autoMigrate: true` in parameter.ts.

### Manual Migration

For production or critical environments:

```bash
# Get migration command from stack outputs
MIGRATION_COMMAND=$(aws cloudformation describe-stacks \
  --stack-name RapidStack \
  --query "Stacks[0].Outputs[?OutputKey=='DeployMigrationCommand'].OutputValue" \
  --output text)

# Execute migration
eval $MIGRATION_COMMAND
```

### Reset Database (Development Only)

**⚠️ WARNING: Deletes all data. NEVER run in production.**

```bash
# Get reset command from stack outputs
RESET_COMMAND=$(aws cloudformation describe-stacks \
  --stack-name RapidStack \
  --query "Stacks[0].Outputs[?OutputKey=='ResetMigrationCommand'].OutputValue" \
  --output text)

# Execute reset
eval $RESET_COMMAND
```

## Troubleshooting

### Docker Not Running

**Error**: `Cannot connect to Docker daemon`

**Solution**:
- macOS: Start Docker Desktop from Applications
- Linux: `sudo systemctl start docker`

### Lambda Package Size Exceeded

**Error**: `Unzipped size must be smaller than X bytes`

**Solutions**:
1. Check for large dependencies in package.json
2. Review CDK bundling configuration in lambda constructs
3. Consider using Lambda layers for large dependencies

### Migration Timeout

**Error**: `Migration lambda timed out`

**Solutions**:
1. Check CloudWatch Logs: `/aws/lambda/RapidStack-MigrationFunction`
2. Increase Lambda timeout in CDK (cdk/lib/constructs/...)
3. Run migration manually with increased timeout

### Stack Update Rollback

**Error**: `UPDATE_ROLLBACK_COMPLETE`

**Solutions**:
1. Check CloudFormation events in AWS Console for specific error
2. Review CloudWatch logs for Lambda errors
3. Fix underlying issue and redeploy

### Prisma Client Not Found

**Error**: `Cannot find module '@prisma/client'`

**Solution**:
```bash
cd backend
npm run prisma:generate
npm run build
cd ../cdk
npx cdk deploy
```

## CDK Commands Reference

| Command | Description |
|---------|-------------|
| `npx cdk synth` | Validate and synthesize CloudFormation templates |
| `npx cdk diff` | Show differences between current and deployed stack |
| `npx cdk deploy` | Deploy stack with approval prompts |
| `npx cdk deploy --require-approval never` | Deploy without prompts |
| `npx cdk deploy --all` | Deploy all stacks |
| `npx cdk list` | List all stacks in the app |
| `npx cdk bootstrap` | Bootstrap CDK in region (first-time only) |
| `npx cdk destroy` | Destroy stack (⚠️ dangerous) |

## Production Warnings

**⚠️ NEVER in Production**:
- Database reset commands
- `cdk destroy`
- `prisma db push` (use migrations only)
- `autoMigrate: true` (use manual control)

**✅ ALWAYS in Production**:
- Test in dev/staging first
- Review CloudFormation changeset before deployment
- Backup database before schema migrations
- Monitor CloudWatch logs during deployment
- Set `cognitoSelfSignUpEnabled: false`
- Use IP restrictions in WAF (`allowedIpV4AddressRanges`)

## Deployment Checklist

Pre-deployment:
- [ ] Backend builds successfully
- [ ] Frontend builds successfully (if changes)
- [ ] CDK synth passes
- [ ] Docker is running
- [ ] AWS credentials configured
- [ ] Parameters reviewed (parameter.ts)

Post-deployment:
- [ ] Stack deployed successfully
- [ ] Frontend URL accessible
- [ ] API health endpoint responds
- [ ] CloudWatch logs show no errors
- [ ] Database migration completed (if applicable)
- [ ] Cognito user pool configured correctly

## Verification Script

```bash
#!/bin/bash

# Get stack outputs
FRONTEND_URL=$(aws cloudformation describe-stacks \
  --stack-name RapidStack \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendURL'].OutputValue" \
  --output text)

API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name RapidStack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)

echo "Frontend URL: $FRONTEND_URL"
echo "API Endpoint: $API_ENDPOINT"

# Test API health
echo "Testing API health..."
curl -s $API_ENDPOINT/health | jq .

# Check recent logs
echo "Checking recent API logs..."
aws logs tail /aws/lambda/RapidStack-ApiHandler --since 5m
```

## Quick Reference

| Scenario | Command |
|----------|---------|
| Full deploy | `cd backend && npm run build && cd ../cdk && npx cdk deploy --all` |
| Code only | `cd backend && npm run build && cd ../cdk && npx cdk deploy` |
| Infra only | `cd cdk && npx cdk deploy` |
| With schema | Deploy + run migration command |
| Validate | `cd cdk && npx cdk synth` |
| Diff changes | `cd cdk && npx cdk diff` |

## Success Criteria

✅ **Deployment completed**: CloudFormation stack shows `CREATE_COMPLETE` or `UPDATE_COMPLETE`
✅ **Health check passes**: API endpoint responds with 200 OK
✅ **Frontend accessible**: CloudFront URL loads application
✅ **No errors in logs**: CloudWatch logs show no critical errors
✅ **Migration completed**: Database schema matches Prisma schema (if applicable)

## After Deployment

1. ✅ Stack deployed successfully
2. ✅ All services responding
3. ✅ Logs show no errors
4. Ready for testing or production use
5. Monitor CloudWatch metrics for any issues
