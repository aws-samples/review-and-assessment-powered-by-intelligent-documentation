# CLAUDE.md

## Critical Rules

<<<<<<< HEAD
- **NO package.json in root directory** - 3 separate TS packages + 1 Python package
- **Python: use `uv`** for all package management (never pip/python directly)
- **BEFORE COMMITTING** - format and build all changed packages (CI will fail):
=======
- **NO package.json in root directory** - This project has 3 separate TypeScript packages + 1 Python package
- **Python: ALWAYS use `uv`** for package management (never pip or native python commands)
- **BEFORE COMMITTING: Format and build all changed packages** - CI will fail otherwise:

>>>>>>> c162a202 (Optimize Claude Code skills against authoring best practices)
  ```bash
  cd frontend && npm run format && npm run build   # Frontend
  cd backend && npm run format && npm run build     # Backend
  cd cdk && npm run build                           # CDK
  ```
<<<<<<< HEAD
=======

- **See AGENT.md** for comprehensive development guidelines, architecture, and coding standards
>>>>>>> c162a202 (Optimize Claude Code skills against authoring best practices)

## Project Structure

```
beacon/
├── backend/                 # Fastify REST API (TypeScript, ESM)
├── frontend/                # React SPA, Vite + Tailwind CSS
├── cdk/                     # AWS CDK infrastructure
└── review-item-processor/   # Python Lambda (use uv)
```

## Skills

- **`/plan-backend-frontend`** - Plan features with RAPID layered architecture
- **`/build-and-format`** - Build verification and formatting
- **`/test-database-feature`** - Repository integration tests with local MySQL
- **`/deploy-cdk-stack`** - CDK deployment (only when explicitly asked)
- **`/modify-cdk-workflows`** - CDK Step Functions workflows
- **`/modify-agent-prompts`** - Agent prompts, models, tools config
- **`/add-example`** - Add example use cases with thumbnails
- **`/ui-css-patterns`** - UI/CSS patterns and component reference

<<<<<<< HEAD
## Backend
=======
- **`/plan-backend-frontend`** - Plan backend API and frontend features with RAPID layered architecture
- **`/build-and-format`** - Build verification and code formatting across all components
- **`/test-database-feature`** - Repository integration tests with local MySQL database
- **`/deploy-cdk-stack`** - Deploy AWS infrastructure using CDK (only when explicitly asked)
- **`/modify-cdk-workflows`** - Modify CDK Step Functions workflows (ReviewProcessor/ChecklistProcessor)
- **`/modify-agent-prompts`** - Modify review-item-processor agent prompts, models, and tools
- **`/add-example`** - Add new example use cases with file setup, thumbnails, and link verification
- **`/ui-css-patterns`** - UI/CSS design patterns, color semantics, and component reference
>>>>>>> c162a202 (Optimize Claude Code skills against authoring best practices)

- **TypeScript only** (ESM) -- JavaScript prohibited
- **vitest only** -- jest prohibited
- MySQL with **Prisma ORM** (schema: `backend/prisma/schema.prisma`)
- **Layered architecture**: `routes/ -> usecase/ -> domain/` (unidirectional deps)
  - Feature dirs: `src/api/features/{feature}/{ domain/, usecase/, routes/ }`
  - Dependency injection via optional `deps` params with defaults
- **Repository pattern MANDATORY** -- no direct Prisma calls in StepFunctions handlers (`src/checklist-workflow/`, `src/review-workflow/`)
  - Repository tests MUST connect to actual DB (not mocks)
  - Example tests: `backend/src/api/features/{feature}/__tests__/`
- Test commands: `cd backend && npm test` (all) or `npm run test -- <suite>` (specific)

<<<<<<< HEAD
## Frontend
=======
| Task                 | Location          |
| -------------------- | ----------------- |
| Architecture details | AGENT.md          |
| Coding standards     | AGENT.md          |
| Development workflow | AGENT.md + Skills |
| Common commands      | Skills            |
>>>>>>> c162a202 (Optimize Claude Code skills against authoring best practices)

- **TypeScript only** -- JavaScript prohibited
- **Icons**: use react-icons only -- SVG files prohibited
- **DO NOT modify** `frontend/tailwind.config.js`
- **No native `alert()`/`confirm()`** -- use `useAlert` hook + `AlertModal` component
- Use shared components from `frontend/src/components/` (e.g., `Button`, `Modal`) -- avoid raw `<button>` elements
- Feature-based structure: `features/{name}/hooks/`, `features/{name}/components/`
- API hooks: use `useApiClient`; split into `use{Feature}Queries.ts` / `use{Feature}Mutations.ts`
- Data fetching: SWR

## CDK

- Parameters: `cdk/lib/parameter.ts` (user config) + `cdk/lib/parameter-schema.ts` (schema/validation)
- To add a parameter: add to schema in `parameter-schema.ts` with Zod validation and default
- Deploy: use `/deploy-cdk-stack` skill
