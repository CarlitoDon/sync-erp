# Tasks: Cash Upfront Payment (Procurement)

**Input**: Design documents from `/specs/036-cash-upfront-payment/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Integration tests are MANDATORY for all business flows.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US5)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `apps/api/src/`
- **Frontend**: `apps/web/src/`
- **Database**: `packages/database/prisma/`
- **Shared**: `packages/shared/src/`

---

## Phase 1: Setup (Schema & Seed)

**Purpose**: Database schema migration and seed data for Account 1600

- [ ] T001 Add `PaymentTerms` enum (`NET_30`, `PARTIAL`, `UPFRONT`) to `packages/database/prisma/schema.prisma`
- [ ] T002 Add `PaymentStatus` enum (`PENDING`, `PARTIAL`, `PAID_UPFRONT`, `SETTLED`) to `packages/database/prisma/schema.prisma`
- [ ] T003 Add `paymentTerms`, `paymentStatus`, `paidAmount` fields to `Order` model in `packages/database/prisma/schema.prisma`
- [ ] T004 Add `orderId`, `paymentType`, `settledAt`, `settlementBillId` fields to `Payment` model in `packages/database/prisma/schema.prisma`
- [ ] T005 Add relation `upfrontPayments` and `settlements` to `Order` and `Invoice` models in `packages/database/prisma/schema.prisma`
- [ ] T006 Run Prisma migration: `npm run db:migrate -- --name add-upfront-payment-fields`
- [ ] T007 Add Account 1600 (Advances to Supplier) to seed file `packages/database/prisma/seed.ts`
- [ ] T008 Run seed: `npm run db:seed`

**Checkpoint**: Database ready with new fields and Account 1600 seeded

---

## Phase 2: Foundational (Shared Validators)

**Purpose**: Zod schemas that MUST be complete before service implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 [P] Add `PaymentTermsSchema` enum to `packages/shared/src/validators/order.validators.ts`
- [ ] T010 [P] Add `PaymentStatusSchema` enum to `packages/shared/src/validators/order.validators.ts`
- [ ] T011 [P] Add `RegisterUpfrontPaymentSchema` to `packages/shared/src/validators/payment.validators.ts`
- [ ] T012 [P] Add `SettlePrepaidSchema` to `packages/shared/src/validators/payment.validators.ts`
- [ ] T013 [P] Add `PaymentSummaryResponseSchema` to `packages/shared/src/validators/payment.validators.ts`
- [ ] T014 [P] Add `PrepaidInfoResponseSchema` to `packages/shared/src/validators/payment.validators.ts`
- [ ] T015 Export all new schemas from `packages/shared/src/validators/index.ts`
- [ ] T016 Rebuild shared package: `cd packages/shared && npm run build`
- [ ] T017 Regenerate Prisma client: `npm run db:generate`

**Checkpoint**: Foundation ready - all types available for implementation

---

## Phase 3: User Story 1 - Create PO with Upfront Terms (Priority: P1) 🎯 MVP

**Goal**: Enable creating Purchase Orders with "Cash Upfront" payment terms

**Independent Test**: Create PO with `paymentTerms = UPFRONT` → Verify PO saves correctly → Verify no journal created on post

### Implementation for User Story 1

- [ ] T018 [US1] Update `CreatePurchaseOrderInput` schema to include optional `paymentTerms` field in `packages/shared/src/validators/order.validators.ts`
- [ ] T019 [US1] Update `PurchaseOrderService.create()` to accept and store `paymentTerms` in `apps/api/src/modules/procurement/purchase-order.service.ts`
- [ ] T020 [US1] Update `purchaseOrder.create` mutation input to include `paymentTerms` in `apps/api/src/trpc/routers/purchaseOrder.router.ts`
- [ ] T021 [P] [US1] Add `PaymentTermsBadge` component in `apps/web/src/features/procurement/components/PaymentTermsBadge.tsx`
- [ ] T022 [P] [US1] Add `PaymentStatusBadge` component in `apps/web/src/features/procurement/components/PaymentStatusBadge.tsx`
- [ ] T023 [US1] Update Create PO form to include `paymentTerms` dropdown in `apps/web/src/features/procurement/pages/CreatePurchaseOrder.tsx`
- [ ] T024 [US1] Update PO Detail page to show Payment Terms badge in `apps/web/src/features/procurement/pages/PurchaseOrderDetail.tsx`
- [ ] T025 [US1] Integration test: Create PO with UPFRONT term, verify stored correctly in `apps/api/test/integration/upfront-payment.test.ts`

**Checkpoint**: User Story 1 complete - POs can be created with UPFRONT terms

---

## Phase 4: User Story 2 - Register Upfront Payment (Priority: P1) 🎯 MVP

**Goal**: Enable recording upfront payments before goods receipt, creating proper journal entries

**Independent Test**: Post payment → Verify Journal (Dr 1600, Cr 1200) → Verify PO `paymentStatus` updated

### Backend Implementation

- [ ] T026 [US2] Add `ensureCanRegisterPayment(order)` to `apps/api/src/modules/procurement/purchase-order.policy.ts`
- [ ] T027 [US2] Add `ensurePaymentWithinLimit(order, amount)` to `apps/api/src/modules/procurement/purchase-order.policy.ts`
- [ ] T028 [US2] Add `postUpfrontPayment(companyId, paymentId, orderNumber, amount, method, tx, businessDate?)` to `apps/api/src/modules/accounting/services/journal.service.ts`
- [ ] T029 [US2] Add `createUpfrontPayment(data, tx)` to `apps/api/src/modules/accounting/repositories/payment.repository.ts`
- [ ] T030 [US2] Add `updatePaidAmount(orderId, newAmount, tx)` to `apps/api/src/modules/procurement/purchase-order.repository.ts`
- [ ] T031 [US2] Implement `registerUpfrontPayment(companyId, input)` in `apps/api/src/modules/procurement/purchase-order.service.ts`
- [ ] T032 [US2] Add `getUpfrontPayments(orderId, companyId)` to `apps/api/src/modules/procurement/purchase-order.service.ts`
- [ ] T033 [US2] Add `getPaymentSummary(orderId, companyId)` to `apps/api/src/modules/procurement/purchase-order.service.ts`
- [ ] T034 [US2] Add `registerUpfrontPayment` mutation to `apps/api/src/trpc/routers/purchaseOrder.router.ts`
- [ ] T035 [US2] Add `getUpfrontPayments` query to `apps/api/src/trpc/routers/purchaseOrder.router.ts`
- [ ] T036 [US2] Add `getPaymentSummary` query to `apps/api/src/trpc/routers/purchaseOrder.router.ts`

### Frontend Implementation

- [ ] T037 [P] [US2] Create `RegisterPaymentModal` component in `apps/web/src/features/procurement/components/RegisterPaymentModal.tsx`
- [ ] T038 [P] [US2] Create `UpfrontPaymentCard` component in `apps/web/src/features/procurement/components/UpfrontPaymentCard.tsx`
- [ ] T039 [P] [US2] Create `PaymentHistoryTable` component in `apps/web/src/features/procurement/components/PaymentHistoryTable.tsx`
- [ ] T040 [US2] Update PO Detail to show "Register Payment" button when `paymentTerms = UPFRONT` in `apps/web/src/features/procurement/pages/PurchaseOrderDetail.tsx`
- [ ] T041 [US2] Update PO Detail to show payment summary card and history table in `apps/web/src/features/procurement/pages/PurchaseOrderDetail.tsx`
- [ ] T042 [US2] Integration test: Register payment, verify journal Dr 1600 Cr 1200, verify PO status in `apps/api/test/integration/upfront-payment.test.ts`

**Checkpoint**: User Story 2 complete - Upfront payments can be registered and journaled

---

## Phase 5: User Story 3 - Receive Goods After Payment (Priority: P1)

**Goal**: Existing GRN flow works correctly for upfront POs

**Independent Test**: Create GRN for paid PO → Verify Journal (Dr 1400, Cr 2105) → GRN linked to PO

### Implementation for User Story 3

- [ ] T043 [US3] Verify existing GRN service does NOT block on payment status (no code changes expected - this is validation of existing behavior) in `apps/api/src/modules/inventory/inventory.service.ts`
- [ ] T044 [US3] Integration test: GRN for PAID_UPFRONT PO works correctly in `apps/api/test/integration/upfront-payment.test.ts`

**Checkpoint**: User Story 3 complete - GRN flow verified for upfront orders

---

## Phase 6: User Story 4 - Create & Post Supplier Invoice (Priority: P1)

**Goal**: Bill posting shows prepaid info banner when prepaid exists

**Independent Test**: Post Bill → Verify Journal (Dr 2105, Cr 2100) → Verify "Prepaid Available" banner shows

### Backend Implementation

- [ ] T045 [US4] Add `getPrepaidByOrderId(orderId, companyId, tx?)` to `apps/api/src/modules/accounting/repositories/payment.repository.ts`
- [ ] T046 [US4] Add `getPrepaidInfo(billId, companyId)` to `apps/api/src/modules/accounting/services/bill.service.ts`
- [ ] T047 [US4] Add `getPrepaidInfo` query to `apps/api/src/trpc/routers/bill.router.ts`

### Frontend Implementation

- [ ] T048 [P] [US4] Create `PrepaidInfoBanner` component in `apps/web/src/features/accounting/components/PrepaidInfoBanner.tsx`
- [ ] T049 [US4] Update Bill Detail to show PrepaidInfoBanner when prepaid exists in `apps/web/src/features/accounting/pages/BillDetail.tsx`
- [ ] T050 [US4] Integration test: Bill with prepaid PO shows correct banner info in `apps/api/test/integration/upfront-payment.test.ts`

**Checkpoint**: User Story 4 complete - Bills show prepaid availability

---

## Phase 7: User Story 5 - Settlement Prepaid vs AP (Priority: P2)

**Goal**: Clear prepaid against AP when user clicks "Settle Prepaid" button

**Independent Test**: Click Settle → Verify Journal (Dr 2100, Cr 1600) → Bill balance reduced → Prepaid marked settled

### Backend Implementation

- [ ] T051 [US5] Add `ensureCanSettle(bill)` to `apps/api/src/modules/accounting/policies/bill.policy.ts`
- [ ] T052 [US5] Add `postSettlement(companyId, billId, billNumber, amount, prepaidPaymentId, tx)` to `apps/api/src/modules/accounting/services/journal.service.ts`
- [ ] T053 [US5] Add `markPaymentSettled(paymentId, billId, tx)` to `apps/api/src/modules/accounting/repositories/payment.repository.ts`
- [ ] T054 [US5] Add `reduceBalance(billId, amount, tx)` to `apps/api/src/modules/accounting/repositories/invoice.repository.ts`
- [ ] T055 [US5] Implement `settlePrepaid(billId, companyId)` in `apps/api/src/modules/accounting/services/bill.service.ts`
- [ ] T056 [US5] Add `settlePrepaid` mutation to `apps/api/src/trpc/routers/bill.router.ts`

### Frontend Implementation

- [ ] T057 [P] [US5] Create `SettlementModal` component in `apps/web/src/features/accounting/components/SettlementModal.tsx`
- [ ] T058 [P] [US5] Create `SettlementHistoryTable` component in `apps/web/src/features/accounting/components/SettlementHistoryTable.tsx`
- [ ] T059 [US5] Update PrepaidInfoBanner to include "Settle Prepaid" button in `apps/web/src/features/accounting/components/PrepaidInfoBanner.tsx`
- [ ] T060 [US5] Update Bill Detail to show settlement modal and history in `apps/web/src/features/accounting/pages/BillDetail.tsx`
- [ ] T061 [US5] Integration test: Full settlement flow with journal verification in `apps/api/test/integration/upfront-payment.test.ts`

**Checkpoint**: User Story 5 complete - Settlement flow working

---

## Phase 8: Full E2E Integration Test

**Purpose**: Complete flow test: PO → Pay → GRN → Bill → Settle

- [ ] T062 Integration test: Full upfront cycle in single `it()` block in `apps/api/test/integration/upfront-payment.test.ts`
  - Create PO with UPFRONT term
  - Post PO
  - Register upfront payment (full amount)
  - Verify Journal (Dr 1600 Cr 1200)
  - Create and Post GRN
  - Verify Journal (Dr 1400 Cr 2105)
  - Create and Post Bill
  - Verify Journal (Dr 2105 Cr 2100)
  - Settle Prepaid
  - Verify Journal (Dr 2100 Cr 1600)
  - Verify final balances: AP=0, Prepaid=0 (satisfies SC-003: AP Aging zero for settled transactions)

**Checkpoint**: Full E2E flow verified

---

## Phase 9: Polish & Verification

**Purpose**: Build verification and cleanup

- [ ] T063 [P] Update PO List page to show payment term badge on cards in `apps/web/src/features/procurement/pages/PurchaseOrders.tsx`
- [ ] T064 [P] Add loading states to all new modals
- [ ] T065 [P] Add error handling and user-friendly messages
- [ ] T066 TypeScript check: `npx tsc --noEmit` (verify zero errors)
- [ ] T067 Lint check: `npm run lint` (verify zero errors)
- [ ] T068 Full build: `npm run build` (verify success)
- [ ] T069 Run all tests: `npm run test`
- [ ] T070 Validate quickstart.md scenarios manually

**Checkpoint**: Feature complete and verified

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ────────────────────────────────────────────────┐
                                                                │
Phase 2 (Foundational) ─────────────────────────────────────────┤
                                                                │
    ┌───────────────────────────────────────────────────────────┘
    │
    ├── Phase 3 (US1: PO with Terms) ──────────┐
    │                                          │
    ├── Phase 4 (US2: Register Payment) ───────┤  (Can parallel after US1)
    │                                          │
    ├── Phase 5 (US3: GRN Flow) ───────────────┤  (Can parallel after US2)
    │                                          │
    ├── Phase 6 (US4: Bill Prepaid Info) ──────┤  (Depends on US3)
    │                                          │
    └── Phase 7 (US5: Settlement) ─────────────┘  (Depends on US4)

Phase 8 (E2E Test) ─────────────────────────────────────────────┐
                                                                │
Phase 9 (Polish) ───────────────────────────────────────────────┘
```

### User Story Dependencies

| Story | Depends On                    | Can Parallel With |
| ----- | ----------------------------- | ----------------- |
| US1   | Foundation                    | -                 |
| US2   | US1 (needs PO with terms)     | -                 |
| US3   | US2 (needs payment)           | -                 |
| US4   | US3 (needs GRN)               | -                 |
| US5   | US4 (needs bill with prepaid) | -                 |

**Note**: This feature has sequential dependencies due to the business flow nature.

### Within Each User Story

- Backend before Frontend
- Repository before Service
- Policy before Service
- Service before Router

### Parallel Opportunities

- T009-T014: All validator schemas (Phase 2)
- T021-T022: Badge components (Phase 3)
- T037-T039: Payment UI components (Phase 4)
- T048: PrepaidInfoBanner (Phase 6)
- T057-T058: Settlement UI components (Phase 7)
- T063-T065: Polish tasks (Phase 9)

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Setup (schema)
2. Complete Phase 2: Foundational (validators)
3. Complete Phase 3: US1 (PO with terms)
4. Complete Phase 4: US2 (register payment)
5. **STOP and VALIDATE**: Test payment registration works
6. Deploy/demo if ready

### Full Feature

1. Continue to Phase 5-7 for complete flow
2. Phase 8: E2E test
3. Phase 9: Polish

### Estimated Effort

| Phase        | Tasks  | Effort      |
| ------------ | ------ | ----------- |
| Setup        | 8      | 0.5 day     |
| Foundational | 9      | 0.25 day    |
| US1          | 8      | 0.5 day     |
| US2          | 17     | 1 day       |
| US3          | 2      | 0.1 day     |
| US4          | 6      | 0.5 day     |
| US5          | 11     | 0.75 day    |
| E2E + Polish | 9      | 0.5 day     |
| **Total**    | **70** | **~4 days** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Sequential flow due to business logic dependencies
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
