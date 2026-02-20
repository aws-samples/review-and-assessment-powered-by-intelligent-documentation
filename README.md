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
   - `--bedrock-region`: Region to use for Amazon Bedrock (default: us-west-2)
   - `--document-model`: AI model ID for document processing (default: us.anthropic.claude-sonnet-4-20250514-v1:0)
   - `--image-model`: AI model ID for image review processing (default: us.anthropic.claude-sonnet-4-20250514-v1:0)
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
| **Schedule Settings**     | feedbackAggregatorScheduleExpression | Feedback Aggregator execution schedule (EventBridge Scheduler expression format)                                                                                     | cron(0 2 * * ? *) (Daily at 2:00 UTC)     |

**Schedule Expression Format:**
- Cron format: `cron(minute hour day month day-of-week year)` - Example: `cron(0 2 * * ? *)` (Daily at 2:00 UTC)
- Rate format: `rate(value unit)` - Example: `rate(1 day)` (Every day), `rate(12 hours)` (Every 12 hours)
- Details: [Schedule types on EventBridge Scheduler](https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html)

### AI Model Customization

This application uses Strands agents with tools such as file reading, so you must select **models that support tool use**.

**Examples of tool use supported models**:

- `us.anthropic.claude-sonnet-4-20250514-v1:0` (Claude 4 Sonnet US)
- `eu.anthropic.claude-sonnet-4-20250514-v1:0` (Claude 4 Sonnet EU)
- `apac.anthropic.claude-sonnet-4-20250514-v1:0` (Claude 4 Sonnet APAC)
- `global.anthropic.claude-sonnet-4-5-20250929-v1:0` (Claude 4.5 Sonnet Global)
- `us.anthropic.claude-sonnet-4-5-20250929-v1:0` (Claude 4.5 Sonnet US)
- `eu.anthropic.claude-sonnet-4-5-20250929-v1:0` (Claude 4.5 Sonnet EU)
- `jp.anthropic.claude-sonnet-4-5-20250929-v1:0` (Claude 4.5 Sonnet JP)
- `global.anthropic.claude-sonnet-4-20250514-v1:0` (Claude 4 Sonnet Global)
- `us.anthropic.claude-sonnet-4-20250514-v1:0` (Claude 4 Sonnet US)
- `eu.anthropic.claude-sonnet-4-20250514-v1:0` (Claude 4 Sonnet EU)
- `apac.anthropic.claude-sonnet-4-20250514-v1:0` (Claude 4 Sonnet APAC)
- `mistral.mistral-large-2407-v1:0` (Mistral Large 2)
- `us.anthropic.claude-3-5-sonnet-20241022-v2:0` (Claude 3.5 Sonnet)
- `us.amazon.nova-premier-v1:0` (Amazon Nova Premier)
- `us.amazon.nova-2-omni-v1:0` (Amazon Nova 2 Omni)

**Important Notes**:

- **Cross-region inference profiles**: When using cross-region inference, regional prefixes like `us.`, `eu.`, `apac.` are required for model IDs

- **Official Documentation**: [Supported models and model features - Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-supported-models-features.html)

**Configuration Example**:

```typescript
// cdk/lib/parameter.ts
export const parameters = {
  documentProcessingModelId: "us.anthropic.claude-sonnet-4-20250514-v1:0", // Claude 4 Sonnet US
  bedrockRegion: "us-west-2", // Oregon region
  // ...
};
```

To configure these, directly edit the `cdk/lib/parameter.ts` file.

> [!CAUTION]
> For production environments, it is strongly recommended to set `cognitoSelfSignUpEnabled: false` to disable self-signup. Leaving self-signup enabled allows anyone to register an account, which may pose a security risk.
> By default, the `autoMigrate` parameter is set to `true`, which automatically runs database migrations during deployment. For production environments or environments containing important data, consider setting this parameter to `false` and controlling migrations manually.

## Pricing

This solution incurs infrastructure fixed costs (~$5/day, ~$150/month for NAT Gateway and Aurora Serverless v2) plus Bedrock usage costs based on document processing volume.

### Bedrock Usage Costs (Pay-per-use)

#### Budget-Friendly Lightweight Model (Claude Haiku 4.5, etc.)
- **Processable Pages**: ~80-85 pages
- **Cost Example (80 pages)**: ~$0.28

#### High-Accuracy Large-Capacity Model (Claude Opus 4.5, etc.)
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
