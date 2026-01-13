# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Rules

- **NO package.json in root directory** - This project has 3 separate TypeScript packages + 1 Python package
- **Python: ALWAYS use `uv`** for package management (never pip or native python commands)
- **BEFORE COMMITTING: Format and build all changed packages** - CI will fail otherwise:
  ```bash
  # Frontend changes
  cd frontend && npm run format && npm run build

  # Backend changes
  cd backend && npm run format && npm run build

  # CDK changes
  cd cdk && npm run build
  ```
- **See AGENT.md** for comprehensive development guidelines, architecture, and coding standards

## Project Components

```
beacon/
├── backend/          # Fastify REST API (TypeScript)
├── frontend/         # React SPA with Vite (TypeScript)
├── cdk/              # AWS CDK infrastructure (TypeScript)
└── review-item-processor/  # Python Lambda (use uv)
```

## Common Workflows (Skills)

Use these skills for common development tasks:

- **`/plan-backend-frontend`** - Plan backend API and frontend features with architecture patterns
- **`/modify-agent-prompts`** - Modify review-item-processor agent prompts and configuration
- **`/modify-cdk-workflows`** - Modify CDK Step Functions workflows (review and checklist)
- **`/build-and-format`** - Verify builds pass and format code
- **`/test-database-feature`** - Run tests with local database
- **`/deploy-cdk-stack`** - Deploy to AWS (only when explicitly asked)

## Quick Reference

| Task | Location |
|------|----------|
| Architecture details | AGENT.md |
| Coding standards | AGENT.md |
| Development workflow | AGENT.md + Skills |
| Common commands | Skills |

See **AGENT.md** for detailed architecture, layered design patterns, repository patterns, frontend component rules, CDK parameter system, and all coding standards.
