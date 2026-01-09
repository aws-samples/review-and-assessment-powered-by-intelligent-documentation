---
name: build-and-format
description: Verify builds pass and format code after implementation
---

# Build and Format Verification

This skill runs build verification and code formatting across all project components.

## When to Use

- After implementing any code changes
- Before committing code
- After modifying Prisma schema
- Before creating a pull request

## Sequential Build Verification

### 1. Backend Build

```bash
cd backend
npm run build
npm run format
```

**Expected Output**:
- TypeScript compilation succeeds
- No type errors
- Prettier formats all files

**Common Errors**:

| Error | Cause | Solution |
|-------|-------|----------|
| `Module not found: @prisma/client` | Prisma client not generated | Run `npm run prisma:generate` |
| `TS2304: Cannot find name` | Type definition missing | Check imports and type exports |
| `TS2345: Argument of type X is not assignable` | Type mismatch | Review function signatures |

### 2. Frontend Build

```bash
cd frontend
npm run build
npm run format
```

**Expected Output**:
- Vite builds successfully
- All React components compile
- Tailwind CSS processes correctly
- Prettier formats all files

**Common Errors**:

| Error | Cause | Solution |
|-------|-------|----------|
| `Module "X" has no exported member` | Import from wrong path | Check export statements |
| `Property X does not exist on type Y` | Type mismatch | Review component props |
| `Cannot find module '@/...'` | Path alias issue | Check tsconfig paths |

### 3. CDK Synthesis

```bash
cd cdk
npx cdk synth
```

**Expected Output**:
- CloudFormation template generates successfully
- No CDK construct errors
- Stack validation passes

**Common Errors**:

| Error | Cause | Solution |
|-------|-------|----------|
| `Cannot find module '../backend/...'` | Backend not built | Run `cd backend && npm run build` first |
| `Docker daemon not running` | Docker not started | Start Docker Desktop (macOS) or Docker service |
| `Asset build failed` | Lambda bundling error | Check esbuild configuration |

## Full Build Sequence

Run all builds in correct order:

```bash
# From project root

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

# 1. Generate Prisma client
npm run prisma:generate

# 2. Build backend
npm run build

# 3. Format
npm run format
```

## Troubleshooting

### Docker Issues

**macOS**: Ensure Docker Desktop is running
```bash
# Check Docker status
docker ps

# If not running, start Docker Desktop from Applications
```

**Linux**: Ensure Docker service is active
```bash
sudo systemctl status docker
sudo systemctl start docker  # If not running
```

### Prisma Generation Errors

```bash
# Delete generated client and regenerate
cd backend
rm -rf node_modules/.prisma
npm run prisma:generate
```

### Node Modules Issues

```bash
# Clean install for specific component
cd backend  # or frontend, or cdk
rm -rf node_modules package-lock.json
npm ci
```

### Build Cache Issues

```bash
# Clear TypeScript build cache
cd backend  # or frontend
rm -rf dist
npm run build
```

## Quick Commands Reference

| Task | Command |
|------|---------|
| Backend build | `cd backend && npm run build` |
| Backend format | `cd backend && npm run format` |
| Frontend build | `cd frontend && npm run build` |
| Frontend format | `cd frontend && npm run format` |
| CDK synth | `cd cdk && npx cdk synth` |
| Prisma generate | `cd backend && npm run prisma:generate` |
| Full sequence | Backend build → Frontend build → CDK synth |

## Success Criteria

✅ **All builds pass**:
- Backend: TypeScript compiles without errors
- Frontend: Vite builds without errors
- CDK: CloudFormation template generates

✅ **All formatting passes**:
- Backend: Prettier formats `.ts` files
- Frontend: Prettier formats `.ts`, `.tsx` files

✅ **No console errors**:
- Check terminal output for warnings
- Review error messages if any

## After Successful Build

1. ✅ All builds passed
2. ✅ All code formatted
3. Ready to commit or proceed with testing
4. Consider running `/test-database-feature` if database changes were made
