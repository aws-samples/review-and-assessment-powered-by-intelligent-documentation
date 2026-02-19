# Agent Development Guidelines

## Quick Reference: Skills

Use these skills for common workflows:
- **`/plan-backend-frontend`** - Plan backend API and frontend features with RAPID architecture
- **`/build-and-format`** - Build verification and code formatting
- **`/test-database-feature`** - Repository integration tests with local database
- **`/deploy-cdk-stack`** - AWS deployment (only when explicitly asked)
- **`/modify-cdk-workflows`** - CDK Step Functions workflow modifications
- **`/modify-agent-prompts`** - Agent prompts, models, and tool configuration
- **`/add-example`** - Add example use cases with thumbnails and link verification
- **`/ui-css-patterns`** - UI/CSS design patterns and component reference

## Project Overview

This is an all-TypeScript project with the following structure:

- cdk/ - Infrastructure as Code
  - package.json
- backend/ - API and business logic
  - package.json
- frontend/ - React SPA with Tailwind CSS
  - package.json
- review-item-processor/ - Review item assessment agent (project root level, NOT under backend/)
  - **Python project: use `uv` for all package management and command execution**

**IMPORTANT**: There is NO package.json in the root directory. Do NOT create one using npm init.

## Development Workflow

### Planning Phase

Use **`/plan-backend-frontend`** skill for structured planning with architecture patterns.

Key requirements:
- ALWAYS examine existing implementation first - speculation is prohibited
- MUST include specific paths for files to create/modify/delete
- MUST show clear, concise diffs focusing only on essential changes
- **DO NOT proceed with implementation until explicitly told "Go" or "Proceed"**

### Implementation Phase

After implementation:
1. Use **`/build-and-format`** skill to verify builds and run formatting
2. For database changes: Use **`/test-database-feature`** skill

## Memory Management

I am an AI assistant whose memory resets completely between sessions. This drives me to maintain perfect documentation. After each reset, I rely ENTIRELY on documentation to understand the project and continue work effectively. I MUST read ALL relevant documentation at the start of EVERY task - this is not optional.

### Documentation Updates

Documentation updates occur when:

1. Discovering new project patterns
2. After implementing significant changes
3. When user requests with **update memory bank**
4. When context needs clarification

---

# Backend Development

## Language and Framework Standards

- **TypeScript only** (ESM format) - JavaScript and Python prohibited except review-item-processor
- **Testing**: vitest only - jest prohibited
- **Web Framework**: Fastify for REST API
  - Implementation under src/api
  - Common core: src/api/core
  - Domain functionality: src/api/features
  - Layered architecture adopted

## Testing

- vitest (**jest is prohibited**)
- When implementing, refer to existing tests
  - example) backend/src/features/document-processing/**tests**

### Verification

Use **`/build-and-format`** and **`/test-database-feature`** skills.

For manual commands:
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

## Database

- MySQL with Prisma ORM
- Schema: backend/prisma/schema.prisma
- **Repository Pattern (MANDATORY)**: All data access MUST go through repositories
  - Direct Prisma calls prohibited in StepFunctions handlers (src/checklist-workflow, src/review-workflow)
  - Repository tests MUST connect to actual DB (not mocks)

### Repository Pattern

**Interface Definition**:
```typescript
// domain/repository.ts
export interface CheckRepository {
  storeCheckListSet(params: { checkListSet: CheckListSet }): Promise<void>;
  findAllCheckListSets(): Promise<CheckListSetMetaModel[]>;
  findCheckListSetById(id: string): Promise<CheckListSetModel | null>;
}
```

**Implementation with Dependency Injection**:
```typescript
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
          documents: { create: checkListSet.documents }
        }
      });
    },

    async findAllCheckListSets() {
      return await client.checkListSet.findMany({
        select: { id: true, name: true, createdAt: true }
      });
    },

    async findCheckListSetById(id: string) {
      return await client.checkListSet.findOne({ where: { id } });
    }
  };
};
```

**Repository Integration Testing**:
See `/test-database-feature` skill for complete examples and patterns.

Example test pattern location: `backend/src/api/features/{feature}/__tests__/`

## Backend Coding Standards

### Basic Principles

- Language: Only TypeScript (ESM format)
- Architecture: Layered architecture adopted
- Database: MySQL connection using Prisma

### Directory Structure

```
src/api/features/{feature-name}/
├── domain/                    # Domain layer
│   ├── model/                 # Domain model
│   ├── service/               # Domain service
│   └── repository.ts          # Repository interface and implementation
├── usecase/                   # Use case layer
│   └── {function-unit}.ts     # Use case implementation by function unit
└── routes/                    # Presentation layer
    ├── index.ts               # Route definition
    └── handlers.ts            # Handler implementation
```

### Layer Structure and Responsibilities

#### 1. Domain Layer (domain/)

Responsibility: Business logic and domain model definition

**Model (model/)**:
- Type definitions for domain entities
- Conversion logic for domain objects

**Repository (repository.ts)**:
- Interface definition for data access
- Implementation of database operations

#### 2. Use Case Layer (usecase/)

Responsibility: Implementation of application use cases, manipulation of domain objects

- Files divided by functional units
- Use of dependency injection pattern (improves testability)
- Depends only on the domain layer

Example:
```typescript
// usecase/checklist-set.ts
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
```

#### 3. Presentation Layer (routes/)

Responsibility: Processing HTTP requests/responses, routing

**Route Definition (index.ts)**:
- Definition of endpoints
- Registration of handlers

**Handler (handlers.ts)**:
- Request validation
- Use case invocation
- Response formatting

### Design Principles

1. **Unidirectional Dependency**
   - Dependencies only flow in one direction: routes → usecase → domain
   - Reverse dependencies are prohibited

2. **Dependency Injection**
   - External dependencies injected as parameters for testability
   - Default implementations provided for ease of use

3. **Type Safety**
   - Clear interface and type definitions
   - Explicit definition of request/response types

4. **Error Handling**
   - Definition of domain-specific errors
   - Appropriate mapping to HTTP status codes

5. **Transaction Management**
   - Use transactions for operations involving multiple steps

### StepFunctions Handler Design

- src/checklist-workflow, src/review-workflow, etc.
- **Direct calls to prisma client are strictly prohibited**. Always access data through repositories

---

# Frontend Development

## Basics

- vite React SPA
- tailwind
  - **Styling must always use frontend/tailwind.config.js**
    - Modification of frontend/tailwind.config.js is strictly forbidden
- Directory structure
  - Composed of pages, hooks, components, etc.
  - API fetching patterns:
    - Check if existing hooks can handle the requirement (useHttp, useApiClient, useDocumentUpload, usePresignedDownloadUrl)
    - If new hooks are needed:
      - Use `useApiClient` for implementation
      - Classify into `queries` (GET operations) or `mutations` (POST/PUT/PATCH/DELETE operations)
      - Place in `features/{feature-name}/hooks/` directory
      - Follow naming convention: `use{Feature}Queries.ts` and `use{Feature}Mutations.ts`
  - SWR is used for data fetching
  - Items used commonly across the app like hooks can be placed at the src root, but basically adopt a feature-based approach
    - Create features/\* directories for each function, placing hooks, components, etc. under them
- Before implementation, check and understand the backend endpoints
  - Detailed in API specifications

## Language

- **All TypeScript** - JavaScript strictly forbidden

## Core Component Usage

- When implementing, always attempt to use components under frontend/src/components
  - e.g., when using buttons. If insufficient, create inherited buttons under respective features/components
  - Especially avoid overusing the `<button>` tag. Always use components

### Alerts and Confirmations

- Native `alert()` and `confirm()` methods are prohibited
- Always use `useAlert` hook and `AlertModal` component
- Usage example:

```tsx
const { showAlert, showConfirm, showSuccess, showError, AlertModal } =
  useAlert();

// Show alerts
showAlert("Information message");
showSuccess("Operation completed successfully");
showError("An error occurred");

// Show confirmation dialog
showConfirm("Are you sure you want to delete this item?", {
  title: "Confirm Deletion",
  confirmButtonText: "Delete",
  onConfirm: () => handleDelete(),
  onCancel: () => console.log("Cancelled"),
});

// Don't forget to include the AlertModal component in your render
return (
  <div>
    {/* Your component content */}
    <AlertModal />
  </div>
);
```

## Icons

- SVG usage is prohibited, always use react-icons

---

# CDK Development

## Parameters

The project uses a two-file architecture for CDK parameters:

1. `cdk/lib/parameter.ts` - Simple user-facing parameter configuration
2. `cdk/lib/parameter-schema.ts` - Parameter schema definitions with validation rules

### Adding a New Parameter

When adding a new parameter, follow these steps:

1. **First, add parameter definition in `parameter-schema.ts`**

```typescript
const parameterSchema = z.object({
  // Existing parameters...

  // Add the new parameter with validation and default value
  newParameterName: z
    .string() // or appropriate type (number, boolean, etc.)
    .min(1, "newParameterName must not be empty")
    .default("default-value"),
});
```

2. **Update any necessary type references**
   - The `Parameters` type is automatically derived from the schema
   - No need to manually update type definitions

## Deployment

Use **`/deploy-cdk-stack`** skill for deployment. Execute only when explicitly asked to "please deploy".

## Parameter Customization Options

Parameters can be customized in three ways (in order of precedence):

1. **Command line (highest priority)**

```bash
# Dot notation
cdk deploy --context rapid.paramName="value"

# JSON format
cdk deploy --context rapid='{"paramName":"value"}'
```

2. **parameter.ts file**

```typescript
export const parameters = {
  paramName: "custom-value",
};
```

3. **Default values in parameter-schema.ts (lowest priority)**

## Key Principles

- Maintain consistency with existing code patterns
- Follow TypeScript best practices
- Ensure code passes all linting and build processes
- Prioritize clear documentation of changes
