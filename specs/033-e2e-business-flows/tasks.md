# Tasks: Correct E2E Business Flows (O2C & P2P)

**Input**: Design documents from `specs/033-e2e-business-flows/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/

**Tests**: Integration tests are MANDATORY for all business flows.

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Extend `SagaLog` and add `AuditLog` models in `packages/database/prisma/schema.prisma`
- [x] T001.1 Update Zod schemas in `packages/shared/src/validators/index.ts` to include `businessDate` and `correlationId` support
- [x] T002 Execute Prisma migration: `npx prisma migrate dev --name add_audit_log_and_extend_saga`
- [x] T003 [P] Rebuild database package: `npm run build` in `packages/database`

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T004 Implement `AuditLogRepository` in `apps/api/src/modules/common/audit/audit-log.repository.ts`
- [x] T004.1 Update `SagaLogRepository` in `apps/api/src/modules/common/saga/saga-log.repository.ts` to support `correlationId`
- [x] T005 Update `PostingContext` and `SagaOrchestrator` to manage/propagate `correlationId`
- [x] T006 [P] Implement `AuditLogService` in `apps/api/src/modules/common/audit/audit-log.service.ts` for recording business intent
- [x] T007 Implement correlation ID middleware in `apps/api/src/middlewares/correlation.ts`

**Checkpoint**: Foundation ready - Saga infrastructure now supports full auditability and correlation.

---

## Phase 3: User Story 1 - Standard O2C Flow (Priority: P1) 🎯 MVP

**Goal**: Full flow from SalesOrder confirmation to Payment Receipt with balanced journals and audit logs.

**Independent Test**: Run `npm run test:integration --workspace=@sync-erp/api -t "Standard O2C Flow"`

### Tests for User Story 1

- [x] T008 [P] [US1] Create integration test `apps/api/test/integration/o2c-full-cycle.test.ts` (expecting failure)

### Implementation for User Story 1

- [x] T009 [US1] Refactor `InvoicePostingSaga` to include compensation (FR-007) and correlationId propagation
- [x] T010 [US1] Refactor `PaymentPostingSaga` in `apps/api/src/modules/accounting/sagas/payment-posting.saga.ts` to include compensation and audit fields
- [x] T011 [US1] Update `InvoiceService` to record `AuditLog: INVOICE_POSTED` BEFORE triggering Saga
- [x] T012 [US1] Enforce Idempotency in `/api/accounting/invoices/:id/post` using `correlationId` (scoped to AuditLog presence)

**Checkpoint**: User Story 1 (O2C) fully functional and verified via integration test.

---

## Phase 4: User Story 2 - Standard P2P Flow (Priority: P1)

**Goal**: Full flow from PurchaseOrder confirmation to Payment to Supplier with balanced journals and audit logs.

**Independent Test**: Run `npm run test:integration --workspace=@sync-erp/api -t "Standard P2P Flow"`

### Tests for User Story 2

- [x] T013 [P] [US2] Create integration test `apps/api/test/integration/p2p-full-cycle.test.ts` (expecting failure)

### Implementation for User Story 2

- [x] T014 [US2] Refactor `BillPostingSaga` to include compensation (FR-007) and correlationId propagation
- [x] T015 [US2] Refactor `PaymentPostingSaga` (Disbursement) to support Supplier payments with correct ledger logic
- [x] T016 [US2] Update `BillService` to record `AuditLog: BILL_POSTED` BEFORE triggering Saga
- [x] T017 [US2] Enforce Idempotency in `/api/accounting/bills/:id/post` using `correlationId`

**Checkpoint**: User Story 2 (P2P) fully functional and verified via integration test.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T018 [P] Update `QUERIES.md` in `apps/api/src/modules/accounting/` with SQL for auditing Saga execution records
- [x] T019 Final verification of cross-module invariants: StockQty >= 0, Invoice.balance >= 0, Journal.debit == Journal.credit (FR-011, FR-012)
- [x] T020 Run full build verification: `npx tsc --noEmit` and `npm run build`

---

## Phase 6: User Story 3 - Full Rental Cycle (Priority: P2)

**Goal**: Verify the end-to-end lifecycle of rental assets (Buy -> Rent -> Return -> Sell).

**Independent Test**: Run `npm run test:integration --workspace=@sync-erp/api -t "Rental Asset Lifecycle"`

### Tests for User Story 3

- [x] T021 [US3] Create integration test `apps/api/test/integration/rental-full-cycle.test.ts`
- [x] T022 [US3] Ensure `RentalService` and `InventoryService` can handle the manual asset conversion workflow (Integration verification)

---

## Dependencies & Execution Order

1.  **Phase 1 & 2**: Mandatory sequence (Schema -> Repo -> Orchestrator).
2.  **Phase 3 (O2C)**: Can start after Phase 2. MVP priority.
3.  **Phase 4 (P2P)**: Can start after Phase 2. Independent of O2C.
4.  **Phase 5**: Final step after both flows are functional.

## Parallel Execution Examples

```bash
# Developer A: Setup & Foundational
Task: T001 -> T002 -> T003

# Once T007 is done:
# Developer B: User Story 1 (O2C)
Task: T008 -> T012

# Developer C: User Story 2 (P2P)
Task: T013 -> T017
```
