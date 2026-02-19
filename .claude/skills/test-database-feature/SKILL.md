---
name: test-database-feature
description: Run repository integration tests against a local MySQL database for the RAPID backend. Use after implementing new repository methods, modifying Prisma database schema, testing use cases that depend on database access, or verifying data access patterns.
---

# Test Database Feature

## Prerequisites

### 1. Start Local Database

```bash
docker-compose -f assets/local/docker-compose.yml up -d
```

Database: `localhost:3306`, DB: `rapid_db`, User: `rapid_user`, Password: `rapid_password`

### 2. Setup Prisma

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

## Repository Integration Test Pattern

Repository tests MUST connect to actual database (not mocks).

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { makeYourRepository } from '../domain/repository';

const prisma = new PrismaClient();

describe('YourRepository Integration Tests', () => {
  beforeEach(async () => {
    await prisma.yourModel.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create and retrieve entity', async () => {
    const repo = makeYourRepository(prisma);
    const entity = { id: 'test-1', name: 'Test Entity' };

    await repo.storeEntity({ entity });
    const retrieved = await repo.findEntityById('test-1');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Test Entity');
  });
});
```

## Test Organization

```
backend/src/api/features/{feature}/__tests__/
├── repository-integration.test.ts  # Database integration tests
├── usecase.test.ts                 # Use case unit tests (mocked repo)
└── handlers.test.ts                # Handler unit tests (mocked usecase)
```

## Running Tests

```bash
cd backend
npm test                          # All tests
npm run test -- {test-name}       # Specific test suite
npm run test:watch                # Watch mode
npm run test:coverage             # With coverage
```

## Quick Commands

| Task | Command |
|------|---------|
| Start DB | `docker-compose -f assets/local/docker-compose.yml up -d` |
| Stop DB | `docker-compose -f assets/local/docker-compose.yml down` |
| Reset DB | Add `-v` to down, then up + migrate |
| Run migrations | `cd backend && npm run prisma:migrate` |
| Prisma Studio | `cd backend && npm run prisma:studio` (http://localhost:5555) |

## Success Criteria

- Docker container running
- Migrations applied
- All repository integration tests pass
- Ready to run `/build-and-format` for final verification
