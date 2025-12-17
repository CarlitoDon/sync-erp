# Tasks: Domain Contract Stabilization

**Feature**: Domain Contract Stabilization
**Branch**: `028-domain-contract-stabilization`
**Status**: PLANNING

## Phase 1: Setup

_Goal: Prepare environment and verify test infrastructure_

- [ ] T001 Check 'TypeScript: Watch' terminal for existing errors (Constitution VIII)
- [ ] T002 Verify test runner works for accounting module `apps/api/src/modules/accounting`
- [ ] T003 Verify test runner works for sales module `apps/api/src/modules/sales`
- [ ] T004 Verify test runner works for procurement module `apps/api/src/modules/procurement`

## Phase 2: Foundational (G5 & G7 Compliance)

_Goal: Establish hard guardrails (Business Date & Invariants) before logic implementation_

**Independent Test Criteria**:

- API accepts `businessDate` in payload (and rejects invalid ones)
- Invariants are queryable via SQL

- [ ] T005 [P] [US0] Add `businessDate` to `InvoicePostSchema` in `packages/shared/src/validators/invoice.ts`
- [ ] T006 [P] [US0] Add `businessDate` to `CreatePaymentSchema` in `packages/shared/src/validators/payment.ts`
- [ ] T007 [P] [US0] Add `businessDate` to `BillPostSchema` in `packages/shared/src/validators/bill.ts`
- [ ] T008 [US0] Update `InvoiceController` to inject default `businessDate` if missing in `apps/api/src/modules/accounting/invoice/invoice.controller.ts`
- [ ] T009 [US0] Update `PaymentController` to inject default `businessDate` in `apps/api/src/modules/accounting/payment/payment.controller.ts`
- [ ] T010 [US0] Update `JournalService` to require `businessDate` in payload in `apps/api/src/modules/accounting/journal/journal.service.ts`
- [ ] T011 [US0] Implement `validateBusinessDate` rule (block future dates) in `apps/api/src/modules/accounting/rules/date.rules.ts` (FR-023)
- [ ] T012 [US0] Create SQL invariant query docs in `apps/api/src/modules/accounting/QUERIES.md`
- [ ] T013 Check 'TypeScript: Watch' terminal for foundational errors

## Phase 3: User Story 1 - State Machine Enforcement (P1)

_Goal: Strict enforcement of DRAFT -> POSTED -> PAID -> VOID transitions_

**Independent Test Criteria**:

- Invalid transitions throw `INVALID_STATE`
- Valid transitions log activity

- [ ] T014 [P] [US1] Create unit tests for Invoice state transitions in `apps/api/src/modules/accounting/invoice/invoice.service.spec.ts`
- [ ] T015 [P] [US1] Create unit tests for Order state transitions in `apps/api/src/modules/sales/order/order.service.spec.ts`
- [ ] T016 [US1] Implement state machine guards in `InvoiceService.post()` in `apps/api/src/modules/accounting/invoice/invoice.service.ts`
- [ ] T017 [US1] Implement state machine guards in `BillService.post()` in `apps/api/src/modules/accounting/bill/bill.service.ts`
- [ ] T018 [US1] Implement state machine guards in `OrderService.confirm()` in `apps/api/src/modules/sales/order/order.service.ts`
- [ ] T019 [US1] Implement state machine guards in `OrderService.complete()` in `apps/api/src/modules/sales/order/order.service.ts`

## Phase 4: User Story 2 - Write Rule Protection (P1)

_Goal: Immutable POSTED/VOID documents_

**Independent Test Criteria**:

- Update on POSTED entity throws `MUTATION_BLOCKED`
- Allowed operations (Payment) still work

- [ ] T020 [P] [US2] Create unit tests for mutation blocking in `apps/api/src/modules/accounting/invoice/invoice.service.spec.ts`
- [ ] T021 [US2] Add mutability check to `InvoiceService.update()` in `apps/api/src/modules/accounting/invoice/invoice.service.ts`
- [ ] T022 [US2] Add mutability check to `BillService.update()` in `apps/api/src/modules/accounting/bill/bill.service.ts`
- [ ] T023 [US2] Add mutability check to `OrderService.update()` in `apps/api/src/modules/sales/order/order.service.ts`
- [ ] T024 Check 'TypeScript: Watch' terminal for core logic errors

## Phase 5: User Story 3 - Policy Layer Validation (P2)

_Goal: Shape-aware constraints (Retail vs Service)_

**Independent Test Criteria**:

- Service company blocking stock ops
- Retail company allowing stock ops

- [ ] T025 [P] [US3] Create unit tests for `InventoryPolicy` in `apps/api/src/modules/inventory/inventory.policy.spec.ts`
- [ ] T026 [US3] Implement `checkStockOperation(company, product)` in `apps/api/src/modules/inventory/inventory.policy.ts`
- [ ] T027 [US3] Integrate Policy check into `InventoryService` in `apps/api/src/modules/inventory/inventory.service.ts`
- [ ] T028 [US3] Implement `ProcurementPolicy.checkPORequired(company)` in `apps/api/src/modules/procurement/procurement.policy.ts`

## Phase 6: User Story 4 - Consistent Error Responses (P2)

_Goal: Standardize all error returns_

- [ ] T029 [US4] Refactor `InvoiceService` to use `AppError` from catalog in `apps/api/src/modules/accounting/invoice/invoice.service.ts`
- [ ] T030 [US4] Refactor `BillService` to use `AppError` from catalog in `apps/api/src/modules/accounting/bill/bill.service.ts`
- [ ] T031 [US4] Refactor `OrderService` to use `AppError` from catalog in `apps/api/src/modules/sales/order/order.service.ts`
- [ ] T032 [US4] Refactor `ProcurementService` to use `AppError` from catalog in `apps/api/src/modules/procurement/procurement.service.ts`
- [ ] T033 [US4] Verify all error codes match `ERROR_CATALOG.md`
- [ ] T034 Check 'TypeScript: Watch' terminal for refactoring errors

## Phase 7: Recovery & Failure Handling (P2)

_Goal: Explicit recovery paths and traceability_

**Independent Test Criteria**:

- Recovery endpoint exists
- Journal entries have source links

- [ ] T035 [US1] Implement `manualRecover` endpoint for Sagas in `apps/api/src/modules/system/saga.controller.ts` (FR-034)
- [ ] T036 [US0] Verify JournalEntry `sourceType/sourceId` are populated in `InvoiceService.post()` (FR-030, FR-032)
- [ ] T037 [US0] Verify JournalEntry `sourceType/sourceId` are populated in `PaymentService.create()` (FR-030, FR-032)

## Phase 8: Polish

- [ ] T038 Run full integration test suite
- [ ] T039 Verify `tasks.md` is all checked
- [ ] T040 Check 'TypeScript: Watch' terminal for new errors (Constitution VIII)
- [ ] T041 Create PR

## Dependencies

- Phase 2 (Foundation) MUST complete before Phase 3
- Phase 3 (State) and Phase 4 (Write Rule) can be parallel
- Phase 5 (Policy) depends on Service structure
