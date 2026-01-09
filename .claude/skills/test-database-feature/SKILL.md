---
name: test-database-feature
description: Run tests with local database setup and repository pattern
---

# Test Database Feature

This skill guides you through testing features that interact with the database using repository integration tests.

## When to Use

- After implementing new repository methods
- After modifying database schema
- Testing use cases that depend on database
- Verifying data access patterns

## Prerequisites

### 1. Start Local Database

```bash
# From project root
docker-compose -f assets/local/docker-compose.yml up -d
```

**Database Configuration**:
- Host: `localhost`
- Port: `3306`
- Database: `rapid_db`
- User: `rapid_user`
- Password: `rapid_password`

**Verify Database is Running**:
```bash
docker ps | grep mysql
```

### 2. Setup Prisma

```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed initial data (optional)
npm run db:seed
```

## Repository Integration Test Pattern

Repository tests MUST connect to actual database (not mocks).

### Example: Checklist Repository Test

Based on `backend/src/api/features/checklist-management/__tests__/repository-integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { makePrismaCheckRepository } from '../domain/repository';

// Use actual database connection
const prisma = new PrismaClient();

describe('CheckRepository Integration Tests', () => {
  // Clean up before each test
  beforeEach(async () => {
    await prisma.checkListSet.deleteMany();
  });

  it('should store and retrieve checklist set', async () => {
    const repo = makePrismaCheckRepository(prisma);

    // Create test data
    const checkListSet = {
      id: 'test-id-1',
      name: 'Test Checklist',
      description: 'Test Description',
      documents: [
        {
          id: 'doc-1',
          name: 'Document 1',
          s3Key: 'test/doc1.pdf'
        }
      ]
    };

    // Store
    await repo.storeCheckListSet({ checkListSet });

    // Retrieve
    const sets = await repo.findAllCheckListSets();

    // Verify
    expect(sets).toHaveLength(1);
    expect(sets[0].name).toBe('Test Checklist');
  });

  it('should find checklist set by id', async () => {
    const repo = makePrismaCheckRepository(prisma);

    // Setup: Create test data
    const checkListSet = {
      id: 'test-id-2',
      name: 'Another Checklist',
      description: 'Another Description',
      documents: []
    };
    await repo.storeCheckListSet({ checkListSet });

    // Test: Find by ID
    const found = await repo.findCheckListSetById('test-id-2');

    // Verify
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Another Checklist');
  });

  it('should return null for non-existent id', async () => {
    const repo = makePrismaCheckRepository(prisma);

    const found = await repo.findCheckListSetById('non-existent');

    expect(found).toBeNull();
  });
});
```

## Running Tests

### Run All Tests

```bash
cd backend
npm test
```

### Run Specific Test Suite

```bash
cd backend
npm run test -- checklist-management
```

### Run Tests in Watch Mode

```bash
cd backend
npm run test:watch
```

### Run Tests with Coverage

```bash
cd backend
npm run test:coverage
```

## Test Organization

```
backend/src/api/features/{feature}/__tests__/
├── repository-integration.test.ts  # Database integration tests
├── usecase.test.ts                 # Use case unit tests (mocked repo)
└── handlers.test.ts                # Handler unit tests (mocked usecase)
```

## Writing Repository Tests

### Best Practices

1. **Use Actual Database**: Never mock Prisma client in repository tests
2. **Clean Before Each**: Use `beforeEach` to ensure clean state
3. **Test Real Scenarios**: Cover actual database operations
4. **Verify Data Integrity**: Check that data is correctly stored and retrieved

### Repository Test Template

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { makeYourRepository } from '../domain/repository';

const prisma = new PrismaClient();

describe('YourRepository Integration Tests', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.yourModel.deleteMany();
  });

  afterAll(async () => {
    // Disconnect Prisma client
    await prisma.$disconnect();
  });

  it('should create and retrieve entity', async () => {
    const repo = makeYourRepository(prisma);

    // 1. Create test entity
    const entity = {
      id: 'test-1',
      name: 'Test Entity',
      // ... other fields
    };

    // 2. Store entity
    await repo.storeEntity({ entity });

    // 3. Retrieve entity
    const retrieved = await repo.findEntityById('test-1');

    // 4. Verify
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Test Entity');
  });

  it('should update entity', async () => {
    const repo = makeYourRepository(prisma);

    // Setup
    const entity = { id: 'test-2', name: 'Original' };
    await repo.storeEntity({ entity });

    // Test update
    await repo.updateEntity({ id: 'test-2', name: 'Updated' });

    // Verify
    const updated = await repo.findEntityById('test-2');
    expect(updated?.name).toBe('Updated');
  });

  it('should delete entity', async () => {
    const repo = makeYourRepository(prisma);

    // Setup
    const entity = { id: 'test-3', name: 'To Delete' };
    await repo.storeEntity({ entity });

    // Test delete
    await repo.deleteEntity('test-3');

    // Verify
    const deleted = await repo.findEntityById('test-3');
    expect(deleted).toBeNull();
  });
});
```

## Database Management Commands

### View Database in Prisma Studio

```bash
cd backend
npm run prisma:studio
```

Access at: `http://localhost:5555`

### Reset Local Database

```bash
# From project root
docker-compose -f assets/local/docker-compose.yml down -v
docker-compose -f assets/local/docker-compose.yml up -d

# Re-run migrations
cd backend
npm run prisma:migrate
npm run db:seed
```

### Check Database Connection

```bash
cd backend
npx prisma db pull  # Test connection and pull schema
```

## Troubleshooting

### Database Connection Errors

**Error**: `Can't reach database server at localhost:3306`

**Solutions**:
1. Check Docker container is running:
   ```bash
   docker ps | grep mysql
   ```

2. Restart Docker container:
   ```bash
   docker-compose -f assets/local/docker-compose.yml restart
   ```

3. Check MySQL logs:
   ```bash
   docker-compose -f assets/local/docker-compose.yml logs mysql
   ```

### Prisma Client Errors

**Error**: `@prisma/client did not initialize yet`

**Solution**:
```bash
cd backend
rm -rf node_modules/.prisma
npm run prisma:generate
```

### Migration Errors

**Error**: `Migration {name} failed`

**Solutions**:
1. Check migration file syntax
2. Manually fix database schema
3. Reset database (development only):
   ```bash
   docker-compose -f assets/local/docker-compose.yml down -v
   docker-compose -f assets/local/docker-compose.yml up -d
   cd backend && npm run prisma:migrate
   ```

### Test Timeout Errors

**Error**: `Test timed out`

**Solutions**:
1. Increase test timeout in vitest config
2. Check database connection is not hanging
3. Verify no deadlocks in test setup

## Quick Reference

| Task | Command |
|------|---------|
| Start DB | `docker-compose -f assets/local/docker-compose.yml up -d` |
| Stop DB | `docker-compose -f assets/local/docker-compose.yml down` |
| Reset DB | Add `-v` flag to down command, then up |
| Generate Prisma | `cd backend && npm run prisma:generate` |
| Run migrations | `cd backend && npm run prisma:migrate` |
| Seed data | `cd backend && npm run db:seed` |
| Run tests | `cd backend && npm test` |
| Run specific test | `cd backend && npm run test -- {test-name}` |
| Prisma Studio | `cd backend && npm run prisma:studio` |

## Success Criteria

✅ **Database running**: Docker container active
✅ **Migrations applied**: Schema matches Prisma schema
✅ **Tests pass**: All repository integration tests succeed
✅ **Data verified**: Prisma Studio shows correct data structure

## After Testing

1. ✅ All repository tests passed
2. ✅ Database operations work correctly
3. Ready to run `/build-and-format` for final verification
4. Consider running full test suite: `npm test`
