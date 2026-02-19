# Backend Architecture Patterns

Reference implementations for the RAPID backend layered architecture.

## Layered Structure

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

## Domain Layer

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
          documents: { create: checkListSet.documents }
        }
      });
    },
    async findAllCheckListSets() {
      return await client.checkListSet.findMany({
        select: { id: true, name: true, createdAt: true }
      });
    }
  };
};
```

## Use Case Layer

```typescript
export const createChecklistSet = async (params: {
  req: CreateChecklistSetRequest;
  deps?: { repo?: CheckRepository };
}): Promise<void> => {
  const repo = params.deps?.repo || makePrismaCheckRepository();
  const checkListSet = CheckListSetDomain.fromCreateRequest(params.req);
  await repo.storeCheckListSet({ checkListSet });
};
```

## Presentation Layer

**routes/index.ts**:
```typescript
export function registerChecklistRoutes(fastify: FastifyInstance): void {
  fastify.get('/checklist-sets', { handler: getAllChecklistSetsHandler });
  fastify.post('/checklist-sets', { handler: createChecklistSetHandler });
}
```

**routes/handlers.ts**:
```typescript
export const createChecklistSetHandler = async (
  request: FastifyRequest<{ Body: CreateChecklistSetRequest }>,
  reply: FastifyReply
): Promise<void> => {
  await createChecklistSet({ req: request.body });
  reply.code(200).send({ success: true, data: {} });
};
```
