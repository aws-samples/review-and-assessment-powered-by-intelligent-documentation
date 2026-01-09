---
name: plan-backend-frontend
description: Create implementation plan for backend API and frontend features following RAPID architecture
---

# Plan Backend/Frontend Feature Implementation

This skill guides you through creating a comprehensive implementation plan for backend API endpoints and frontend features following RAPID project architecture patterns.

## When to Use

- Adding new backend API endpoints or features
- Modifying existing backend features
- Creating or modifying frontend components and hooks
- Database schema changes (Prisma models)
- Repository implementations
- Refactoring backend/frontend code
- Any non-trivial backend/frontend implementation task

**DO NOT proceed with implementation until explicitly told "Go" or "Proceed"**

## When NOT to Use

- **Modifying agent prompts or behavior** → use `/modify-agent-prompts`
- **Modifying Step Functions workflows** → use `/modify-cdk-workflows`
- **Simple builds or formatting** → use `/build-and-format`
- **Running database tests** → use `/test-database-feature`
- **Deploying to AWS** → use `/deploy-cdk-stack`

## Planning Requirements

### 1. Examine Existing Implementation

**MUST examine existing code** - speculation is strictly prohibited

```bash
# Backend: Check existing features
ls -la backend/src/api/features/

# Frontend: Check existing features
ls -la frontend/src/features/

# Check for similar implementations
```

### 2. Specify File Paths

Your plan MUST include specific paths for:
- **Files to create** - full absolute paths
- **Files to modify** - full absolute paths
- **Files to delete** - full absolute paths

### 3. Show Clear Diffs

- Focus only on essential changes
- Do not include entire file contents unnecessarily
- Show before/after for modified sections

## Backend Architecture Pattern

### Layered Structure

```
backend/src/api/features/{feature-name}/
├── domain/                    # Domain layer
│   ├── model/                 # Domain entities and types
│   │   └── {entity}.ts
│   ├── service/               # Domain services (optional)
│   │   └── {service}.ts
│   └── repository.ts          # Data access interface & implementation
├── usecase/                   # Application logic layer
│   └── {function-unit}.ts     # Use case implementations
└── routes/                    # Presentation layer
    ├── index.ts               # Route definitions
    └── handlers.ts            # HTTP request handlers
```

### Domain Layer Example

**model/checklist.ts**:
```typescript
export interface CheckListSetModel {
  id: string;
  name: string;
  description: string;
  documents: ChecklistDocumentModel[];
}

export const CheckListSetDomain = {
  fromCreateRequest: (req: CreateChecklistSetRequest): CheckListSetModel => {
    return {
      id: ulid(),
      name: req.name,
      description: req.description,
      documents: req.documents.map(doc => ({
        id: ulid(),
        name: doc.name,
        s3Key: doc.s3Key
      }))
    };
  }
};
```

**repository.ts**:
```typescript
export interface CheckRepository {
  storeCheckListSet(params: { checkListSet: CheckListSet }): Promise<void>;
  findAllCheckListSets(): Promise<CheckListSetMetaModel[]>;
  findCheckListSetById(id: string): Promise<CheckListSetModel | null>;
}

export const makePrismaCheckRepository = (
  client: PrismaClient = prisma
): CheckRepository => {
  return {
    async storeCheckListSet({ checkListSet }) {
      await client.checkListSet.create({
        data: {
          id: checkListSet.id,
          name: checkListSet.name,
          description: checkListSet.description,
          documents: {
            create: checkListSet.documents
          }
        }
      });
    },

    async findAllCheckListSets() {
      const sets = await client.checkListSet.findMany({
        select: { id: true, name: true, createdAt: true }
      });
      return sets;
    }
  };
};
```

### Use Case Layer Example

**usecase/checklist-set.ts**:
```typescript
export const createChecklistSet = async (params: {
  req: CreateChecklistSetRequest;
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || makePrismaCheckRepository();
  const checkListSet = CheckListSetDomain.fromCreateRequest(params.req);
  await repo.storeCheckListSet({ checkListSet });
};

export const getAllChecklistSets = async (params?: {
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<CheckListSetMetaModel[]> => {
  const repo = params?.deps?.repo || makePrismaCheckRepository();
  return await repo.findAllCheckListSets();
};
```

### Presentation Layer Example

**routes/index.ts**:
```typescript
import { FastifyInstance } from 'fastify';
import { getAllChecklistSetsHandler, createChecklistSetHandler } from './handlers';

export function registerChecklistRoutes(fastify: FastifyInstance): void {
  fastify.get('/checklist-sets', {
    handler: getAllChecklistSetsHandler,
  });

  fastify.post('/checklist-sets', {
    handler: createChecklistSetHandler,
  });
}
```

**routes/handlers.ts**:
```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { createChecklistSet, getAllChecklistSets } from '../usecase/checklist-set';

export const createChecklistSetHandler = async (
  request: FastifyRequest<{ Body: CreateChecklistSetRequest }>,
  reply: FastifyReply
): Promise<void> => {
  await createChecklistSet({ req: request.body });
  reply.code(200).send({ success: true, data: {} });
};

export const getAllChecklistSetsHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const data = await getAllChecklistSets();
  reply.code(200).send({ success: true, data });
};
```

## Frontend Architecture Pattern

### Feature-Based Structure

```
frontend/src/features/{feature-name}/
├── hooks/
│   ├── use{Feature}Queries.ts    # GET operations with SWR
│   └── use{Feature}Mutations.ts  # POST/PUT/PATCH/DELETE operations
├── components/
│   └── {Component}.tsx            # Feature-specific components
└── types/
    └── index.ts                   # Feature-specific types
```

### API Hooks Example

**hooks/useChecklistQueries.ts**:
```typescript
import useSWR from 'swr';
import { useApiClient } from '@/hooks/useApiClient';

export const useChecklistSets = () => {
  const { get } = useApiClient();

  return useSWR('/checklist-sets', async () => {
    const response = await get('/checklist-sets');
    return response.data;
  });
};

export const useChecklistSet = (id: string) => {
  const { get } = useApiClient();

  return useSWR(id ? `/checklist-sets/${id}` : null, async () => {
    const response = await get(`/checklist-sets/${id}`);
    return response.data;
  });
};
```

**hooks/useChecklistMutations.ts**:
```typescript
import { useApiClient } from '@/hooks/useApiClient';
import { mutate } from 'swr';

export const useChecklistMutations = () => {
  const { post, put, del } = useApiClient();

  const createChecklistSet = async (data: CreateChecklistSetRequest) => {
    const response = await post('/checklist-sets', data);
    mutate('/checklist-sets'); // Revalidate list
    return response.data;
  };

  const updateChecklistSet = async (id: string, data: UpdateChecklistSetRequest) => {
    const response = await put(`/checklist-sets/${id}`, data);
    mutate('/checklist-sets');
    mutate(`/checklist-sets/${id}`);
    return response.data;
  };

  const deleteChecklistSet = async (id: string) => {
    await del(`/checklist-sets/${id}`);
    mutate('/checklist-sets');
  };

  return { createChecklistSet, updateChecklistSet, deleteChecklistSet };
};
```

## Key Design Principles

### Backend

1. **Unidirectional Dependency**: routes → usecase → domain (never reverse)
2. **Dependency Injection**: External dependencies injected as parameters for testability
3. **Repository Pattern**: All database access through repositories (direct Prisma calls prohibited in StepFunctions)
4. **Type Safety**: Explicit interfaces for all domain models, requests, responses

### Frontend

1. **Feature-Based Organization**: Group related code by feature, not by type
2. **SWR for Data Fetching**: Use hooks with SWR for automatic caching and revalidation
3. **Component Reuse**: Check `src/components/` before creating new UI elements
4. **Type Safety**: Define types for all API requests and responses
5. **UI/CSS Design**: For component selection, color semantics, and styling patterns, use `/ui-css-patterns` skill

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

## Files to Delete
- None

## Implementation Steps
1. Backend domain layer
2. Backend use case layer
3. Backend routes layer
4. Frontend hooks
5. Frontend components (check `/ui-css-patterns` skill for styling guidance)

## Verification
- Run `/build-and-format` skill
- Run `/test-database-feature` skill (if database changes)
```

## After Planning

1. Review your plan for completeness
2. Ensure all file paths are specified
3. Verify architecture patterns are followed
4. **STOP and wait for "Go" or "Proceed" from user**
