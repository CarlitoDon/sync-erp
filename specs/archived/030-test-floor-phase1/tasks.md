# Tasks: Feature 030 - Phase 1 Test Floor

Feature: **Phase 1 Test Floor**
Status: **Phase 6 (Polish)**

## Phase 1: Setup

- [x] T001 Create `vitest.config.ts` for invariants <!-- id: 31 -->
  - [x] T002 Update `package.json` with `test:invariants` <!-- id: 32 -->

## Phase 2: Foundation (Prerequisites)

- [x] T003 Create `apps/api/test/invariants/setup.ts` for test environment preparation `apps/api/test/invariants/setup.ts`

## Phase 3: User Story 1 - Invariants (Priority: P1)

**Goal**: Enforce system integrity constraints (Non-negative stock/balance, balanced journals).
**Test**: `npm run test:invariants`

- [x] [US1] Implement Invariant Tests <!-- id: 34 -->
  - [x] T004 Inventory Invariants (Stock >= 0) <!-- id: 35 -->
  - [x] T005 Finance Invariants (Balance >= 0) <!-- id: 36 -->
  - [x] T006 Accounting Invariants (Journal Balanced) <!-- id: 37 -->
- [x] [US2] Verify Saga Compliance <!-- id: 38 -->
  - [x] T007 GRN Saga Tests <!-- id: 39 -->
  - [x] T008 Bill Posting Saga Tests <!-- id: 40 -->
  - [x] T009 Payment Posting Saga Tests <!-- id: 41 -->
  - [x] T010 Credit Note Saga Tests <!-- id: 42 -->

## Phase 4: User Story 2 - Saga Resilience (Priority: P2)

**Goal**: Standardize tests for all Sagas (Success, Fail/Compensate, Idempotency).
**Test**: `npm test` (Unit/Integration)

- [x] T007 [US2] Verify/Update GRN Saga Tests for Compliance `apps/api/test/unit/modules/procurement/t024_goods_receipt_saga.test.ts`
- [x] T008 [US2] Verify/Update Bill Posting Saga Tests for Compliance `apps/api/test/unit/modules/accounting/t025_bill_posting_saga.test.ts`
- [x] T009 [US2] Verify/Update Payment Posting Saga Tests for Compliance `apps/api/test/unit/modules/accounting/t026_payment_posting_saga.test.ts`
- [x] T010 [US2] Verify/Update Credit Note Saga Tests for Compliance `apps/api/test/unit/modules/accounting/t027_credit_note_saga.test.ts`

## Phase 5: User Story 3 - Policy Logic (Priority: P3)

**Goal**: Ensure 100% unit coverage for pure Policy logic.
**Test**: `npm test`

- [x] T011 [US3] Create/Verify Unit Tests for Invoice Policy `apps/api/test/unit/modules/accounting/invoice.policy.test.ts`
- [x] T012 [US3] Create/Verify Unit Tests for Procurement Policy `apps/api/test/unit/modules/procurement/procurement.policy.test.ts`
- [x] T013 [US3] Create/Verify Unit Tests for Inventory Policy `apps/api/test/unit/modules/inventory/inventory.policy.test.ts`

## Phase 6: Polish

- [x] T014 Run full regression suite `npm run test:all`
