# Review & Assessment Powered by Intelligent Documentation (RAPID)

| Document                                                            | Language                                                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| README (this page)                                                  | [English](README.md) \| [日本語](./docs/ja/README_ja.md)                                  |
| Deployment Options (CloudShell options, closed network, AI models)  | [English](./docs/en/deployment-options.md) \| [日本語](./docs/ja/deployment-options.md)   |
| Developer Guide (architecture, troubleshooting)                     | [English](./docs/en/developer-guide.md) \| [日本語](./docs/ja/developer-guide.md)         |
| Local Development (run the app on your machine)                     | [English](./docs/en/local-development.md) \| [日本語](./docs/ja/local-development.md)     |
| Example Use Cases (industry sample scenarios and documents)         | [English](./examples/en/README.md) \| [日本語](./examples/ja/README.md)                   |

This sample is a document review solution powered by generative AI (Amazon Bedrock). It streamlines review processes involving extensive documents and complex checklists using a Human in the Loop approach. It supports the entire process from checklist structuring to AI-assisted review and final human judgment, reducing review time and improving quality.

![](./docs/imgs/en_review_result.png)

> [!Important]
> This tool is intended only for decision support and does not provide professional judgment or legal advice. All final judgments must be made by qualified human experts.

> [!Warning]
> This sample may undergo breaking changes without prior notice.

## How It Works

RAPID performs document review in two phases:

1. **Build a checklist** – Upload a document (PDF) — such as a regulation, guideline, or specification — that describes what to check and where, and AI extracts the review criteria as a checklist.
2. **Run a review** – Upload the documents to be reviewed (PDF or images) and pick the checklist to compare them against, and AI evaluates each item as **Pass / Fail**, presenting a confidence score, the AI's rationale, and the documents it referenced.

RAPID runs on AWS serverless services (Amazon CloudFront, API Gateway + Lambda, Step Functions, Aurora Serverless v2, and Amazon Bedrock / AgentCore). See the [Developer Guide](./docs/en/developer-guide.md#architecture) for the architecture diagram.

## Key Features

- **AI checklist extraction** – Converts regulations, guidelines, specifications, and the like into a checklist.
- **AI document review** – Judges each checklist item as Pass / Fail and presents a confidence score, the AI's rationale, and the documents it referenced.
- **Per-checklist-item model selection** – Assigns any generative AI model to each checklist item, so you can spend higher-cost models only on the difficult checks.
- **Agent tools** – Equips a checklist item with **Amazon Bedrock Knowledge Bases** (RAG), the **AgentCore Code Interpreter** (code execution for calculations and validation), and **MCP (Model Context Protocol)** servers when the check needs knowledge from external tools.
- **Customizable prompts** – Lets you review and edit the system prompts used for checklist extraction on a dedicated Prompt Management screen.
- **Example use cases gallery** – Ships with industry sample scenarios (real estate, IT, manufacturing, healthcare, corporate governance, and more), so you can try RAPID's document review right away.
- **Closed / private network deployment** – Runs RAPID without exposing it to the internet. Combined with **AWS Site-to-Site VPN** or **AWS Direct Connect**, you can use RAPID from your on-premises network over fully private connectivity. See [Closed / Private Network Deployment](#closed--private-network-deployment).
- **Concurrency control** – Keeps reviews within Amazon Bedrock's quotas by controlling how many run concurrently.

<details>
<summary><strong>Screenshots of the main screens</strong> (click to expand)</summary>

![](./docs/imgs/en_new_review.png)

![](./docs/imgs/en_new_review_floor_plan.png)

![](./docs/imgs/en_review_result.png)

![](./docs/imgs/en_review_result_ng.png)

</details>

## Key Use Cases

- **Product specification compliance review** – Verify that product specifications meet requirements and industry standards, and let reviewers concentrate on the final confirmation.
- **Technical manual quality verification** – Check that technical manuals comply with internal guidelines and industry standards, and detect missing information and inconsistencies automatically.
- **Procurement document compliance verification** – Extract the required information from procurement documents and proposals spanning hundreds of pages, and have humans verify the compliance results.

Concrete scenarios with sample documents are available in the [examples gallery](./examples/en/README.md).

## Deployment Methods

### 1. Deployment Using CloudShell (For Those Who Want to Start Easily)

This method allows you to deploy directly from your browser using AWS CloudShell, without preparing a local environment.

1. **Confirm the models to use with Amazon Bedrock**

   Amazon Bedrock uses the region where the stack is deployed (the region in which you open AWS CloudShell). Make sure the target models (inference profiles) are enabled in that region. To use cross-region (`global.` / `us.` / `eu.` / `apac.` / `jp.`) inference profiles, see [AI Model Customization](./docs/en/deployment-options.md#ai-model-customization).

2. **Open AWS CloudShell**

   Open [AWS CloudShell](https://console.aws.amazon.com/cloudshell/home) in the region where you want to deploy.

3. **Run the deployment script**

   ```bash
   wget -O - https://raw.githubusercontent.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation/main/bin.sh | bash
   ```

   This command automatically executes everything from repository cloning to deployment. Upon completion, the frontend URL and the API URL are displayed; open the frontend URL in your browser to start using the application.

4. **Specify custom options (optional)**

   ```bash
   wget -O - https://raw.githubusercontent.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation/main/bin.sh | bash -s -- --ipv4-ranges '["192.168.0.0/16"]'
   ```

   Options such as `--ipv4-ranges` and `--closed-network` correspond to the CDK parameters described in [Parameter Customization](#parameter-customization). For the full list of options, see [CloudShell Deployment Options](./docs/en/deployment-options.md#cloudshell-deployment-options).

> [!Important]
> With this deployment method, if you do not set option parameters, anyone who knows the URL can sign up. For production use, we strongly recommend adding IP address restrictions and disabling self-signup (`--cognito-self-signup false`).

### 2. Deployment from Local Environment (Recommended for Customization)

> [!Note]
> This method requires **Docker** to be installed and running locally, because the CDK build bundles several Lambda functions as container images (Prisma database migration, review processor, AgentCore runtime). Node.js and AWS credentials with permissions for the target account / region are also required.

- Clone this repository:

```
git clone https://github.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation.git
cd review-and-assessment-powered-by-intelligent-documentation
```

- Edit [parameter.ts](./cdk/lib/parameter.ts) as needed. See [Parameter Customization](#parameter-customization) for details.
- Bootstrap the target region once before the first deployment. The exported `AWS_DEFAULT_REGION` applies to both the bootstrap and the deployment; you can also specify the region per command with `npx cdk bootstrap aws://<account-id>/<region>` instead. Run `npm ci` in `cdk/` before bootstrapping: `cdk bootstrap` loads the CDK app in `cdk/bin/rapid.ts`, so on a fresh clone it fails before reaching AWS. The app also bootstraps `us-east-1` for the CloudFront WAF stack (skipped in the S3 + API Gateway and closed-network frontend modes).

```
cd cdk
npm ci
export AWS_DEFAULT_REGION="<region>"
npx cdk bootstrap
```

- Deploy (this builds all packages and deploys them automatically):

```
cd cdk
npm run deploy
```

<details><summary>Manual step-by-step deployment</summary>

Prepare the backend:

```bash
cd backend
npm ci
npm run prisma:generate
npm run build
```

Then install the CDK packages and deploy:

```bash
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

### Cleaning Up (Destroying the Stacks)

To remove everything this sample created and stop incurring costs, destroy both CDK stacks. Run this from the `cdk` directory:

```bash
cd cdk
npx cdk destroy --all
```

`--all` lets CDK delete the stacks in dependency order (it removes `RapidStack` before `RapidFrontendWafStack`, which lives in **us-east-1**).

> [!Warning]
> This is a sample/demo configuration: the S3 buckets, the Aurora database, and — when the stack created it — the Cognito User Pool are all removed on destroy, **including all data and user accounts**. There is no retention or deletion protection. Back up anything you need first, and for real workloads consider changing these removal policies.

A few resources are not removed automatically, such as an imported Cognito User Pool, some CloudWatch Logs log groups, and the `RapidCodeBuildDeploy` stack created by the CloudShell deployment. In VPC mode, `cdk destroy` can also fail temporarily with `DELETE_FAILED` while service-managed ENIs are released. See [Cleanup Details](./docs/en/deployment-options.md#cleanup-details) for both topics.

## Parameter Customization

The following parameters can be customized during CDK deployment. Edit [`cdk/lib/parameter.ts`](./cdk/lib/parameter.ts):

| Parameter Group           | Parameter Name                       | Description                                                                                                                                                                | Default Value                              |
| ------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **WAF Configuration**     | allowedIpV4AddressRanges             | IPv4 ranges to allow in the frontend WAF                                                                                                                                   | ["0.0.0.0/1", "128.0.0.0/1"] (all allowed) |
|                           | allowedIpV6AddressRanges             | IPv6 ranges to allow in the frontend WAF                                                                                                                                   | ["0000::/1", "8000::/1"] (all allowed)     |
| **Cognito Settings**      | cognitoUserPoolId                    | Existing Cognito User Pool ID                                                                                                                                              | Create new                                 |
|                           | cognitoUserPoolClientId              | Existing Cognito User Pool Client ID                                                                                                                                       | Create new                                 |
|                           | cognitoDomainPrefix                  | Prefix for the Cognito domain                                                                                                                                              | Auto-generated                             |
|                           | cognitoSelfSignUpEnabled             | Whether to enable self-signup for the Cognito User Pool                                                                                                                    | true (enabled)                             |
| **Migration**             | autoMigrate                          | Whether to automatically run database migration during deployment                                                                                                          | true (auto-run)                            |
| **Bedrock**               | defaultModelId                  | The default AI model used across the whole app (document processing, image review, checklist generation, ambiguity detection, and the WebUI default); per-item selections from `availableModels` override it.                                                    | global.anthropic.claude-sonnet-5           |
|                           | availableModels                 | List of models available for per-checklist-item model selection. Model IDs must use an inference-profile prefix (`global.` / `jp.` etc.) that matches the deployment region; see [AI Model Customization](./docs/en/deployment-options.md#ai-model-customization). Set `[]` to hide the model selection UI. | Sonnet 5 (Global), Opus 4.8 / 4.7, Sonnet 4.6, Haiku 4.5 (Global & JP), plus Opus 4.6 (Global) |
| **MCP Features**          | mcpAdmin                             | Whether to grant admin permissions to the MCP runtime Lambda function                                                                                                      | false (disabled)                           |
| **Citations API**         | enableCitations                      | Whether to enable the Citations API for PDF documents ([AWS announcement](https://aws.amazon.com/about-aws/whats-new/2025/06/citations-api-pdf-claude-models-amazon-bedrock/)) | true (enabled)                             |
| **Network Mode**          | s3ApiGatewayFrontend                 | Serve the SPA from S3 via a dedicated REGIONAL API Gateway (S3 proxy) instead of CloudFront, keeping standard networking. See [Closed / Private Network Deployment](#closed--private-network-deployment). | false                                      |
|                           | closedNetwork                        | Fully private mode: isolated subnets, no NAT, VPC endpoints, PRIVATE API Gateways, Cognito PrivateLink. Implies `s3ApiGatewayFrontend`. See [Closed / Private Network Deployment](#closed--private-network-deployment). | false                                      |
|                           | agentCoreNetworkMode                 | AgentCore Runtime network mode (only applies when `closedNetwork`). `PUBLIC` = runtime has internet (MCP/uv work); `VPC` = runtime fully isolated. Invoke path is private either way | PUBLIC                                     |
| **Map State Concurrency** | reviewMapConcurrency                 | Map State concurrency for the Review Processor (must be configured in consultation with throttling limits)                                                                 | 1                                          |
|                           | checklistInlineMapConcurrency        | Inline Map State concurrency for the Checklist Processor (must be configured in consultation with throttling limits)                                                       | 1                                          |
| **Review Queue Settings** | reviewMaxConcurrency                 | Max concurrent Step Functions executions for the review queue consumer                                                                                                     | 2                                          |
|                           | reviewQueueMaxDepth                  | Max queue depth before the API returns a global concurrency limit error                                                                                                    | 10                                         |
|                           | reviewQueueMaxQueueCountMs           | Max wait time in ms before error handling in the review queue consumer                                                                                                     | 86,400,000 (24h)                           |
|                           | reviewQueueLogLevel                  | Log level for the review queue consumer Lambda                                                                                                                             | WARNING                                    |
| **Schedule Settings**     | feedbackAggregatorScheduleExpression | Feedback Aggregator execution schedule (EventBridge Scheduler expression format)                                                                                           | cron(0 2 * * ? *) (Daily at 2:00 UTC)      |

**Schedule Expression Format:**

- Cron format: `cron(minute hour day month day-of-week year)` - Example: `cron(0 2 * * ? *)` (Daily at 2:00 UTC)
- Rate format: `rate(value unit)` - Example: `rate(1 day)` (Every day), `rate(12 hours)` (Every 12 hours)
- Details: [Schedule types on EventBridge Scheduler](https://docs.aws.amazon.com/scheduler/latest/UserGuide/schedule-types.html)

> [!Caution]
> The default values prioritize an easy trial over production hardening:
>
> - **WAF IP restrictions**: the defaults allow **all** IP addresses. For production, set the specific IP ranges you want to allow.
> - **Self-signup** is enabled by default. For production use, we strongly recommend setting `cognitoSelfSignUpEnabled: false`; leaving it enabled allows anyone who reaches the URL to register an account.
> - **autoMigrate** runs database migrations automatically on every deployment. For production environments or environments containing important data, consider setting it to `false` and controlling migrations manually.

### Closed / Private Network Deployment

Setting `closedNetwork: true` deploys RAPID in a fully closed configuration: the VPC has only isolated subnets (no NAT / Internet Gateway), runtime AWS access goes through VPC endpoints, and both API Gateways become PRIVATE endpoints. The application is then reachable only from inside the VPC — for example from your on-premises network connected via AWS Client VPN, AWS Site-to-Site VPN, or AWS Direct Connect. If you only need to avoid CloudFront while staying publicly reachable, use `s3ApiGatewayFrontend: true` instead.

Closed network mode comes with several constraints — deployment itself still requires internet access, authentication is limited to Cognito SRP, and toggling the mode on an existing stack replaces the VPC, among others. Be sure to read [Closed / Private Network Deployment](./docs/en/deployment-options.md#closed--private-network-deployment) before enabling it.

### AI Model Customization

RAPID uses Strands agents with tools such as file reading, so you must select **models that support tool use**. You can change the app-wide default model (`defaultModelId`) and the per-item selection list (`availableModels`) in `parameter.ts`; when a checklist item has no model selected, the review falls back to the default model. For the list of bundled models, notes on regions and inference profiles, configuration examples, and how to register token prices when adding a model, see [AI Model Customization](./docs/en/deployment-options.md#ai-model-customization).

## Pricing

This solution incurs infrastructure fixed costs (~$5/day, ~$150/month, mainly for the NAT Gateway and Aurora Serverless v2) plus Amazon Bedrock usage costs based on document processing volume (pay-per-use).

| Model class                                              | Max pages per review (context-window guide) | Cost example            |
| -------------------------------------------------------- | ------------------------------------------- | ----------------------- |
| Budget-friendly lightweight model (Claude Haiku 4.5, etc.) | ~80–85 pages                                | ~$0.28 for 80 pages     |
| High-accuracy large-capacity model (Claude Opus 4.x, etc.) | ~430 pages                                  | ~$5.75 for 400 pages    |

> [!Important]
> Please test with your own sample documents: costs vary significantly with text volume, image count / size, the number of checklist items, and tool usage (Knowledge Bases, Code Interpreter, etc.). The cost shown on the review results screen is an estimate based only on that review's token usage and may not match your actual charges.

## User Roles and Admin Setup

### Role Behavior (Admin / General User)

- **Admin**: Can view and operate on all checklist sets and review jobs (no owner restriction).
- **General user**: Can access only resources they own (owner-restricted).

| Resource  | Owner             | Action | Admin | General User |
| --------- | ----------------- | ------ | ----- | ------------ |
| Checklist | Self-created      | View   | O     | O            |
| Checklist | Self-created      | Edit   | O     | O            |
| Checklist | Self-created      | Delete | O     | O            |
| Checklist | Created by others | View   | O     | X            |
| Checklist | Created by others | Edit   | O     | X            |
| Checklist | Created by others | Delete | O     | X            |
| Review    | Self-created      | View   | O     | O            |
| Review    | Self-created      | Edit   | O     | O            |
| Review    | Self-created      | Delete | O     | O            |
| Review    | Created by others | View   | O     | X            |
| Review    | Created by others | Edit   | O     | X            |
| Review    | Created by others | Delete | O     | X            |

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
