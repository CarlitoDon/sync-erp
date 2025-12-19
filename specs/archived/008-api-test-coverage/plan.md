# Implementation Plan: API Test Coverage

**Branch**: `008-api-test-coverage` | **Date**: 2025-12-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-api-test-coverage/spec.md`

## Summary

Write comprehensive tests for the API layer to achieve minimum 80% test coverage across all source files. This includes unit tests for services and middlewares, and integration tests for routes.

## Current Coverage Status

| Category    | Files  | Current Coverage | Target  |
| ----------- | ------ | ---------------- | ------- |
| Services    | 18     | 33.59%           | 80%     |
| Routes      | 13     | 0%               | 80%     |
| Middlewares | 3      | 0%               | 80%     |
| **Overall** | **34** | **20.86%**       | **80%** |

## Technical Context

**Language/Version**: TypeScript 5.3.3, Node.js 18+  
**Testing Framework**: Vitest 1.6.1  
**Coverage Provider**: @vitest/coverage-v8 (✅ configured)  
**Database**: PostgreSQL via Prisma (needs mocking for unit tests)  
**Project Type**: Monorepo (apps/api workspace)

## Constitution Check

- [x] **I. Boundaries**: Tests are within apps/api, no frontend impact
- [x] **II. Dependencies**: Tests use existing packages only
- [x] **III. Contracts**: No shared types modified
- [x] **IV. Layered Backend**: Tests follow Controller-Service-Repository pattern
- [x] **V. Multi-Tenant**: Tests must include companyId in test data

✅ All gates pass.

## Files to Test

### Services (18 files) - Priority 1

| File                     | Lines | Current Coverage | Priority |
| ------------------------ | ----- | ---------------- | -------- |
| BillService.ts           | 201   | 0%               | HIGH     |
| CompanyService.ts        | 97    | 0%               | HIGH     |
| PartnerService.ts        | 106   | 0%               | HIGH     |
| PaymentService.ts        | 137   | 0%               | HIGH     |
| ReportService.ts         | 236   | 0%               | HIGH     |
| UserService.ts           | 100   | 0%               | HIGH     |
| authService.ts           | 83    | 0%               | HIGH     |
| authUtil.ts              | 11    | 0%               | LOW      |
| sessionService.ts        | 33    | 0%               | LOW      |
| DocumentNumberService.ts | 125   | 0%               | MEDIUM   |
| AccountService.ts        | 126   | 50.39%           | MEDIUM   |
| PurchaseOrderService.ts  | 165   | 31.32%           | MEDIUM   |
| SalesOrderService.ts     | 200   | 42.78%           | MEDIUM   |
| InventoryService.ts      | 268   | 53.65%           | LOW      |
| InvoiceService.ts        | 205   | 69.41%           | LOW      |
| JournalService.ts        | 303   | 71.72%           | LOW      |
| ProductService.ts        | 148   | 66.88%           | LOW      |
| FulfillmentService.ts    | 69    | 81.42%           | ✅ DONE  |

### Routes (13 files) - Priority 2

| File             | Lines | Notes                   |
| ---------------- | ----- | ----------------------- |
| auth.ts          | 127   | Login, register, logout |
| bill.ts          | 103   | CRUD + post             |
| company.ts       | 73    | Company management      |
| finance.ts       | 173   | Journal, reports        |
| health.ts        | 14    | Health check            |
| inventory.ts     | 68    | Stock management        |
| invoice.ts       | 103   | CRUD + post             |
| partner.ts       | 119   | Customer/Supplier       |
| payment.ts       | 67    | Payment processing      |
| product.ts       | 107   | Product CRUD            |
| purchaseOrder.ts | 87    | PO management           |
| salesOrder.ts    | 100   | SO management           |
| user.ts          | 48    | User management         |

### Middlewares (3 files) - Priority 2

| File            | Lines | Notes             |
| --------------- | ----- | ----------------- |
| auth.ts         | 126   | JWT verification  |
| errorHandler.ts | 80    | Error formatting  |
| rbac.ts         | 236   | Role-based access |

## Test Strategy

### Unit Tests (Services, Middlewares)

- Mock Prisma client to avoid database calls
- Test each public method
- Cover success and error paths
- Cover all branches

### Integration Tests (Routes)

- Use real database with transaction rollback
- Test request/response cycle
- Test authentication flows
- Test authorization (RBAC)

## Project Structure

```text
apps/api/test/
├── unit/
│   ├── services/
│   │   ├── AccountService.test.ts
│   │   ├── BillService.test.ts
│   │   ├── CompanyService.test.ts
│   │   ├── ... (all 18 services)
│   └── middlewares/
│       ├── auth.test.ts
│       ├── errorHandler.test.ts
│       └── rbac.test.ts
├── integration/
│   └── (existing tests)
└── e2e/
    └── (existing tests)
```

## Proposed Phases

### Phase 1: Setup (✅ COMPLETE)

- Coverage tooling configured

### Phase 2: Service Unit Tests (Priority 1)

- Test 9 services with 0% coverage first
- Then improve services with <80% coverage

### Phase 3: Middleware Unit Tests

- auth.ts, errorHandler.ts, rbac.ts

### Phase 4: Route Integration Tests

- All 13 route files

### Phase 5: Verification

- Run full coverage, verify 80% threshold met
