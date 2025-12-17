# Tasks: Phase 1 Flow Completeness (Feature 029)

Feature: **Validate Golden Paths & Disable Non-Golden**

Status: **Phase 2 (Foundation)**

## Phase 1: Setup

- [x] T001 Define `FEATURE_DISABLED` error code in `packages/shared/src/errors/domain-error.ts`
- [x] T002 Rebuild shared package for API consumption `packages/shared`

## Phase 2: Foundation (Feature Guards)

- [x] T003 [P] Implement `BusinessDate.ensureNotBackdated()` in `packages/shared/src/utils/business-date.ts` (or similar utility)
- [x] T004 [P] Implement `Currency.ensureBase()` guard in `packages/shared` or specific service

## Phase 3: User Story 1 - Receive Goods (GRN)

**Goal**: Verify strict Golden Path for GRN and block Partial Receipts.
**Test**: `unit/modules/procurement/t024_goods_receipt_saga.test.ts`

- [x] T005 [US1] Create/Update `t024_goods_receipt_saga.test.ts` to include Partial Receipt Failure case `apps/api/test/unit/modules/procurement/t024_goods_receipt_saga.test.ts`
- [x] T006 [US1] Implement Partial Receipt Guard in `apps/api/src/modules/procurement/sagas/goods-receipt.saga.ts`
- [x] T007 [US1] Verify Happy Path (Full Receipt) still works `apps/api/src/modules/procurement/sagas/goods-receipt.saga.ts`

## Phase 4: User Story 2 - Post Vendor Bill

**Goal**: Verify strict Golden Path for Bills and block Multi-Currency.
**Test**: `unit/modules/accounting/t025_bill_posting_saga.test.ts`

- [x] T008 [US2] Create/Update `t025_bill_posting_saga.test.ts` to include Non-Base Currency Failure case `apps/api/test/unit/modules/accounting/t025_bill_posting_saga.test.ts`
- [x] T009 [US2] Implement Multi-Currency Guard in `apps/api/src/modules/accounting/sagas/bill-posting.saga.ts`
- [x] T010 [US2] Verify Happy Path (Base Currency) still works `apps/api/src/modules/accounting/sagas/bill-posting.saga.ts`

## Phase 5: User Story 3 - Create Payment

**Goal**: Verify strict Golden Path for Payments and block Backdated/Multi-Currency.
**Test**: `unit/modules/accounting/t026_payment_posting_saga.test.ts`

- [x] T011 [US3] Create/Update `t026_payment_posting_saga.test.ts` to include Backdated & Multi-Currency Failure cases `apps/api/test/unit/modules/accounting/t026_payment_posting_saga.test.ts`
- [x] T012 [US3] Implement Guards in `apps/api/src/modules/accounting/sagas/payment-posting.saga.ts`
- [x] T013 [US3] Verify Happy Path works `apps/api/src/modules/accounting/sagas/payment-posting.saga.ts`

## Phase 6: User Story 4 - Create Credit Note

**Goal**: Verify strict Golden Path for Credit Notes.
**Test**: `unit/modules/accounting/t027_credit_note_saga.test.ts`

- [x] T014 [US4] Verify Credit Note Saga Implementation maps to requirements `apps/api/src/modules/accounting/sagas/credit-note.saga.ts`
- [x] T015 [US4] Ensure `t027_credit_note_saga.test.ts` covers full reversal `apps/api/test/unit/modules/accounting/t027_credit_note_saga.test.ts`

## Phase 7: Polish & Documentation

- [x] T016 Create `docs/FLOW.md` documenting the 4 Golden Paths (Inputs -> Internal Steps -> Outputs) `docs/FLOW.md`
- [x] T017 Verify all tests pass with `npm test`

## Dependencies

- Phase 2 (Foundation) blocks all Story Phases.
- Stories 1-4 are independent and can be executed in parallel.
