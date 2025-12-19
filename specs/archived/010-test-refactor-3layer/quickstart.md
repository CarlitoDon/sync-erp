# Quickstart: Test Refactor for 3-Layer API

## Prerequisites

- Node.js 18+
- npm workspaces configured
- API tests passing before refactor (baseline)

## Quick Commands

### Run All API Tests

```bash
npm run test --workspace=@sync-erp/api
```

### Run Single Service Test

```bash
npm run test --workspace=@sync-erp/api -- --grep "ProductService"
```

### Run Route Tests Only

```bash
npm run test --workspace=@sync-erp/api -- test/unit/routes/
```

### Run with Verbose Output

```bash
npm run test --workspace=@sync-erp/api -- --reporter=verbose
```

## Understanding the Changes

### Before (Single-Layer)

```
Service → Prisma Client → Database
```

Tests mocked `prisma.client` methods directly.

### After (3-Layer)

```
Controller → Service → Repository → Prisma → Database
```

- **Route tests**: Mock Service layer
- **Service tests**: Mock Repository layer
- **Repository tests**: Mock Prisma (or use integration tests)

## Files Changed

| File Type     | Count | Location                               |
| ------------- | ----- | -------------------------------------- |
| New mock file | 1     | `test/unit/mocks/repositories.mock.ts` |
| Service tests | 15    | `test/unit/services/*.test.ts`         |
| Service mocks | 1     | `test/unit/mocks/services.mock.ts`     |

## Validation Checklist

- [ ] `npm run test --workspace=@sync-erp/api` exits with code 0
- [ ] No "(0 test)" in output for any test file
- [ ] No "Server Error" in stderr output
- [ ] Test count >= baseline (no regression)
