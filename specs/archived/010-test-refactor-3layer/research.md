# Research: Test Refactor for 3-Layer Architecture

**Feature**: 010-test-refactor-3layer  
**Date**: 2025-12-12

## Research Summary

This feature involves fixing existing tests after a codebase refactor. No new technologies are introduced - only refactoring test code to match the new 3-layer architecture.

---

## Decision 1: Mock Strategy for Service Tests

**Decision**: Mock repository layer instead of Prisma client

**Rationale**:

- Services now depend on Repository classes, not Prisma directly
- Mocking at repository level tests service business logic in isolation
- Repository mocks are simpler (fewer methods) than Prisma mocks
- Aligns with Constitution Principle IV (Repository Pattern)

**Alternatives Considered**:

1. **Mock Prisma via module** - Rejected because it tests implementation details, not service logic
2. **Dependency injection refactor** - Rejected because too invasive for test-only changes
3. **Integration tests only** - Rejected because unit tests provide faster feedback

---

## Decision 2: Mock Import Pattern

**Decision**: Use vi.mock() with dynamic import path resolution

**Rationale**:

- Vitest's vi.mock() hoists to top, allowing clean mocking
- Pattern already established in codebase for services.mock.ts
- Consistent with existing test infrastructure

**Implementation Pattern**:

```typescript
vi.mock('../../../src/modules/product/product.repository', () => ({
  ProductRepository: vi
    .fn()
    .mockImplementation(() => mockProductRepository),
}));
```

---

## Decision 3: Test File Organization

**Decision**: Keep existing file structure, update imports and mocks

**Rationale**:

- Minimal disruption to existing test organization
- Files already logically named (ServiceName.test.ts)
- No need for new directories

**Files to Update**:

- 15 service test files in `test/unit/services/`
- 1 new mock file `test/unit/mocks/repositories.mock.ts`
- Updates to `test/unit/mocks/services.mock.ts`

---

## Module-to-Path Mapping

| Old Import Path                              | New Import Path                                            |
| -------------------------------------------- | ---------------------------------------------------------- |
| `../../../src/services/ProductService`       | `../../../src/modules/product/product.service`             |
| `../../../src/services/PartnerService`       | `../../../src/modules/partner/partner.service`             |
| `../../../src/services/UserService`          | `../../../src/modules/user/user.service`                   |
| `../../../src/services/authService`          | `../../../src/modules/auth/auth.service`                   |
| `../../../src/services/authUtil`             | `../../../src/modules/auth/auth.utils`                     |
| `../../../src/services/sessionService`       | `../../../src/modules/auth/auth.service`                   |
| `../../../src/services/AccountService`       | `../../../src/modules/accounting/services/account.service` |
| `../../../src/services/InvoiceService`       | `../../../src/modules/accounting/services/invoice.service` |
| `../../../src/services/BillService`          | `../../../src/modules/accounting/services/bill.service`    |
| `../../../src/services/JournalService`       | `../../../src/modules/accounting/services/journal.service` |
| `../../../src/services/PaymentService`       | `../../../src/modules/accounting/services/payment.service` |
| `../../../src/services/ReportService`        | `../../../src/modules/accounting/services/report.service`  |
| `../../../src/services/InventoryService`     | `../../../src/modules/inventory/inventory.service`         |
| `../../../src/services/SalesOrderService`    | `../../../src/modules/sales/sales.service`                 |
| `../../../src/services/PurchaseOrderService` | `../../../src/modules/procurement/procurement.service`     |
| `../../../src/services/FulfillmentService`   | (merged into inventory or sales)                           |
