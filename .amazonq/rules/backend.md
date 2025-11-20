# Backend Special Notes

## Project Structure Note

- Backend API implementation: `backend/src/`
- Review item processing agents: Project root level
  - `review-item-processor/` - Review item assessment agent implementation
  - Example: `review-item-processor/tool_history_collector.py`
- These agent implementations are NOT under the `backend/` directory

## Language

- All TypeScript. Python prohibited, JavaScript also prohibited
- CommonJS strictly forbidden. ES Modules (ESM) must be used at all times

## Web Framework

- REST API uses Fastify
- Implementation should be done under src/api
- Common core implementation: src/api/core
- Domain-specific functionality: src/api/features
- Layered architecture is adopted

## Testing

- vitest (**jest is prohibited**)
- When implementing, refer to existing tests
  - example) backend/src/features/document-processing/**tests**

### Verification

```bash
# Run unit tests
npm run test -- test-suite

# Run all tests
npm test

# Check if build passes
npm run build

# Format after successful build
npm run format
```

## DB

- MySQL
- Prisma
  - refer to backend/prisma/schema.prisma
- Repository unit tests should connect to an actual DB to verify behavior. Refer to backend/src/api/features/checklist-management/**tests**/repository-integration.test.ts
  - Note that in this case, you need to perform migration/seed by referring to backend/package.json

# Backend Coding Standards

## Basic Principles

• Language: Only TypeScript (ESM format)
• Architecture: Layered architecture adopted
• Database: MySQL connection using Prisma

## Directory Structure

src/api/features/{feature-name}/
├── domain/ # Domain layer
│ ├── model/ # Domain model
│ ├── service/ # Domain service
│ └── repository.ts # Repository interface and implementation
├── usecase/ # Use case layer
│ └── {function-unit}.ts # Use case implementation by function unit
└── routes/ # Presentation layer
├── index.ts # Route definition
└── handlers.ts # Handler implementation

**Note:** Review item processing agents are located at project root level (e.g., `review-item-processor/`), not under `backend/`.

## Layer Structure and Responsibilities

### 1. Domain Layer (domain/)

Responsibility: Business logic and domain model definition

#### Model (model/)

• Type definitions for domain entities
• Conversion logic for domain objects

Example:

```typescript
// domain/model/checklist.ts
export interface CheckListSetModel {
  id: string;
  name: string;
  description: string;
  documents: ChecklistDocumentModel[];
}

export const CheckListSetDomain = {
  fromCreateRequest: (req: CreateChecklistSetRequest): CheckListSetModel => {
    // Logic for converting from request to domain model
  },
};
```

#### Repository (repository.ts)

• Interface definition for data access
• Implementation of database operations

Example:

```typescript
// domain/repository.ts
export interface CheckRepository {
  storeCheckListSet(params: { checkListSet: CheckListSet }): Promise<void>;
  findAllCheckListSets(): Promise<CheckListSetMetaModel[]>;
}

export const makePrismaCheckRepository = (
  client: PrismaClient = prisma
): CheckRepository => {
  // Implementation
};
```

### 2. Use Case Layer (usecase/)

Responsibility: Implementation of application use cases, manipulation of domain objects

• Files divided by functional units
• Use of dependency injection pattern (improves testability)
• Depends only on the domain layer

Example:

```typescript
// usecase/checklist-set.ts
export const createChecklistSet = async (params: {
  req: CreateChecklistSetRequest;
  deps?: {
    repo?: CheckRepository;
  };
}): Promise<void> => {
  const repo = params.deps?.repo || (await makePrismaCheckRepository());
  const checkListSet = CheckListSetDomain.fromCreateRequest(req);
  await repo.storeCheckListSet({ checkListSet });
};
```

### 3. Presentation Layer (routes/)

Responsibility: Processing HTTP requests/responses, routing

#### Route Definition (index.ts)

• Definition of endpoints
• Registration of handlers

Example:

```typescript
// routes/index.ts
export function registerChecklistRoutes(fastify: FastifyInstance): void {
  fastify.get("/checklist-sets", {
    handler: getAllChecklistSetsHandler,
  });

  fastify.post("/checklist-sets", {
    handler: createChecklistSetHandler,
  });
}
```

#### Handler (handlers.ts)

• Request validation
• Use case invocation
• Response formatting

Example:

```typescript
// routes/handlers.ts
export const createChecklistSetHandler = async (
  request: FastifyRequest<{ Body: CreateChecklistSetRequest }>,
  reply: FastifyReply
): Promise<void> => {
  await createChecklistSet({
    req: request.body,
  });

  reply.code(200).send({
    success: true,
    data: {},
  });
};
```

## Design Principles

1. Unidirectional Dependency
   • Dependencies only flow in one direction: routes → usecase → domain
   • Reverse dependencies are prohibited

2. Dependency Injection
   • External dependencies injected as parameters for testability
   • Default implementations provided for ease of use

3. Type Safety
   • Clear interface and type definitions
   • Explicit definition of request/response types

4. Error Handling
   • Definition of domain-specific errors
   • Appropriate mapping to HTTP status codes

5. Transaction Management
   • Use transactions for operations involving multiple steps

## StepFunctions Handler Design

- src/checklist-workflow, src/review-workflow, etc.
- Direct calls to prisma client are strictly prohibited. Always access data through repositories
