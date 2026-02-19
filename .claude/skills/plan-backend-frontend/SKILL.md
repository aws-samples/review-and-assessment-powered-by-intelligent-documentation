---
name: plan-backend-frontend
description: Create implementation plans for backend API endpoints and frontend features following RAPID layered architecture (domain/usecase/routes pattern, SWR hooks, feature-based organization). Use when adding or modifying backend APIs, frontend components, database schemas, or repository implementations. Also use for refactoring backend/frontend code.
---

# Plan Backend/Frontend Feature Implementation

Create a comprehensive implementation plan before writing code. **DO NOT proceed with implementation until explicitly told "Go" or "Proceed".**

## Planning Requirements

### 1. Examine Existing Implementation

**MUST examine existing code** - speculation is strictly prohibited.

```bash
# Check existing features
ls -la backend/src/api/features/
ls -la frontend/src/features/
```

### 2. Specify File Paths

Your plan MUST include specific paths for files to create, modify, and delete.

### 3. Show Clear Diffs

Focus only on essential changes. Do not include entire file contents.

## Backend Architecture

**Unidirectional dependency**: routes -> usecase -> domain (never reverse)

```
backend/src/api/features/{feature-name}/
├── domain/
│   ├── model/{entity}.ts        # Domain entities and types
│   ├── service/{service}.ts     # Domain services (optional)
│   └── repository.ts            # Data access interface & implementation
├── usecase/{function-unit}.ts   # Application logic
└── routes/
    ├── index.ts                 # Route definitions
    └── handlers.ts              # HTTP request handlers
```

**Key patterns**:
- Dependency injection for testability (external deps as parameters)
- Repository pattern for all database access (direct Prisma calls prohibited in StepFunctions)
- Explicit interfaces for all domain models

For code examples, see [references/BACKEND-PATTERNS.md](references/BACKEND-PATTERNS.md).

## Frontend Architecture

**Feature-based organization** with SWR for data fetching:

```
frontend/src/features/{feature-name}/
├── hooks/
│   ├── use{Feature}Queries.ts    # GET operations with SWR
│   └── use{Feature}Mutations.ts  # POST/PUT/PATCH/DELETE operations
├── components/{Component}.tsx
└── types/index.ts
```

**Key patterns**:
- SWR hooks with automatic caching and revalidation
- Check `src/components/` before creating new UI elements
- For styling guidance, use `/ui-css-patterns` skill

For code examples, see [references/FRONTEND-PATTERNS.md](references/FRONTEND-PATTERNS.md).

## Plan Template

```markdown
# Implementation Plan: {Feature Name}

## Files to Create
- `backend/src/api/features/{feature}/domain/model/{entity}.ts`
- `backend/src/api/features/{feature}/domain/repository.ts`
- `backend/src/api/features/{feature}/usecase/{function}.ts`
- `backend/src/api/features/{feature}/routes/index.ts`
- `backend/src/api/features/{feature}/routes/handlers.ts`
- `frontend/src/features/{feature}/hooks/use{Feature}Queries.ts`
- `frontend/src/features/{feature}/hooks/use{Feature}Mutations.ts`

## Files to Modify
- `backend/src/api/index.ts` - Register new routes
- `backend/prisma/schema.prisma` - Add new models (if needed)

## Implementation Steps
1. Backend domain layer
2. Backend use case layer
3. Backend routes layer
4. Frontend hooks
5. Frontend components

## Verification
- Run `/build-and-format`
- Run `/test-database-feature` (if database changes)
```

## After Planning

1. **STOP and wait** for "Go" or "Proceed" from user
2. After implementation: run `/build-and-format`
3. If schema changed: run `/test-database-feature`

### Local Backend API Testing

Start backend server with auth bypassed:

```bash
cd backend
RAPID_LOCAL_DEV=true npm run dev
```

Server starts at `http://localhost:3000`. `RAPID_LOCAL_DEV=true` bypasses Cognito auth and injects mock user.

```bash
# Test endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/{your-new-endpoint}
curl -X POST http://localhost:3000/{endpoint} -H 'Content-Type: application/json' -d '{"key":"value"}'
```

**Database not running?** Start it first:
```bash
docker-compose -f assets/local/docker-compose.yml up -d
cd backend && npm run prisma:migrate
```
