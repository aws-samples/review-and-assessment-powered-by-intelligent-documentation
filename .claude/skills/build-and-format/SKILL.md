---
name: build-and-format
description: Run build verification and code formatting across all RAPID project components (backend, frontend, CDK). Use after implementing code changes, before committing, after modifying Prisma schema, or before creating a pull request.
---

# Build and Format Verification

## Build Sequence

Run builds in dependency order (backend must build before CDK):

```bash
# 1. Backend (must be first - CDK depends on it)
cd backend
npm run build
npm run format

# 2. Frontend
cd ../frontend
npm run build
npm run format

# 3. CDK (depends on backend build)
cd ../cdk
npx cdk synth
```

## Prisma-Specific Build

After modifying `backend/prisma/schema.prisma`:

```bash
cd backend
npm run prisma:generate
npm run build
npm run format
```

## Common Errors

| Error | Solution |
|-------|----------|
| `Module not found: @prisma/client` | `cd backend && npm run prisma:generate` |
| `Cannot find module '../backend/...'` (CDK) | Build backend first |
| `Docker daemon not running` (CDK synth) | Start Docker Desktop |

## Quick Commands

| Task | Command |
|------|---------|
| Backend build + format | `cd backend && npm run build && npm run format` |
| Frontend build + format | `cd frontend && npm run build && npm run format` |
| CDK synth | `cd cdk && npx cdk synth` |
| Prisma generate | `cd backend && npm run prisma:generate` |

## Success Criteria

- Backend: TypeScript compiles without errors
- Frontend: Vite builds without errors
- CDK: CloudFormation template generates
- All code formatted by Prettier

After successful build, consider running `/test-database-feature` if database changes were made.
