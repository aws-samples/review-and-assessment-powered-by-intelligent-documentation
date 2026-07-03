# Review & Assessment Powered by Intelligent Documentation (RAPID)

[English](README.md) | [日本語](./docs/ja/README_ja.md)

This sample is a document review solution powered by generative AI (Amazon Bedrock). It streamlines review processes involving extensive documents and complex checklists using a Human in the Loop approach. It supports the entire process from checklist structuring to AI-assisted review and final human judgment, reducing review time and improving quality.

![](./docs/imgs/en_summary.png)

> [!Important]
> This tool is intended only for decision support and does not provide professional judgment or legal advice. All final judgments must be made by qualified human experts.

> [!Warning]
> This sample may undergo breaking changes without prior notice.

## Key Use Cases

### Product Specification Compliance Review

Efficiently verify that product development specifications meet requirements and industry standards. Automate the process of comparing thousands of specifications annually against hundreds of checkpoints. AI extracts and structures relevant information from specifications, visualizing compliance results. Reviewers can efficiently perform final verification.

### Technical Manual Quality Verification

Verify that complex technical manuals comply with internal guidelines and industry standards. Support the process of comparing tens of thousands of pages of technical documentation annually against thousands of quality criteria. Automatically detect missing technical information and inconsistencies, supporting the creation of consistent, high-quality manuals.

### Procurement Document Compliance Verification

Check that procurement documents and proposals meet necessary requirements. Automatically extract required information from documents spanning hundreds of pages, streamlining thousands of document reviews annually. Improve procurement process speed and accuracy by having humans verify compliance results against requirement lists.

## Screenshots

![](./docs/imgs/en_new_review.png)
![](./docs/imgs/en_new_review_floor_plan.png)
![](./docs/imgs/en_review_result.png)
![](./docs/imgs/en_review_result_ng.png)

## Deployment Methods

There are two methods for deployment:

### 1. Deployment Using CloudShell (For Those Who Want to Start Easily)

This method allows you to deploy directly from your browser using AWS CloudShell without preparing a local environment.

1. **Enable Amazon Bedrock Models**

   Access Bedrock Model Access from the AWS Management Console and enable access to the following models:

   - Anthropic Claude 3.7 Sonnet
   - Amazon Nova Premier

   By default, the Oregon (us-west-2) region is used, but you can change it with the `--bedrock-region` option.

2. **Open AWS CloudShell**

   Open [AWS CloudShell](https://console.aws.amazon.com/cloudshell/home) in the region where you want to deploy.

3. **Run the Deployment Script**

   ```bash
   wget -O - https://raw.githubusercontent.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation/main/bin.sh | bash
   ```

   This one-liner command automatically executes everything from repository cloning to deployment.

4. **Specify Custom Parameters (Optional)**

   ```bash
   wget -O - https://raw.githubusercontent.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation/main/bin.sh | bash -s -- --ipv4-ranges '["192.168.0.0/16"]'
   ```

   Available options:

   - `--ipv4-ranges`: IPv4 address ranges to allow in the frontend WAF (JSON array format)
   - `--ipv6-ranges`: IPv6 address ranges to allow in the frontend WAF (JSON array format)
   - `--disable-ipv6`: Disable IPv6 support
   - `--auto-migrate`: Whether to automatically run database migration during deployment
   - `--cognito-self-signup`: Whether to enable self-signup for the Cognito User Pool (true/false)
   - `--cognito-user-pool-id`: Existing Cognito User Pool ID (creates new if not specified)
   - `--cognito-user-pool-client-id`: Existing Cognito User Pool Client ID (creates new if not specified)
   - `--cognito-domain-prefix`: Prefix for the Cognito domain (auto-generated if not specified)
   - `--s3-api-gateway-frontend`: Serve the SPA from S3 via a REGIONAL API Gateway instead of CloudFront (true/false)
   - `--closed-network`: Deploy fully private (isolated subnets, VPC endpoints, PRIVATE API Gateways); implies `--s3-api-gateway-frontend` (true/false)
   - `--agentcore-network-mode`: AgentCore Runtime network mode when closed (`PUBLIC` = internet access / MCP works, `VPC` = full isolation). Default: `PUBLIC`
   - `--bedrock-region`: Region to use for Amazon Bedrock (default: us-west-2)
   - `--document-model`: AI model ID for document processing (default: global.anthropic.claude-sonnet-4-6)
   - `--image-model`: AI model ID for image review processing (default: global.anthropic.claude-sonnet-4-6)
   - `--repo-url`: URL of the repository to deploy
   - `--branch`: Branch name to deploy
   - `--tag`: Deploy a specific Git tag

5. **Post-Deployment Verification**

   Upon completion of the deployment, the frontend URL and API URL will be displayed.
   Access the displayed URL to start using the application.

> [!Important]
> With this deployment method, if you do not set option parameters, anyone who knows the URL can sign up. For production use, we strongly recommend adding IP address restrictions and disabling self-signup (`--cognito-self-signup=false`).

### 2. Deployment from Local Environment (Recommended for Customization)

- Clone this repository

```
git clone https://github.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation.git
cd review-and-assessment-powered-by-intelligent-documentation
```

- Edit [parameter.ts](./cdk/lib/parameter.ts) as needed. See [Parameter Customization](#parameter-customization) for details.
- Before deploying CDK, you need to bootstrap once for the target region.

```
cd cdk
npx cdk bootstrap
```

- Deploy (builds all packages and deploys automatically)

```
npm run deploy
```

<details><summary>Manual step-by-step deployment</summary>

```bash
# Prepare the backend
cd backend
npm ci
npm run prisma:generate
npm run build

# Install CDK packages and deploy
cd ../cdk
npm ci
npx cdk deploy --require-approval never --all
```

</details>

- You will see output like the following. Access the Web application URL displayed in `RapidStack.FrontendURL` from your browser.

```sh
 ✅  RapidStack

✨  deployment time: 78.57s

Output:
...
RapidStack.FrontendURL = https://xxxxx.cloudfront.net
```

## Parameter Customization

The following parameters can be customized during CDK deployment:

| Parameter Group           | Parameter Name                | Description                                                                                                                                                                | Default Value                              |
| ------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **WAF Configuration**     | allowedIpV4AddressRanges      | IPv4 ranges to allow in the frontend WAF                                                                                                                                   | ["0.0.0.0/1", "128.0.0.0/1"] (all allowed) |
|                           | allowedIpV6AddressRanges      | IPv6 ranges to allow in the frontend WAF                                                                                                                                   | ["0000::/1", "8000::/1"] (all allowed)     |
| **Cognito Settings**      | cognitoUserPoolId             | Existing Cognito User Pool ID                                                                                                                                              | Create new                                 |
|                           | cognitoUserPoolClientId       | Existing Cognito User Pool Client ID                                                                                                                                       | Create new                                 |
|                           | cognitoDomainPrefix           | Cognito domain prefix                                                                                                                                                      | Auto-generated                             |
|                           | cognitoSelfSignUpEnabled      | Whether to enable self-signup for Cognito User Pool                                                                                                                        | true (enabled)                             |
| **Migration**             | autoMigrate                   | Whether to automatically run migration during deployment                                                                                                                   | true (auto-run)                            |
| **Citations API**         | enableCitations               | Whether to enable Citations API for PDF documents ([AWS announcement](https://aws.amazon.com/about-aws/whats-new/2025/06/citations-api-pdf-claude-models-amazon-bedrock/)) | true (enabled)                             |
| **Map State Concurrency** | reviewMapConcurrency          | Map State concurrency for the Review Processor (must be configured in consultation with throttling limits)                                                                 | 1                                          |
| **Map State Concurrency** | checklistInlineMapConcurrency | Inline Map State concurrency for the Checklist Processor (must be configured in consultation with throttling limits)                                                       | 1                                          |
| **Review Queue Settings** | reviewMaxConcurrency          | Max concurrent Step Functions executions for the review queue consumer                                                                                                    | 2                                          |
| **Review Queue Settings** | reviewQueueMaxDepth           | Max queue depth before the API returns a global concurrency limit error                                                                                                   | 10                                         |
| **Review Queue Settings** | reviewQueueMaxQueueCountMs    | Max wait time in ms before error handling in the review queue consumer                                                                                                    | 86,400,000 (24h)                           |
| **Review Queue Settings** | reviewQueueLogLevel           | Review queue lambda log level                                                                                                                                            | WARNING                                    |
| **Model Selection**       | availableModels                      | List of models available for per-checklist-item model selection. Set to empty array `[]` to disable the model selection UI                                            | Claude Opus 4.6, Claude Sonnet 4.6, Claude Haiku 4.5, Claude Sonnet 4 |
| **Network Mode**          | s3ApiGatewayFrontend          | Serve the SPA from S3 via a dedicated REGIONAL API Gateway (S3 proxy) instead of CloudFront, keeping standard networking                                              | false                                      |
| **Network Mode**          | closedNetwork                 | Fully private mode: isolated subnets, no NAT, VPC endpoints, PRIVATE API Gateways, Cognito PrivateLink. Implies `s3ApiGatewayFrontend`                                 | false                                      |
| **Network Mode**          | agentCoreNetworkMode          | AgentCore Runtime network mode (only applies when `closedNetwork`). `PUBLIC` = runtime has internet (MCP/uv work); `VPC` = runtime fully isolated. Invoke path is private either way | PUBLIC                                     |
| **Schedule Settings**     | feedbackAggregatorScheduleExpression | Feedback Aggregator execution schedule (EventBridge Scheduler expression format)                                                                                     | cron(0 2 * * ? *) (Daily at 2:00 UTC)     |

**Schedule Expression Format:**
- Cron format: `cron(minute hour day month day-of-week year)` - Example: `cron(0 2 * * ? *)` (Daily at 2:00 UTC)
- Rate format: `rate(value unit)` - Example: `rate(1 day)` (Every day), `rate(12 hours)` (Every 12 hours)
- Details: [Schedule types on EventBridge Scheduler](https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html)

### Closed / Private Network Deployment

By default the app is deployed **publicly** (CloudFront + S3, reachable over the internet). Two
optional parameters change how the frontend is served and whether the deployment is network-isolated:

- **`s3ApiGatewayFrontend`** (default `false`): serve the SPA from S3 via a REGIONAL API Gateway
  (S3 proxy) instead of CloudFront. Still public; standard networking (NAT). Useful if CloudFront
  is not desired.
- **`closedNetwork`** (default `false`): deploy fully **private** — isolated subnets with no NAT or
  internet gateway, all AWS access via VPC endpoints (incl. Bedrock, `bedrock-agentcore`, S3,
  Cognito PrivateLink), PRIVATE API Gateways locked to the VPC endpoint, and a REGIONAL WAF on the
  API stages. This automatically implies `s3ApiGatewayFrontend` (CloudFront cannot be used in a
  closed network).
- **`agentCoreNetworkMode`** (default `PUBLIC`): controls the AgentCore Runtime's network mode in
  closed mode (see the detailed trade-offs below).

Both are set in `cdk/lib/parameter.ts` (or via `-c`, e.g. `npx cdk deploy -c rapid.closedNetwork=true`),
or via the CloudShell script flags `--s3-api-gateway-frontend` / `--closed-network`.

When `closedNetwork: true`:

- **Deploy-time internet is still required** (to build/push container images and run the frontend
  build). Only the deployed resources' *runtime* network path is isolated. Fully offline deploys are
  out of scope.
- **Access is only from inside the VPC** — the PRIVATE APIs are unreachable from the public internet.
  Reach the app from a host on the VPC network (e.g. an EC2 with a browser, or Client VPN).
- **Auth**: only username/password (SRP) sign-in works over the Cognito PrivateLink endpoint. Hosted
  UI / OAuth / federated sign-in are **not** supported. Not available in GovCloud.
- **AgentCore Runtime network mode** (`agentCoreNetworkMode`, default `PUBLIC`): controls whether the
  agent runtime runs on AWS-managed networking (`PUBLIC`) or inside the isolated VPC (`VPC`). The
  invoke path (Lambda → AgentCore) is always private via the `bedrock-agentcore` VPC endpoint
  regardless. Use `PUBLIC` (default) unless you require the runtime compute itself to have no internet
  access. **Trade-offs:**
  - `PUBLIC`: runtime has internet — stdio/public-HTTP **MCP tools** and `uv`/`npx` runtime fetches work.
  - `VPC`: runtime has **no internet** — stdio and public-HTTP MCP tools do **not** work; only in-VPC
    HTTP MCP servers or AgentCore Gateway MCP tools work. Maximum isolation.
- **`bedrockRegion` must match the deployment region** — the `bedrock-runtime` endpoint cannot
  privately reach a different region. `global.*` inference profiles still work but may route data
  cross-region (a synth-time warning is emitted); use region-pinned IDs for data residency.
- **Enabling/disabling `closedNetwork` is not an in-place change** — the VPC topology change forces
  replacement. Deploy it to a fresh stack/region (run `cdk diff` first; snapshot Aurora before any
  destroy).

### AI Model Customization

This application uses Strands agents with tools such as file reading, so you must select **models that support tool use**.

**Examples of tool use supported models**:

- `global.anthropic.claude-opus-4-6-v1` (Claude Opus 4.6 Global)
- `global.anthropic.claude-sonnet-4-6` (Claude Sonnet 4.6 Global)
- `us.anthropic.claude-sonnet-4-6` (Claude Sonnet 4.6 US)
- `eu.anthropic.claude-sonnet-4-6` (Claude Sonnet 4.6 EU)
- `jp.anthropic.claude-sonnet-4-6` (Claude Sonnet 4.6 JP)
- `global.anthropic.claude-haiku-4-5-20251001-v1:0` (Claude Haiku 4.5 Global)
- `global.anthropic.claude-opus-4-5-20251101-v1:0` (Claude Opus 4.5 Global)
- `global.anthropic.claude-sonnet-4-5-20250929-v1:0` (Claude Sonnet 4.5 Global)
- `us.anthropic.claude-sonnet-4-5-20250929-v1:0` (Claude Sonnet 4.5 US)
- `eu.anthropic.claude-sonnet-4-5-20250929-v1:0` (Claude Sonnet 4.5 EU)
- `jp.anthropic.claude-sonnet-4-5-20250929-v1:0` (Claude Sonnet 4.5 JP)
- `global.anthropic.claude-sonnet-4-20250514-v1:0` (Claude Sonnet 4 Global)
- `us.anthropic.claude-sonnet-4-20250514-v1:0` (Claude Sonnet 4 US)
- `eu.anthropic.claude-sonnet-4-20250514-v1:0` (Claude Sonnet 4 EU)
- `apac.anthropic.claude-sonnet-4-20250514-v1:0` (Claude Sonnet 4 APAC)
- `mistral.mistral-large-2407-v1:0` (Mistral Large 2)
- `us.amazon.nova-premier-v1:0` (Amazon Nova Premier)
- `us.amazon.nova-2-omni-v1:0` (Amazon Nova 2 Omni)

**Important Notes**:

- **Cross-region inference profiles**: When using cross-region inference, regional prefixes like `us.`, `eu.`, `apac.` are required for model IDs

- **Official Documentation**: [Supported models and model features - Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-supported-models-features.html)

**Configuration Example**:

```typescript
// cdk/lib/parameter.ts
export const parameters = {
  documentProcessingModelId: "global.anthropic.claude-sonnet-4-6", // Claude Sonnet 4.6 (Global)
  bedrockRegion: "us-west-2", // Oregon region
  // ...
};
```

To configure these, directly edit the `cdk/lib/parameter.ts` file.

### Per-Checklist-Item Model Selection

By default, each checklist item can be assigned a specific AI model from the `availableModels` list. The default set includes Claude Opus 4.6, Sonnet 4.6, Haiku 4.5, and Sonnet 4 (Global). When no model is selected for an item, `documentProcessingModelId` (default: `global.anthropic.claude-sonnet-4-6`) is used for documents, and `imageReviewModelId` (default: `global.anthropic.claude-sonnet-4-6`) is used for images.

To customize the available models:

```typescript
// cdk/lib/parameter.ts
export const parameters = {
  availableModels: [
    { modelId: "global.anthropic.claude-opus-4-6-v1", displayName: "Claude Opus 4.6 (Global)" },
    { modelId: "global.anthropic.claude-sonnet-4-6", displayName: "Claude Sonnet 4.6 (Global)" },
    { modelId: "global.anthropic.claude-haiku-4-5-20251001-v1:0", displayName: "Claude Haiku 4.5 (Global)" },
    { modelId: "global.anthropic.claude-sonnet-4-20250514-v1:0", displayName: "Claude Sonnet 4 (Global)" },
  ],
};
```

To disable the model selection UI entirely, set `availableModels` to an empty array:

```typescript
export const parameters = {
  availableModels: [],
};
```

> [!CAUTION]
> For production environments, it is strongly recommended to set `cognitoSelfSignUpEnabled: false` to disable self-signup. Leaving self-signup enabled allows anyone to register an account, which may pose a security risk.
> By default, the `autoMigrate` parameter is set to `true`, which automatically runs database migrations during deployment. For production environments or environments containing important data, consider setting this parameter to `false` and controlling migrations manually.

## Pricing

This solution incurs infrastructure fixed costs (~$5/day, ~$150/month for NAT Gateway and Aurora Serverless v2) plus Bedrock usage costs based on document processing volume.

### Bedrock Usage Costs (Pay-per-use)

#### Budget-Friendly Lightweight Model (Claude Haiku 4.5, etc.)
- **Processable Pages**: ~80-85 pages
- **Cost Example (80 pages)**: ~$0.28

#### High-Accuracy Large-Capacity Model (Claude Opus 4.6, etc.)
- **Processable Pages**: ~430 pages
- **Cost Example (400 pages)**: ~$5.75

> [!Important]
> - **Please test with your sample documents to determine actual costs**
>   - **Cost factors**: Text volume, image count/size, checklist items vary significantly (page count is rough estimate only)
>   - **Agent features** (Knowledge Base, Code Interpreter, etc.) may incur up to 10x higher costs
>   - Detailed pricing and token usage can be viewed in the review results screen
> - Amazon Bedrock Converse API has a 4.5MB file size limit

For the latest pricing information, please visit the [Amazon Bedrock Pricing page](https://aws.amazon.com/bedrock/pricing/).

## Developer Information

- [Developer Guide](./docs/en/developer-guide.md): Technical specifications, architecture, development environment setup

## User Roles and Admin Setup

### Role Behavior (Admin / General User)

- **Admin**: Can view and operate on all checklist sets and review jobs (no owner restriction).
- **General user**: Can access only resources they own (owner-restricted).

| Resource | Owner | Action | Admin | General User |
| --- | --- | --- | --- | --- |
| Checklist | Self-created | View | O | O |
| Checklist | Self-created | Edit | O | O |
| Checklist | Self-created | Delete | O | O |
| Checklist | Created by others | View | O | X |
| Checklist | Created by others | Edit | O | X |
| Checklist | Created by others | Delete | O | X |
| Review | Self-created | View | O | O |
| Review | Self-created | Edit | O | O |
| Review | Self-created | Delete | O | O |
| Review | Created by others | View | O | X |
| Review | Created by others | Edit | O | X |
| Review | Created by others | Delete | O | X |

### Admin Initial Setup

This project uses a Cognito custom attribute `rapid_role`. When the ID token contains `custom:rapid_role=admin`, the backend treats the user as an admin.

1. In the Cognito User Pool, set the custom attribute `rapid_role` to `admin` for the target user.
2. Confirm the ID token includes `custom:rapid_role=admin` after login.

For local development, setting `RAPID_LOCAL_DEV=true` makes requests run as an admin user.

## Contact

- [Takehiro Suzuki](https://github.com/statefb)
- [Kenta Sato](https://github.com/kenta-sato3)

## Contribution

See [CONTRIBUTING](./CONTRIBUTING.md) for more information.

## License

This project is distributed under the license described in [LICENSE](./LICENSE).
