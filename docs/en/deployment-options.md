# Deployment Options

This document describes RAPID's deployment and configuration options in detail. For the basic deployment steps and the full parameter table, see the [README](../../README.md#deployment-methods).

## Table of Contents

- [CloudShell Deployment Options](#cloudshell-deployment-options)
- [Closed / Private Network Deployment](#closed--private-network-deployment)
- [AI Model Customization](#ai-model-customization)
- [Cleanup Details](#cleanup-details)

## CloudShell Deployment Options

The CloudShell deployment script (`bin.sh`) accepts the following options. Pass each value after the option name, separated by a space:

```bash
wget -O - https://raw.githubusercontent.com/aws-samples/review-and-assessment-powered-by-intelligent-documentation/main/bin.sh | bash -s -- --ipv4-ranges '["192.168.0.0/16"]' --cognito-self-signup false
```

Most options map directly to the CDK parameters described in [Parameter Customization](../../README.md#parameter-customization); see that table for what each parameter does.

| Option                           | Description                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `--ipv4-ranges`                  | IPv4 address ranges to allow in the frontend WAF (JSON array format). Maps to `allowedIpV4AddressRanges`.          |
| `--ipv6-ranges`                  | IPv6 address ranges to allow in the frontend WAF (JSON array format). Maps to `allowedIpV6AddressRanges`.          |
| `--auto-migrate`                 | Whether to automatically run database migration during deployment (true/false). Maps to `autoMigrate`.             |
| `--cognito-self-signup`          | Whether to enable self-signup for the Cognito User Pool (true/false). Maps to `cognitoSelfSignUpEnabled`.          |
| `--cognito-user-pool-id`         | Existing Cognito User Pool ID (creates a new pool if not specified). Maps to `cognitoUserPoolId`.                  |
| `--cognito-user-pool-client-id`  | Existing Cognito User Pool Client ID (creates a new client if not specified). Maps to `cognitoUserPoolClientId`.   |
| `--cognito-domain-prefix`        | Prefix for the Cognito domain (auto-generated if not specified). Maps to `cognitoDomainPrefix`.                    |
| `--mcp-admin`                    | Whether to grant admin permissions to the MCP runtime Lambda function (true/false, default: false). Maps to `mcpAdmin`.     |
| `--s3-api-gateway-frontend`      | Serve the SPA through a dedicated REGIONAL API Gateway (S3 proxy) instead of CloudFront (true/false, default: false). Maps to `s3ApiGatewayFrontend`. |
| `--closed-network`               | Deploy in fully closed network mode (true/false, default: false). Maps to `closedNetwork`; see [Closed / Private Network Deployment](#closed--private-network-deployment). |
| `--agentcore-network-mode`       | AgentCore Runtime network mode when closed, `PUBLIC` or `VPC` (default: PUBLIC). Maps to `agentCoreNetworkMode`.    |
| `--bedrock-region`               | Region to use for Amazon Bedrock (default: us-west-2). Maps to `bedrockRegion`.                                     |
| `--default-model`                | AI model ID to use as the default for all processing. Maps to `defaultModelId`. Example: `--default-model global.anthropic.claude-sonnet-5` |
| `--disable-ipv6`                 | Disable IPv6 support in the frontend WAF and CloudFront.                                                            |
| `--repo-url`                     | URL of the repository to deploy.                                                                                    |
| `--branch`                       | Branch name to deploy.                                                                                              |
| `--tag`                          | Deploy a specific Git tag.                                                                                          |

> [!Note]
> The former `--document-model` and `--image-model` options are deprecated and will be removed in a future release. They are still accepted for backward compatibility, but both now map to the single `defaultModelId` parameter. Use `--default-model` instead.

## Closed / Private Network Deployment

Two parameters switch the frontend delivery and the network topology:

- `s3ApiGatewayFrontend: true` — serves the SPA from a dedicated **REGIONAL API Gateway (S3 proxy)** instead of CloudFront. The SPA is delivered under the `/app/` stage path, and a REGIONAL WAF with the same IP allowlist protects the delivery stage. The application remains publicly reachable; use this when CloudFront cannot be used in your environment.
- `closedNetwork: true` — fully closed deployment. The VPC has **only isolated subnets (no NAT / Internet Gateway)**, all runtime AWS access (Bedrock, S3, SQS, Step Functions, Secrets Manager, CloudWatch Logs, Cognito, etc.) goes through **VPC endpoints**, and both the frontend delivery API and the backend API become **PRIVATE API Gateways** whose resource policies only accept requests arriving through the stack's `execute-api` VPC endpoint (`aws:SourceVpce`). This mode implies the S3 + API Gateway delivery regardless of `s3ApiGatewayFrontend`.

You can set the parameters in any of the usual ways. In `cdk/lib/parameter.ts`:

```typescript
export const parameters = {
  // ...
  closedNetwork: true,
};
```

As CLI context at deploy time:

```bash
npx cdk deploy --all -c rapid.closedNetwork=true
```

Or as an option of the CloudShell script:

```bash
./bin.sh --closed-network true
```

Please review the following characteristics and constraints before enabling closed network mode:

- **Deployment itself still requires internet access.** Container images and the SPA assets are built at deploy time (in CodeBuild or on your machine) and fetch dependencies from the internet. `closedNetwork` isolates the **runtime** traffic paths, not the deployment process.
- **The application is reachable only from inside the VPC** — for example from an EC2 instance with a browser in the VPC, or from your on-premises network connected via AWS Client VPN, AWS Site-to-Site VPN, or AWS Direct Connect. The PRIVATE API Gateways cannot be reached from the internet.
- **Authentication is Cognito over PrivateLink with SRP (username / password) only.** The Cognito Hosted UI, OAuth flows, and identity-provider federation are unavailable in a closed network because they depend on the internet-facing Cognito domain. Cognito PrivateLink is not available in AWS GovCloud.
- **`agentCoreNetworkMode` trade-off:** with `PUBLIC` (default), the AgentCore Runtime runs on the AWS-managed network — MCP tools (stdio / public HTTP) and runtime package fetches via `uv` / `npx` keep working, and the invoke path from the VPC still stays private through the Bedrock AgentCore VPC endpoint. With `VPC`, the Runtime itself moves into the isolated subnets for maximum isolation, but those tools can no longer reach the internet, and `cdk destroy` waits up to ~8 hours for ENI release (see [Cleanup Details](#cleanup-details)).
- **Toggling `closedNetwork` on an existing stack replaces the VPC.** This is not an in-place change: dependent resources, including the Aurora cluster, are re-created. Deploy the closed configuration as a **new stack** (separate account or region), run `cdk diff` first, and take an Aurora snapshot before changing an environment that holds data.
- **`global.` inference profiles may route outside the region.** Cross-region inference profiles prefixed with `global.` can route inference traffic outside the deployment region; the stack emits a synth-time warning about them in closed network mode. If you have strict data-residency requirements, use region-pinned profiles (e.g. `jp.`) instead.
- **The fixed infrastructure costs are higher than in the default configuration.** Closed network mode removes the NAT Gateway, but instead creates roughly 19 interface VPC endpoints across up to two Availability Zones. Interface endpoints are billed per endpoint per AZ-hour plus data processing, so expect the fixed costs to exceed the default configuration's estimate in the [README](../../README.md#pricing) — as a rough guide, the endpoints alone cost about $9–13/day with two AZs, depending on the region. See [AWS PrivateLink pricing](https://aws.amazon.com/privatelink/pricing/).

## AI Model Customization

This application uses Strands agents with tools such as file reading, so you must select **models that support tool use**.

**Examples of tool-use supported models** (the models included in `availableModels` by default):

- `global.anthropic.claude-sonnet-5` (Claude Sonnet 5, Global) — default
- `global.anthropic.claude-opus-4-8` (Claude Opus 4.8, Global)
- `jp.anthropic.claude-opus-4-8` (Claude Opus 4.8, JP)
- `global.anthropic.claude-opus-4-7` (Claude Opus 4.7, Global)
- `jp.anthropic.claude-opus-4-7` (Claude Opus 4.7, JP)
- `global.anthropic.claude-opus-4-6-v1` (Claude Opus 4.6, Global)
- `global.anthropic.claude-sonnet-4-6` (Claude Sonnet 4.6, Global)
- `jp.anthropic.claude-sonnet-4-6` (Claude Sonnet 4.6, JP)
- `global.anthropic.claude-haiku-4-5-20251001-v1:0` (Claude Haiku 4.5, Global)
- `jp.anthropic.claude-haiku-4-5-20251001-v1:0` (Claude Haiku 4.5, JP)

**Important notes**:

- **Cross-region inference profiles**: When using cross-region inference, a regional prefix (`global.`, `us.`, `eu.`, `apac.`, `jp.`) is required in the model ID, and the prefix must be consistent with the region where the stack (Amazon Bedrock) is deployed. For example, a `jp.*` model selected on a **us-east-1** deployment fails with `ValidationException: The provided model identifier is invalid.`. Note that the `availableModels` list bundled with this sample only ships `global.` / `jp.` profiles; add other prefixes (`us.` / `eu.` / `apac.`) yourself if your deployment region needs them.
- **Official documentation**: [Supported models and model features - Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-supported-models-features.html) / [Amazon Bedrock model cards](https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.html)

**Configuration example (running inference in Japan)**: edit `cdk/lib/parameter.ts` as follows. Amazon Bedrock uses the region where the stack is deployed, so to use the `jp.` inference profiles, deploy the stack in a Japanese region (Tokyo, `ap-northeast-1`), for example by setting `CDK_DEFAULT_REGION=ap-northeast-1` before deployment.

```typescript
export const parameters = {
  defaultModelId: "jp.anthropic.claude-sonnet-4-6", // Claude Sonnet 4.6 (JP)
  // ...
};
```

### Per-Checklist-Item Model Selection

By default, each checklist item can be assigned a specific AI model from the `availableModels` list. When no model is selected for an item, the review falls back to `defaultModelId` (the same default is used for documents and images alike — the model is multimodal). This lets you spend a high-accuracy model only on the items that need it and a cheaper model elsewhere.

To customize the available models, list the models you want in `cdk/lib/parameter.ts`:

```typescript
export const parameters = {
  availableModels: [
    { modelId: "global.anthropic.claude-sonnet-5", displayName: "Claude Sonnet 5 (Global)" },
    { modelId: "jp.anthropic.claude-haiku-4-5-20251001-v1:0", displayName: "Claude Haiku 4.5 (JP)" },
    // ... add the models you need
  ],
};
```

To disable the model selection UI entirely, set `availableModels` to an empty array:

```typescript
export const parameters = {
  availableModels: [],
};
```

### Registering Prices When You Add a Model

RAPID displays an estimated cost per review on the Web UI, calculated from each model's per-token price. These prices are maintained in a separate file, `review-item-processor/model_config.py` (the `_MODEL_REGISTRY` dictionary). When you add a new model to `availableModels` (or set it as a default model), please also register its input/output token prices in this file. If a model has no entry, it falls back to a default configuration whose prices are `0`, and the estimated cost for that model is displayed as `$0`.

Add an entry to `review-item-processor/model_config.py`, keyed by the model ID and following the existing entries as a reference:

```python
_MODEL_REGISTRY = {
    # ...
    "global.anthropic.claude-sonnet-5": ModelConfig(
        model_id="global.anthropic.claude-sonnet-5",
        display_name="Claude Sonnet 5 (Global)",
        input_per_1m=3.0,    # price per 1,000,000 input tokens (USD)
        output_per_1m=15.0,  # price per 1,000,000 output tokens (USD)
        supports_document_block=True,
        supports_citation=True,
        supports_caching=True,
    ),
    # ...
}
```

For the per-token prices of each Bedrock model, refer to the [Amazon Bedrock pricing page](https://aws.amazon.com/bedrock/pricing/). `input_per_1m` / `output_per_1m` are prices per 1,000,000 (1M) tokens, matching how the pricing page lists them, so you can copy the values directly (for example, `$3.00` per 1M input tokens becomes `input_per_1m=3.0`).

## Cleanup Details

`npx cdk destroy --all` removes both CDK stacks, as described in the [README](../../README.md#cleaning-up-destroying-the-stacks). This section covers what is **not** removed automatically and a known `DELETE_FAILED` case.

### Resources that are not removed automatically

- **An imported Amazon Cognito User Pool** (only when you deployed with `cognitoUserPoolId`): it is referenced, not managed by the stack, so it and its users survive the destroy (this is intended).
- Some **CloudWatch Logs** log groups (Step Functions, VPC flow logs, the review-queue consumer) and container images pushed to the CDK bootstrap **ECR** repository may remain.
- If you deployed via **CloudShell**, the helper stack `RapidCodeBuildDeploy` (from [`deploy.yml`](../../deploy.yml)) is separate from the CDK app and is **not** removed by `cdk destroy`. Delete it from the CloudFormation console / CLI so its broad `AdministratorAccess` CodeBuild role is not left behind:

  ```bash
  aws cloudformation delete-stack --stack-name RapidCodeBuildDeploy
  ```

### `cdk destroy` fails with `DELETE_FAILED` on the VPC subnets / security group (VPC mode only)

> [!Tip]
> This issue occurs **only** when `agentCoreNetworkMode` is set to `"VPC"`. The default setting (`"PUBLIC"`) does not create ENIs in your VPC, so `cdk destroy --all` completes immediately without this problem.

When running in VPC mode, the review agent uses the Amazon Bedrock AgentCore Runtime, which creates service-managed elastic network interfaces (ENIs, interface type `agentic_ai`, tagged `AmazonBedrockAgentCoreManaged=true`) in `RapidStack`'s private subnets. When you destroy the stack, CloudFormation deletes the AgentCore Runtime successfully but **these ENIs are not released immediately**, so the subnets and the review-processor security group cannot be deleted yet and the stack ends in `DELETE_FAILED` with messages like `The subnet '...' has dependencies and cannot be deleted` and `resource sg-... has a dependent object`.

This is expected behavior, not a bug. Per the AWS documentation:

> ENIs are shared resources across agents that use the same subnet and security group configuration. When you delete an agent, the associated ENI may persist in your VPC for up to 8 hours before it is automatically removed.
>
> — [Configure Amazon Bedrock AgentCore Runtime and tools for VPC](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-vpc.html)

These ENIs are created and deleted by the AgentCore service-linked role `AWSServiceRoleForBedrockAgentCoreNetwork` ([docs](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/service-linked-roles.html)), so you **cannot** detach or delete them yourself. Re-running `cdk destroy` will keep failing for the same reason. **Wait up to about 8 hours, then re-run** `cdk destroy --all`.

If you want to avoid this wait entirely, switch to PUBLIC mode by setting `agentCoreNetworkMode: "PUBLIC"` in `cdk/lib/parameter.ts` and redeploying before destroying.
