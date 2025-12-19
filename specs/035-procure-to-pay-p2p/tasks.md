# Tasks: Procure-to-Pay (P2P) Flow

**Feature Branch**: `035-procure-to-pay-p2p`
**Status**: Planned

## Phase 1: Setup & Data Modeling (Phse 1)

**Goal**: Initialize database schema, shared types, and project structure.

- [ ] T001 Define `PurchaseOrder` and `PurchaseOrderLine` in `packages/database/prisma/schema.prisma`
- [ ] T002 Define `GoodsReceipt` and `GoodsReceiptLine` in `packages/database/prisma/schema.prisma`
- [ ] T003 Define `Bill` and `BillLine` in `packages/database/prisma/schema.prisma`
- [ ] T004 Define `Payment` in `packages/database/prisma/schema.prisma`
- [ ] T005 Define `DocumentSequence` model in `packages/database/prisma/schema.prisma`
- [ ] T006 Run `npm run db:migrate` to apply P2P schema changes
- [ ] T007 Define shared types in `packages/shared/src/types/p2p.ts`
- [ ] T008 [P] Define Zod schemas in `packages/shared/src/validators/p2p.ts` (PO, GRN, Bill, Payment inputs)
- [ ] T009 Create module directories: `apps/api/src/modules/procurement` and `apps/api/src/modules/accounting`
- [ ] T010 Create feature directories: `apps/web/src/features/procurement` and `apps/web/src/features/accounting`

## Phase 2: User Story 1 - Create & Confirm PO (Priority: P1)

**Goal**: Enable creation of Purchase Orders and confirmation to lock them.

**Independent Test**: User can create PO -> Status DRAFT -> Confirm PO -> Status CONFIRMED.

### Implementation [US1]

- [ ] T011 [US1] Create Repository in `apps/api/src/modules/procurement/purchase-order.repository.ts`
- [ ] T012 [US1] Create Policy in `apps/api/src/modules/procurement/purchase-order.policy.ts` (Check status transitions)
- [ ] T013 [US1] Implement sequence generation logic for PO in `apps/api/src/modules/procurement/sequence.service.ts`
- [ ] T014 [US1] Implement Service in `apps/api/src/modules/procurement/purchase-order.service.ts` (Create, Confirm)
- [ ] T015 [US1] Implement Controller in `apps/api/src/modules/procurement/purchase-order.controller.ts`
- [ ] T016 [US1] Register routes in `apps/api/src/routes/v1/procurement.routes.ts`
- [ ] T017 [US1] Create `usePurchaseOrder` hook in `apps/web/src/features/procurement/hooks/usePurchaseOrder.ts`
- [ ] T018 [US1] Implement PO List UI in `apps/web/src/features/procurement/components/PurchaseOrderList.tsx`
- [ ] T019 [US1] Implement PO Create Form in `apps/web/src/features/procurement/components/PurchaseOrderForm.tsx`
- [ ] T020 [US1] Implement PO Detail View with Confirm Action in `apps/web/src/features/procurement/components/PurchaseOrderDetail.tsx`
- [ ] T021 [US1] Integration Test: `tests/integration/p2p/us1_po_flow.test.ts`

## Phase 3: User Story 2 - Receive Goods (GRN) (Priority: P1)

**Goal**: Receive goods against confirmed PO and update inventory.

**Independent Test**: Confirmed PO -> Create GRN -> Post GRN -> Stock Increases -> PO Status Updated.

### Implementation [US2]

- [ ] T022 [US2] Create Repository in `apps/api/src/modules/procurement/goods-receipt.repository.ts`
- [ ] T023 [US2] Create Policy in `apps/api/src/modules/procurement/goods-receipt.policy.ts` (Check PO status, remaining qty)
- [ ] T024 [US2] Implement Service in `apps/api/src/modules/procurement/goods-receipt.service.ts` (Create, Post with Stock Update)
- [ ] T025 [US2] Implement Controller in `apps/api/src/modules/procurement/goods-receipt.controller.ts`
- [ ] T026 [US2] Add GRN routes to `apps/api/src/routes/v1/procurement.routes.ts`
- [ ] T027 [US2] Create `useGoodsReceipt` hook in `apps/web/src/features/procurement/hooks/useGoodsReceipt.ts`
- [ ] T028 [US2] Implement GRN Create Form (load PO items) in `apps/web/src/features/procurement/components/GoodsReceiptForm.tsx`
- [ ] T029 [US2] Implement GRN Detail View with Post Action in `apps/web/src/features/procurement/components/GoodsReceiptDetail.tsx`
- [ ] T030 [US2] Integration Test: `tests/integration/p2p/us2_grn_flow.test.ts`

## Phase 4: User Story 3 - Create & Post Bill (Priority: P1)

**Goal**: Create supplier invoice from GRN and post to Accounts Payable.

**Independent Test**: Posted GRN -> Create Bill -> Post Bill -> AP Journal Created -> Bill Status POSTED.

### Implementation [US3]

- [ ] T031 [US3] Create Repository in `apps/api/src/modules/accounting/bill.repository.ts`
- [ ] T032 [US3] Create Policy in `apps/api/src/modules/accounting/bill.policy.ts` (3-Way Match Validation)
- [ ] T033 [US3] Implement Service in `apps/api/src/modules/accounting/bill.service.ts` (Create, Post with Journal Entry)
- [ ] T034 [US3] Implement Controller in `apps/api/src/modules/accounting/bill.controller.ts`
- [ ] T035 [US3] Register routes in `apps/api/src/routes/v1/accounting.routes.ts`
- [ ] T036 [US3] Create `useBill` hook in `apps/web/src/features/accounting/hooks/useBill.ts`
- [ ] T037 [US3] Implement Bill Create Form (load GRN items) in `apps/web/src/features/accounting/components/BillForm.tsx`
- [ ] T038 [US3] Implement Bill Detail View with Post Action in `apps/web/src/features/accounting/components/BillDetail.tsx`
- [ ] T039 [US3] Integration Test: `tests/integration/p2p/us3_bill_flow.test.ts`

## Phase 5: User Story 4 - Record Payment (Priority: P2)

**Goal**: Pay posted bills and update bank/cash balances.

**Independent Test**: Posted Bill -> Record Payment -> Payment Created -> Bill Status PAID -> Journals Created.

### Implementation [US4]

- [ ] T040 [US4] Create Repository in `apps/api/src/modules/accounting/payment.repository.ts`
- [ ] T041 [US4] Create Policy in `apps/api/src/modules/accounting/payment.policy.ts` (Check Bill status, amount)
- [ ] T042 [US4] Implement Service in `apps/api/src/modules/accounting/payment.service.ts` (Record, Update Bill, Journal Entry)
- [ ] T043 [US4] Implement Controller in `apps/api/src/modules/accounting/payment.controller.ts`
- [ ] T044 [US4] Add Payment routes to `apps/api/src/routes/v1/accounting.routes.ts`
- [ ] T045 [US4] Create `usePayment` hook in `apps/web/src/features/accounting/hooks/usePayment.ts`
- [ ] T046 [US4] Implement Payment Dialog/Form in `apps/web/src/features/accounting/components/PaymentForm.tsx`
- [ ] T047 [US4] Integration Test: `tests/integration/p2p/us4_payment_flow.test.ts`

## Phase 6: User Story 5 - Cancel PO (Priority: P3)

**Goal**: Cancel CONFIRMED POs before goods are received.

### Implementation [US5]

- [ ] T048 [US5] Update Policy in `apps/api/src/modules/procurement/purchase-order.policy.ts` (Allow Cancel if no GRN)
- [ ] T049 [US5] Implement Cancel method in `apps/api/src/modules/procurement/purchase-order.service.ts`
- [ ] T050 [US5] Add Cancel endpoint to `apps/api/src/modules/procurement/purchase-order.controller.ts`
- [ ] T051 [US5] Add Cancel button to `apps/web/src/features/procurement/components/PurchaseOrderDetail.tsx`

## Phase 7: User Story 6 - Void GRN (Priority: P3)

**Goal**: Void POSTED GRNs and rollback stock (provided no Bill exists).

### Implementation [US6]

- [ ] T052 [US6] Update Policy in `apps/api/src/modules/procurement/goods-receipt.policy.ts` (Allow Void if no Bill)
- [ ] T053 [US6] Implement Void method in `apps/api/src/modules/procurement/goods-receipt.service.ts` (Rollback Stock, Update PO)
- [ ] T054 [US6] Add Void endpoint to `apps/api/src/modules/procurement/goods-receipt.controller.ts`
- [ ] T055 [US6] Add Void button to `apps/web/src/features/procurement/components/GoodsReceiptDetail.tsx`

## Phase 8: User Story 7 - Void Bill (Priority: P3)

**Goal**: Void POSTED Bill and reverse AP (provided no Payment exists).

### Implementation [US7]

- [ ] T056 [US7] Update Policy in `apps/api/src/modules/accounting/bill.policy.ts` (Allow Void if no Payment)
- [ ] T057 [US7] Implement Void method in `apps/api/src/modules/accounting/bill.service.ts` (Reverse AP Journal)
- [ ] T058 [US7] Add Void endpoint to `apps/api/src/modules/accounting/bill.controller.ts`
- [ ] T059 [US7] Add Void button to `apps/web/src/features/accounting/components/BillDetail.tsx`

## Phase 9: User Story 8 - Void Payment (Priority: P3)

**Goal**: Void Payment and restore Bill balance.

### Implementation [US8]

- [ ] T060 [US8] Implement Void method in `apps/api/src/modules/accounting/payment.service.ts` (Reverse Journal, Update Bill)
- [ ] T061 [US8] Add Void endpoint to `apps/api/src/modules/accounting/payment.controller.ts`
- [ ] T062 [US8] Add Void action to Payment List/Detail in `apps/web/src/features/accounting/components/BillDetail.tsx`

## Phase 10: Polish & Cross-Cutting

**Goal**: Finalize documentation, performance checks, and rigorous testing.

- [ ] T063 [P] Ensure all financial calculations use `Decimal.js` (Audit)
- [ ] T064 [P] Verify role-based access control (RBAC) across all endpoints
- [ ] T065 [P] Run full integration test suite `tests/integration/p2p/`
- [ ] T066 [P] Update API documentation in `docs/api/p2p.md`
- [ ] T067 Clean up any temporary TODOs or logging

### Task Completion Verification ⚠️

- [ ] T068 TypeScript check: `npx tsc --noEmit` (verify zero errors)
- [ ] T069 Full build: `npm run build` (verify all packages build)
- [ ] T070 Schema-first: Ensure all Zod schemas match new API fields

## Dependencies

1. **Setup** (T001-T010) must be complete before any User Story.
2. **US1 (PO)** (T011-T021) is prerequisite for **US2 (GRN)**.
3. **US2 (GRN)** (T022-T030) is prerequisite for **US3 (Bill)**.
4. **US3 (Bill)** (T031-T039) is prerequisite for **US4 (Payment)**.
5. **US5, US6, US7, US8** (Void/Cancel) depend on their respective creation stories but can be implemented in parallel after those.

## Implementation Strategy

1. **Sequential Core**: Build the Happy Path (US1 -> US2 -> US3 -> US4) sequentially to ensure data flow continuity.
2. **Parallel Error Handling**: Once a core story (e.g., US1) is done, the Cancel/Void logic (US5) can be implemented by a second developer or in parallel with the next core story.
3. **Frontend/Backend Split**: For each story, Backend tasks (Repo/Service/Controller) should precede Frontend tasks to ensure API availability.
