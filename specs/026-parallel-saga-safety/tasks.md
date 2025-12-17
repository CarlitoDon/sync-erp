/# Tasks: Parallel Saga Safety (D2)

**Feature**: Parallel Saga Safety (Audit D2)
**Branch**: `026-parallel-saga-safety`
**Status**: Planning

## Phase 1: Setup

> **Goal**: Ensure clean slate for concurrency implementation.

- [x] T000 Check existing tests pass `npm test`

## Phase 2: Foundational (Saga Core)

> **Goal**: Enable Transactional Locking in the Saga Orchestrator base class.
> **Independent Test**: `SagaOrchestrator` runs arbitrary steps within a transaction.

- [x] T001 [US1] Update `SagaOrchestrator.execute` to use `prisma.$transaction` in file `apps/api/src/modules/common/saga/saga-orchestrator.ts`
- [x] T002 [US1] Implement `lockEntity` method in `SagaOrchestrator` using raw SQL `FOR UPDATE` in file `apps/api/src/modules/common/saga/saga-orchestrator.ts`
- [x] T003 [US1] Update `SagaOrchestrator.executeSteps` signature to accept optional `tx` in file `apps/api/src/modules/common/saga/saga-orchestrator.ts`

## Phase 3: User Story 1 (Prevent Double Execution)

> **Goal**: Serialize Invoice, Bill, and Payment posting to prevent double-execution.
> **Independent Test**: Integration test shows 2nd request waiting for 1st to complete.

### Repositories & Services (Transaction Injection)

- [x] T004 [US1] Update `InvoiceRepository` to accept `tx` in all write methods in file `apps/api/src/modules/accounting/repositories/invoice.repository.ts`
- [x] T005 [P] [US1] Update `JournalService` to accept `tx` in `postJournal` and `create` in file `apps/api/src/modules/accounting/services/journal.service.ts`
- [x] T006 [P] [US1] Update `InventoryService` to accept `tx` in `processShipment` in file `apps/api/src/modules/inventory/inventory.service.ts`

### Saga Implementations

- [x] T007 [P] [US1] Update `InvoicePostingSaga` in `apps/api/src/modules/accounting/sagas/invoice-posting.saga.ts`
- [x] T008 [P] [US1] Update `BillPostingSaga` in `apps/api/src/modules/accounting/sagas/bill-posting.saga.ts`
- [x] T009 [P] [US1] Update `PaymentPostingSaga` in `apps/api/src/modules/accounting/sagas/payment-posting.saga.ts`
- [x] T010 [P] [US1] Update `CreditNoteSaga` in `apps/api/src/modules/accounting/sagas/credit-note.saga.ts`

## Phase 4: Polish & Verification

> **Goal**: Verify## Phase 4: Polish & Verification

- [x] T011 [US1] Build and TypeScript validation
- [x] T012 [P] [US1] Run existing Saga unit tests - All 42 tests pass
- [x] T013 [US1] Update test mocks with self-referencing prismaMock pattern

## Dependencies

- All Phase 3 tasks depend on Phase 2 (Saga Core Update).
- Saga Implementations (T007-T010) depend on Service Updates (T004-T006).

## Implementation Strategy

1. **Core First**: Update `SagaOrchestrator` to support `tx`.
2. **Bottom-Up**: Update Repositories/Services to accept `tx`.
3. **Top-Down**: Update Sagas to bridge `Core` and `Repos` by passing `tx`.
4. **Verify**: Run concurrency stress test.
