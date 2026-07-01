# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.25.2] - 2026-07-01

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

- Reorganized imports and applied lint/formatting fixes in the Python
  review-item-processor (`agent.py`, `test_mcp.py`) and normalized formatting
  across several CDK/backend files.
