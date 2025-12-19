# Tasks: Procure-to-Pay (P2P) Flow

**Feature Branch**: `035-procure-to-pay-p2p`
**Status**: Planned

## Phase 1: Setup & Data Modeling (Phse 1)

**Goal**: Initialize database schema, shared types, and project structure.

- [x] T001 Define `PurchaseOrder` and `PurchaseOrderLine` in `packages/database/prisma/schema.prisma` (Add `@version` for optimistic locking)
- [x] T002 Define `GoodsReceipt` and `GoodsReceiptLine` in `packages/database/prisma/schema.prisma` (Add `@version`)
- [x] T003 Define `Bill` and `BillLine` in `packages/database/prisma/schema.prisma` (Add `@version`)
- [x] T004 Define `Payment` in `packages/database/prisma/schema.prisma` (Add `@version`)
- [x] T005 Define `DocumentSequence` model in `packages/database/prisma/schema.prisma`
- [x] T006 Define `AuditLog` model in `packages/database/prisma/schema.prisma`
- [x] T007 Run `npm run db:migrate` to apply P2P schema changes
- [x] T008 Define shared types in `packages/shared/src/types/p2p.ts`
- [x] T009 [P] Define Zod schemas in `packages/shared/src/validators/p2p.ts` (PO, GRN, Bill, Payment inputs)
- [x] T010 Create shared utilities: `apps/api/src/modules/common/sequence.service.ts` and `audit.service.ts`
- [ ] T011 [P] Audit Codebase: Ensure all new numeric models use `Decimal` type in Prisma and `Decimal.js` in business logic (Constitution XVI)
- [x] T012 Create module directories: `apps/api/src/modules/procurement` and `apps/api/src/modules/accounting`
- [x] T013 Create feature directories: `apps/web/src/features/procurement` and `apps/web/src/features/accounting`

## Phase 2: User Story 1 - Create & Confirm PO (Priority: P1)

**Goal**: Enable creation of Purchase Orders and confirmation to lock them.

**Independent Test**: User can create PO -> Status DRAFT -> Confirm PO -> Status CONFIRMED.

### Implementation [US1]

- [x] T014 [US1] Create Repository in `apps/api/src/modules/procurement/purchase-order.repository.ts` (Implement version-check logic. Audit for existing methods - XXI)
- [x] T015 [US1] Create Policy in `apps/api/src/modules/procurement/purchase-order.policy.ts` (Check status transitions)
- [x] T016 [US1] Implement Service in `apps/api/src/modules/procurement/purchase-order.service.ts` (**Refine** `create` and `confirm` methods. Audit for duplicates - XXI)
- [x] T017 [US1] Implement Controller in `apps/api/src/modules/procurement/purchase-order.controller.ts`
- [x] T018 [US1] Register routes in `apps/api/src/routes/purchaseOrder.ts`
- [ ] T019 [US1] Create `usePurchaseOrder` hook in `apps/web/src/features/procurement/hooks/usePurchaseOrder.ts`
- [ ] T020 [US1] Refine PO List UI in `apps/web/src/features/procurement/components/PurchaseOrderList.tsx` (Integrate new Service, preserve existing Actions)
- [ ] T021 [US1] Implement PO Create Form in `apps/web/src/features/procurement/components/PurchaseOrderForm.tsx`
- [ ] T022 [US1] Refine PO Detail View in `apps/web/src/features/procurement/components/PurchaseOrderDetail.tsx` (Ensure "Confirm" & "Create GRN" actions use new Policy)
- [ ] T023 [US1] Integration Test: `tests/integration/p2p/us1_po_flow.test.ts`

## Phase 3: User Story 2 - Receive Goods (GRN) (Priority: P1)

**Goal**: Receive goods against confirmed PO and update inventory.

**Independent Test**: Confirmed PO -> Create GRN -> Post GRN -> Stock Increases -> PO Status Updated.

### Implementation [US2]

- [ ] T024 [US2] Create Repository in `apps/api/src/modules/procurement/goods-receipt.repository.ts` (Audit for existing methods - XXI)
- [ ] T025 [US2] Create Policy in `apps/api/src/modules/procurement/goods-receipt.policy.ts` (Check PO status, remaining qty)
- [ ] T026 [US2] Implement Service in `apps/api/src/modules/procurement/goods-receipt.service.ts` (**Refine** existing `receive` method to include locking. Reuse `GoodsReceiptSaga`. Audit - XXI)
- [ ] T027 [US2] Implement Controller in `apps/api/src/modules/procurement/goods-receipt.controller.ts`
- [ ] T028 [US2] Add GRN routes to `apps/api/src/routes/v1/procurement.routes.ts`
- [ ] T029 [US2] Create `useGoodsReceipt` hook in `apps/web/src/features/procurement/hooks/useGoodsReceipt.ts`
- [ ] T030 [US2] Implement GRN Create Form (load PO items) in `apps/web/src/features/procurement/components/GoodsReceiptForm.tsx`
- [ ] T031 [US2] Refine GRN Detail View in `apps/web/src/features/procurement/components/GoodsReceiptDetail.tsx` (Integrate "Post" & "Create Bill" shortcuts)
- [ ] T032 [US2] Integration Test: `tests/integration/p2p/us2_grn_flow.test.ts`

## Phase 4: User Story 3 - Create & Post Bill (Priority: P1)

**Goal**: Create supplier invoice from GRN and post to Accounts Payable.

**Independent Test**: Posted GRN -> Create Bill -> Post Bill -> AP Journal Created -> Bill Status POSTED.

### Implementation [US3]

- [ ] T033 [US3] Create Repository in `apps/api/src/modules/accounting/bill.repository.ts` (Audit for existing methods - XXI)
- [ ] T034 [US3] Create Policy in `apps/api/src/modules/accounting/bill.policy.ts` (3-Way Match Validation)
- [ ] T035 [US3] Implement Service in `apps/api/src/modules/accounting/bill.service.ts` (**Refine** `createFromPurchaseOrder` and `post`. Reuse `BillPostingSaga`. Audit - XXI)
- [ ] T036 [US3] Implement Controller in `apps/api/src/modules/accounting/bill.controller.ts`
- [ ] T037 [US3] Register routes in `apps/api/src/routes/v1/accounting.routes.ts`
- [ ] T038 [US3] Create `useBill` hook in `apps/web/src/features/accounting/hooks/useBill.ts`
- [ ] T039 [US3] Implement Bill Create Form (load GRN items) in `apps/web/src/features/accounting/components/BillForm.tsx`
- [ ] T040 [US3] Refine Bill Detail View in `apps/web/src/features/accounting/components/BillDetail.tsx` (Integrate "Post" & "Record Payment". Add Price Discrepancy UI - FR-049)
- [ ] T041 [US3] Integration Test: `tests/integration/p2p/us3_bill_flow.test.ts`

## Phase 5: User Story 4 - Record Payment (Priority: P2)

**Goal**: Pay posted bills and update bank/cash balances.

**Independent Test**: Posted Bill -> Record Payment -> Payment Created -> Bill Status PAID -> Journals Created.

### Implementation [US4]

- [ ] T042 [US4] Update Repository in `apps/api/src/modules/accounting/payment.repository.ts` (**Audit** existing methods first - XXI)
- [ ] T043 [US4] Create Policy in `apps/api/src/modules/accounting/payment.policy.ts` (Check Bill status, amount)
- [ ] T044 [US4] Implement Service in `apps/api/src/modules/accounting/payment.service.ts` (**Refine** `create` and `post`. Reuse `PaymentPostingSaga`. Audit - XXI)
- [ ] T045 [US4] Implement Controller in `apps/api/src/modules/accounting/payment.controller.ts`
- [ ] T046 [US4] Add Payment routes to `apps/api/src/routes/v1/accounting.routes.ts`
- [ ] T047 [US4] Create `usePayment` hook in `apps/web/src/features/accounting/hooks/usePayment.ts`
- [ ] T048 [US4] Implement Payment Dialog/Form in `apps/web/src/features/accounting/components/PaymentForm.tsx`
- [ ] T049 [US4] Integration Test: `tests/integration/p2p/us4_payment_flow.test.ts`

## Phase 6: User Story 5 - Cancel PO (Priority: P3)

**Goal**: Cancel CONFIRMED POs before goods are received.

### Implementation [US5]

- [ ] T050 [US5] Update Policy in `apps/api/src/modules/procurement/purchase-order.policy.ts` (Allow Cancel if no GRN)
- [ ] T051 [US5] Implement Cancel method in `apps/api/src/modules/procurement/purchase-order.service.ts` (Log Cancel action in AuditLog)
- [ ] T052 [US5] Add Cancel endpoint to `apps/api/src/modules/procurement/purchase-order.controller.ts`
- [ ] T053 [US5] Add Cancel button to `apps/web/src/features/procurement/components/PurchaseOrderDetail.tsx`

## Phase 7: User Story 6 - Void GRN (Priority: P3)

**Goal**: Void POSTED GRNs and rollback stock (provided no Bill exists).

### Implementation [US6]

- [ ] T054 [US6] Update Policy in `apps/api/src/modules/procurement/goods-receipt.policy.ts` (Allow Void if no Bill)
- [ ] T055 [US6] Implement Void method in `apps/api/src/modules/procurement/goods-receipt.service.ts` (Rollback Stock, Update PO, Log AuditLog)
- [ ] T056 [US6] Add Void endpoint to `apps/api/src/modules/procurement/goods-receipt.controller.ts`
- [ ] T057 [US6] Add Void button to `apps/web/src/features/procurement/components/GoodsReceiptDetail.tsx`

## Phase 8: User Story 7 - Void Bill (Priority: P3)

**Goal**: Void POSTED Bill and reverse AP (provided no Payment exists).

### Implementation [US7]

- [ ] T058 [US7] Update Policy in `apps/api/src/modules/accounting/bill.policy.ts` (Allow Void if no Payment)
- [ ] T059 [US7] Implement Void method in `apps/api/src/modules/accounting/bill.service.ts` (Reverse AP Journal, Log AuditLog)
- [ ] T060 [US7] Add Void endpoint to `apps/api/src/modules/accounting/bill.controller.ts`
- [ ] T061 [US7] Add Void button to `apps/web/src/features/accounting/components/BillDetail.tsx`

## Phase 9: User Story 8 - Void Payment (Priority: P3)

**Goal**: Void Payment and restore Bill balance.

### Implementation [US8]

- [ ] T062 [US8] Implement Void method in `apps/api/src/modules/accounting/payment.service.ts` (Reverse Journal, Update Bill, Log AuditLog)
- [ ] T063 [US8] Add Void endpoint to `apps/api/src/modules/accounting/payment.controller.ts`
- [ ] T064 [US8] Add Void action to Payment List/Detail in `apps/web/src/features/accounting/components/BillDetail.tsx`

## Phase 10: Polish & Cross-Cutting

**Goal**: Finalize documentation, performance checks, and rigorous testing.

- [ ] T065 [P] Verify role-based access control (RBAC) across all endpoints
- [ ] T066 [P] Verify Optimistic Locking (FR-027) via concurrent request tests
- [ ] T067 [P] Run full integration test suite `tests/integration/p2p/`
- [ ] T068 [P] Update API documentation in `docs/api/p2p.md`
- [ ] T069 Clean up any temporary TODOs or logging

### Task Completion Verification (Constitution v3.2.0 - Principles VI, II, XXI) ⚠️

- [ ] T070 TypeScript check: `npx tsc --noEmit` (verify zero errors)
- [ ] T071 Full build: `npm run build` (verify all packages build)
- [ ] T072 Schema-first: Ensure all Zod schemas match new API fields
- [ ] T073 Anti-Bloat: Verify no redundant methods created; check for reused logic [Principle XXI]

## Dependencies

1. **Setup** (T001-T013) must be complete before any User Story.
2. **US1 (PO)** (T014-T023) is prerequisite for **US2 (GRN)**.
3. **US2 (GRN)** (T024-T032) is prerequisite for **US3 (Bill)**.
4. **US3 (Bill)** (T033-T041) is prerequisite for **US4 (Payment)**.
5. **US5, US6, US7, US8** (Void/Cancel) depend on their respective creation stories but can be implemented in parallel after those.

## Implementation Strategy

1. **Sequential Core**: Build the Happy Path (US1 -> US2 -> US3 -> US4) sequentially to ensure data flow continuity.
2. **Parallel Error Handling**: Once a core story (e.g., US1) is done, the Cancel/Void logic (US5) can be implemented by a second developer or in parallel with the next core story.
3. **Frontend/Backend Split**: For each story, Backend tasks (Repo/Service/Controller) should precede Frontend tasks to ensure API availability.
