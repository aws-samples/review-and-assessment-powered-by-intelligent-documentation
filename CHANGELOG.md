# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.25.2] - 2026-07-01

### Added

- Added a closed-network deployment mode (`closedNetwork` parameter, default
  `false`) that deploys the application fully private: isolated subnets with no
  NAT or internet gateway, all AWS access via VPC endpoints, PRIVATE API
  Gateways locked to the VPC endpoint, and a REGIONAL WAF on the API stages.
  Standard CloudFront deployment is unchanged when the flag is `false`.
  - New `VpcEndpoints` construct: an S3 gateway endpoint plus interface
    endpoints (ECR, CloudWatch Logs, Secrets Manager, STS, execute-api, Bedrock
    Runtime / Agent Runtime / AgentCore, SQS, Step Functions, Lambda, Cognito
    IDP PrivateLink, S3, X-Ray, CloudWatch, and SSM) so runtime traffic never
    leaves the VPC. The `execute-api` endpoint is referenced by the PRIVATE API
    Gateways to lock their resource policy via `aws:SourceVpce`.
  - In closed mode the VPC drops its public/NAT subnets in favor of isolated
    subnets only, and all VPC-attached resources (Aurora, Lambdas, migration
    job) move to those isolated subnets.
  - Added an `agentCoreNetworkMode` parameter (`PUBLIC` | `VPC`, default
    `PUBLIC`) that controls whether the AgentCore Runtime runs on AWS-managed
    networking or inside the isolated VPC. `PUBLIC` keeps stdio/public-HTTP MCP
    tools and `uv`/`npx` runtime fetches working; `VPC` fully isolates the
    runtime. The invoke path is private via the `bedrock-agentcore` VPC endpoint
    either way. Only takes effect when `closedNetwork` is `true`.
- Added an S3 + API Gateway frontend delivery mode (`s3ApiGatewayFrontend`
  parameter) that serves the SPA from a private S3 bucket through a dedicated
  REGIONAL API Gateway (S3 proxy) instead of CloudFront. This is both a
  standalone (still-public) delivery option and the enabling frontend for closed
  mode, which implies it automatically.
  - New `FrontendApi` construct: dedicated `RestApi` S3 proxy with binary media
    handling, an S3-integration execution role, and a VTL-based SPA fallback
    that serves `index.html` (HTTP 200, URL preserved) for extensionless
    client-side routes so deep links and refreshes work. Supports REGIONAL and
    PRIVATE endpoint modes.
  - New `RegionalWaf` construct: REGIONAL Web ACL (IPv4/IPv6 allowlist)
    associated with the frontend and backend API Gateway stages, replacing the
    CloudFront WAF when there is no distribution.
  - `Frontend` construct gained a `deliveryMode` (`cloudfront` | `s3ApiGateway`)
    branch; in S3+APIGW mode it skips CloudFront/OAC/WAF and the CloudFront
    invalidation workaround, and builds the SPA with a stage-prefix base path.
  - Backend `Api` construct gained an `endpointMode` (`EDGE` | `REGIONAL` |
    `PRIVATE`), plus optional VPC endpoint / subnet selection and a PRIVATE
    resource policy, without changing its routing.
  - `bin/rapid.ts` skips the CloudFront WAF stack (us-east-1) in S3+APIGW and
    closed modes.
  - Frontend: env-driven Vite `base` (`VITE_APP_BASE_PATH`) and a `publicAsset`
    helper so runtime/JSON asset paths resolve under the stage prefix.
  - CloudShell deploy script (`bin.sh`) gained `--s3-api-gateway-frontend`,
    `--closed-network`, and `--agentcore-network-mode` flags.

### Changed

- Upgraded the default Claude Sonnet 4 model from
  `global.anthropic.claude-sonnet-4-20250514-v1:0` to
  `global.anthropic.claude-sonnet-4-6` across all components:
  - Backend: ambiguity detector, document-processing LLM, and feedback
    aggregator (including the `CountTokens` model ID).
  - CDK: `documentProcessingModelId` and `imageReviewModelId` defaults in
    `parameter-schema.ts`, plus the feedback aggregator construct default.
  - Python review-item-processor: default document and image model IDs.
- Wired `DOCUMENT_PROCESSING_MODEL_ID` through the CDK ambiguity detection
  processor so the worker Lambda receives the configured model ID.
- Rewrote `cdk/README.md` to replace the default CDK boilerplate with
  project-specific deployment guidance:
  - Documents the primary flow (`npx cdk bootstrap` + `npm run deploy`).
  - Notes that `npm run deploy` uses the `review` AWS profile.
  - Adds a manual step-by-step deployment fallback.
  - Removes the misleading bare `npx cdk deploy` command, which skips the
    backend build.

### Fixed

- Skipped the backend language-preference sync while unauthenticated to avoid a
  spurious 401 / console error on the login screen.
- Fixed the review-processing `InvokeAgentFunction` Lambda failing at
  initialization with `ReferenceError: exports is not defined in ES module scope`.
  The Lambda was packaged via `Code.fromAsset`, which shipped a pre-built
  `index.js` from disk; a stale CommonJS build combined with the package's
  `"type": "module"` caused Node to reject it. Switched the construct to
  `NodejsFunction`, which compiles and bundles `index.ts` with esbuild in ESM
  format at synth time, eliminating the stale/mismatched artifact class of bug.
  The AWS SDK is kept external (`@aws-sdk/*`) since it is provided by the Node.js
  Lambda runtime.
- Reordered the CDK `deploy` npm script so `npm ci` runs before
  `npm run build:all`. Previously the build step invoked `tsc` before the CDK
  dependencies were installed, causing `tsc: command not found` on a fresh
  checkout.

### Removed

- Removed a debug `console.log` of the Cognito auth configuration from the
  frontend `AuthContext`.
- Removed the now-obsolete `build:lambda` npm script and `postinstall` hook
  from `cdk/package.json` (and dropped `build:lambda` from `build:all`). The
  invoke-agent Lambda is now bundled by esbuild during synth, so it no longer
  needs a separate `tsc` build step or its own installed `node_modules`.

### Internal

- Replaced the deprecated `logRetention` option on the review-queue consumer
  Lambda with an explicit `logGroup` (the CDK `logRetention` API is deprecated
  in favor of `logGroup`); also increased its timeout to 6 minutes.
- Reorganized imports and applied lint/formatting fixes in the Python
  review-item-processor (`agent.py`, `test_mcp.py`) and normalized formatting
  across several CDK/backend files.
