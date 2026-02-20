---
name: deploy-cdk-stack
description: Deploy RAPID application AWS infrastructure using CDK, including stack deployment, database migrations, and post-deployment verification. Use when explicitly asked to deploy, when running CDK bootstrap for first-time setup, or when deploying after code or infrastructure changes. Only execute when user says "please deploy".
---

# Deploy CDK Stack

**Only execute when explicitly asked to "please deploy".**

## Prerequisites

```bash
aws sts get-caller-identity    # AWS credentials configured
docker ps                      # Docker running
cd backend && npm ci && npm run prisma:generate && npm run build  # Backend built
cd ../cdk && npm ci            # CDK dependencies installed
```

## Deployment Sequence

### Quick Deploy (Recommended)

```bash
cd cdk
npm run deploy
```

### Full Deployment (Manual Steps)

```bash
cd backend && npm ci && npm run prisma:generate && npm run build
cd ../cdk && npm ci
npx cdk synth                              # Validate (optional)
npx cdk deploy --require-approval never --all
```

### First-Time Deployment

```bash
cd cdk
npx cdk bootstrap
npx cdk deploy --require-approval never --all
```

## Parameter Customization

### Edit parameter.ts

```typescript
// cdk/lib/parameter.ts
export const parameters = {
  allowedIpV4AddressRanges: ["192.168.0.0/16"],
  bedrockRegion: "ap-northeast-1",
  documentProcessingModelId: "apac.anthropic.claude-sonnet-4-20250514-v1:0",
  cognitoSelfSignUpEnabled: false,
  autoMigrate: false,
};
```

### Command Line Parameters

```bash
npx cdk deploy -c rapid.bedrockRegion="ap-northeast-1"
npx cdk deploy -c rapid='{"bedrockRegion":"us-west-2","documentProcessingModelId":"us.anthropic.claude-sonnet-4-20250514-v1:0"}'
```

Precedence: Command line > parameter.ts > parameter-schema.ts defaults

## Deployment Scenarios

| Scenario | Commands |
|----------|----------|
| Code only | `cd backend && npm run build && cd ../cdk && npx cdk deploy` |
| Infra only | `cd cdk && npx cdk deploy` |
| Schema change | Deploy + run migration command (see below) |
| Full stack | Build all + `npx cdk deploy --require-approval never --all` |

## Post-Deployment

```bash
# Get URLs
aws cloudformation describe-stacks --stack-name RapidStack \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendURL'].OutputValue" --output text

aws cloudformation describe-stacks --stack-name RapidStack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text
```

## Database Migration

### Manual Migration

```bash
MIGRATION_COMMAND=$(aws cloudformation describe-stacks \
  --stack-name RapidStack \
  --query "Stacks[0].Outputs[?OutputKey=='DeployMigrationCommand'].OutputValue" \
  --output text)
eval $MIGRATION_COMMAND
```

## CDK Commands

| Command | Description |
|---------|-------------|
| `npx cdk synth` | Validate and synthesize templates |
| `npx cdk diff` | Show changes vs deployed stack |
| `npx cdk deploy --require-approval never` | Deploy without prompts |
| `npx cdk deploy --all` | Deploy all stacks |
| `npx cdk bootstrap` | Bootstrap CDK (first-time only) |

## Production Warnings

**NEVER in production**: Database reset, `cdk destroy`, `prisma db push`, `autoMigrate: true`

**ALWAYS in production**: Test in staging first, review changeset, backup DB before migrations, monitor CloudWatch logs.

## Success Criteria

- CloudFormation stack shows `CREATE_COMPLETE` or `UPDATE_COMPLETE`
- API health endpoint responds with 200 OK
- CloudFront URL loads application
- CloudWatch logs show no critical errors
- Database migration completed (if applicable)
