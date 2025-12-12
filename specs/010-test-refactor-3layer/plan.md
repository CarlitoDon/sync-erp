# Implementation Plan: Test Refactor for 3-Layer API Architecture

**Branch**: `010-test-refactor-3layer` | **Date**: 2025-12-12 | **Spec**: [spec.md](file:///c:/Offline/Coding/sync-erp/specs/010-test-refactor-3layer/spec.md)

## Summary

Setelah refaktor API ke 3-layer architecture (Controller → Service → Repository), 15 service unit tests menunjukkan "(0 test)" karena import path rusak dan mock strategy tidak lagi sesuai. Route tests juga gagal karena service memanggil repository yang tidak di-mock. Plan ini akan:

1. Update import paths di semua service tests
2. Buat repository mock infrastructure
3. Refaktor service tests untuk mock repository layer
4. Fix route tests agar mock service layer dengan benar

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Express, Vitest, Prisma Client  
**Storage**: PostgreSQL via Prisma  
**Testing**: Vitest (unit, integration, e2e)  
**Target Platform**: Node.js API server  
**Project Type**: Turborepo monorepo

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Boundaries**: Does Frontend strictly avoid direct DB/Logic imports?
- [x] **II. Dependencies**: Are dependencies uni-directional (Apps -> Packages)?
- [x] **III. Contracts**: Are shared types defined in `packages/shared-types`?
- [x] **IV. Layered Backend**: Is logic strictly in Services (not Controllers)?
- [x] **IV. Repository Pattern**: Is DB access strictly in Repositories (not Services)?
- [x] **V. Multi-Tenant**: Is ALL data isolated by `companyId`?

## Root Cause Analysis

### Problem 1: Broken Import Paths

Service test files import from deleted old paths:

```typescript
// OLD (broken)
import { ProductService } from '../../../src/services/ProductService';
// NEW (correct)
import { ProductService } from '../../../src/modules/product/product.service';
```

### Problem 2: Wrong Mock Layer

Old tests mock Prisma directly, but services now call repositories:

```typescript
// OLD approach - mocks Prisma
mockPrisma.product.create.mockResolvedValue(...)
// But ProductService now calls:
this.repository.create(...)  // NOT prisma.product.create
```

### Problem 3: Missing Repository Mocks

No `repositories.mock.ts` exists. Need to create mock utilities for all repository classes.

---

## Proposed Changes

### Component 1: Mock Infrastructure

#### [NEW] [repositories.mock.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/mocks/repositories.mock.ts)

Create centralized repository mocks for all 10+ repository classes:

- `mockProductRepository`
- `mockPartnerRepository`
- `mockAccountRepository`
- `mockInvoiceRepository`
- `mockJournalRepository`
- `mockPaymentRepository`
- `mockInventoryRepository`
- `mockSalesRepository`
- `mockProcurementRepository`
- `mockCompanyRepository`
- `mockUserRepository`
- `mockAuthRepository`

Each mock will have vi.fn() for all repository methods (create, findById, findAll, update, delete, etc.)

---

### Component 2: Service Unit Tests

Update each of the 15 service test files:

#### [MODIFY] [ProductService.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/ProductService.test.ts)

1. Fix import path: `../../../src/modules/product/product.service`
2. Mock `ProductRepository` instead of Prisma
3. Inject mock repository into service

#### [MODIFY] [PartnerService.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/PartnerService.test.ts)

Same pattern as ProductService

#### [MODIFY] [AccountService.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/AccountService.test.ts)

Same pattern

#### [MODIFY] [InvoiceService.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/InvoiceService.test.ts)

Same pattern

#### [MODIFY] [BillService.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/BillService.test.ts)

Same pattern

#### [MODIFY] [JournalService.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/JournalService.test.ts)

Same pattern

#### [MODIFY] [PaymentService.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/PaymentService.test.ts)

Same pattern

#### [MODIFY] [InventoryService.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/InventoryService.test.ts)

Same pattern

#### [MODIFY] [SalesOrderService.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/SalesOrderService.test.ts)

Same pattern

#### [MODIFY] [PurchaseOrderService.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/PurchaseOrderService.test.ts)

Same pattern

#### [MODIFY] [UserService.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/UserService.test.ts)

Same pattern

#### [MODIFY] [ReportService.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/ReportService.test.ts)

Same pattern

#### [MODIFY] [FulfillmentService.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/FulfillmentService.test.ts)

Same pattern

#### [MODIFY] [sessionService.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/sessionService.test.ts)

Same pattern

#### [MODIFY] [authUtil.test.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/services/authUtil.test.ts)

Same pattern - update import path to `../../../src/modules/auth/auth.utils`

---

### Component 3: Route Tests

Route tests already mock service layer via `services.mock.ts`. Need to ensure mocks are properly wired.

#### [MODIFY] [services.mock.ts](file:///c:/Offline/Coding/sync-erp/apps/api/test/unit/mocks/services.mock.ts)

Ensure all service methods are mocked, particularly ones causing "Server Error":

- `mockCompanyService.listForUser` - needs proper mock return
- `mockInvoiceService.createFromSalesOrder` - needs mock
- `mockBillService.createFromPurchaseOrder` - needs mock
- `mockInventoryService.processGoodsReceipt` - needs mock

---

## Verification Plan

### Automated Tests

Run all API tests with this command:

```bash
npm run test --workspace=@sync-erp/api
```

**Success Criteria:**

1. No `(0 test)` in output - all 15 service files should run their tests
2. Exit code 0 - all tests pass
3. No "Server Error" logs in stderr

### Test Output Validation

After running tests, verify:

- Total test count >= previous count (no regression)
- All middleware tests still pass (auth, rbac, errorHandler)
- All route tests pass without service errors

---

## Implementation Order

1. **Phase 1**: Create `repositories.mock.ts` with all repository mocks
2. **Phase 2**: Fix 1 service test as prototype (ProductService.test.ts)
3. **Phase 3**: Apply pattern to remaining 14 service tests
4. **Phase 4**: Fix route test service mocks
5. **Phase 5**: Run full test suite and verify
