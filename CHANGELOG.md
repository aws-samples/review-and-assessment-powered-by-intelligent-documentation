# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.25.2] - 2026-07-01

### Added

- Added an S3 + API Gateway frontend delivery mode (`s3ApiGatewayFrontend`
  parameter) that serves the SPA from a private S3 bucket through a dedicated
  REGIONAL API Gateway (S3 proxy) instead of CloudFront, as an intermediate step
  toward closed-network deployment. Standard CloudFront mode is unchanged when
  the flag is `false`.
  - New `FrontendApi` construct: dedicated `RestApi` S3 proxy with binary media
    handling, an S3-integration execution role, and a VTL-based SPA fallback
    that serves `index.html` (HTTP 200, URL preserved) for extensionless
    client-side routes so deep links and refreshes work.
  - New `RegionalWaf` construct: REGIONAL Web ACL (IPv4/IPv6 allowlist)
    associated with the frontend and backend API Gateway stages.
  - `Frontend` construct gained a `deliveryMode` (`cloudfront` | `s3ApiGateway`)
    branch; in S3+APIGW mode it skips CloudFront/OAC/WAF and the CloudFront
    invalidation workaround, and builds the SPA with a stage-prefix base path.
  - Backend `Api` construct gained an `endpointMode` (`EDGE` | `REGIONAL` |
    `PRIVATE`), plus optional VPC endpoint / subnet selection and a PRIVATE
    resource policy, without changing its routing.
  - `bin/rapid.ts` skips the CloudFront WAF stack (us-east-1) in S3+APIGW mode.
  - Added a `closedNetwork` parameter (scaffolding) that implies the S3+APIGW
    frontend and PRIVATE endpoints.
  - Frontend: env-driven Vite `base` (`VITE_APP_BASE_PATH`) and a `publicAsset`
    helper so runtime/JSON asset paths resolve under the stage prefix.

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

- Fixed browser presigned S3 uploads returning 403 (`SignatureDoesNotMatch`).
  AWS SDK v3 now adds a CRC32 request checksum by default, which a plain browser
  PUT cannot satisfy; set `requestChecksumCalculation: "WHEN_REQUIRED"` on the
  API S3 client.
- Fixed the document bucket CORS rule using an origin that included the API
  Gateway stage path; a CORS Origin is scheme + host only, so the stage path is
  now stripped (and presigned GET + `ETag` exposure added).
- Fixed SPA navigation dropping the API Gateway stage prefix: replaced
  `window.location.href` navigations with React Router `navigate()` (which
  respects the router `basename`) in the review, checklist, and
  tool-configuration list components, and made the post-login redirect
  base-path aware.
- Fixed example images 404ing under the stage prefix by resolving their
  root-absolute paths through the app base URL.
- Fixed the WAF stage association failing on a fresh create by making it depend
  on the API Gateway stage construct.
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
