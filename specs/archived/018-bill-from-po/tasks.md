# Tasks: Create Bill from Purchase Order

**Input**: Design documents from `/specs/018-bill-from-po/`  
**Prerequisites**: plan.md ✅, spec.md ✅, quickstart.md ✅

**Tests**: No new tests requested - using existing tests in `apps/api/test/unit/`

**Backend Coverage**: FR-002, FR-003, FR-004, FR-009 are already implemented in `apps/api/src/modules/accounting/services/bill.service.ts::createFromPurchaseOrder`

**Organization**: Tasks grouped by user story for independent implementation

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included

---

## Phase 1: Setup (Not Required)

**Purpose**: No new project setup needed - this feature extends existing codebase.

✅ Skipped - existing infrastructure is sufficient.

---

## Phase 2: Foundational (Backend API)

**Purpose**: Add backend endpoint for duplicate bill checking (needed by US3)

- [x] T001 Add `getByOrderId` method to `BillService` in `apps/api/src/modules/accounting/services/bill.service.ts`
- [x] T002 Add `getByOrderId` handler to `BillController` in `apps/api/src/modules/accounting/controllers/bill.controller.ts`
- [x] T003 Add route `GET /bills/by-order/:orderId` in `apps/api/src/routes/bill.ts`

**Checkpoint**: Backend API ready for duplicate check

---

## Phase 3: User Story 1 - Create Bill from Completed PO (Priority: P1) 🎯 MVP

**Goal**: Users can create a bill from a COMPLETED Purchase Order with one click

**Independent Test**: Complete a PO, click "Create Bill", verify bill created with matching amount

### Implementation for User Story 1

- [x] T004 [P] [US1] Add `createFromPO(orderId: string)` method to `billService` in `apps/web/src/features/finance/services/billService.ts`
- [x] T005 [US1] Import `billService` and add `handleCreateBill(orderId)` function in `apps/web/src/features/procurement/pages/PurchaseOrders.tsx`
- [x] T006 [US1] Add "Create Bill" ActionButton for COMPLETED orders in `apps/web/src/features/procurement/pages/PurchaseOrders.tsx`

**Checkpoint**: User Story 1 complete - can create bill from completed PO

---

## Phase 4: User Story 2 - View PO Details in Bill (Priority: P2)

**Goal**: Bills display linked PO number for traceability

**Independent Test**: Create bill from PO, check Accounts Payable page shows PO reference

### Implementation for User Story 2

- [x] T007 [US2] Add "Source PO" column to bill table in `apps/web/src/features/finance/pages/AccountsPayable.tsx`
- [x] T008 [US2] Display `order?.orderNumber` or "Manual" for bills without PO link in `apps/web/src/features/finance/pages/AccountsPayable.tsx`

**Checkpoint**: User Stories 1 AND 2 complete - bills show PO reference

---

## Phase 5: User Story 3 - Prevent Duplicate Bills (Priority: P2)

**Goal**: System warns when creating bill from PO that already has a bill

**Independent Test**: Create bill from PO, try again on same PO, verify warning appears

### Implementation for User Story 3

- [x] T009 [P] [US3] Add `getByOrderId(orderId)` method to `billService` in `apps/web/src/features/finance/services/billService.ts`
- [x] T010 [US3] Add duplicate check before `createFromPO` using `useConfirm()` in `apps/web/src/features/procurement/pages/PurchaseOrders.tsx`

**Checkpoint**: All 3 user stories complete

---

## Phase 6: Polish & Verification

**Purpose**: Ensure code quality and constitution compliance

### Verification (Constitution Principles VIII & IX)

- [x] T011 TypeScript check: `npx tsc --noEmit` (verify zero errors)
- [x] T012 Full build: `npm run build` (verify all packages build)
- [ ] T013 Run existing bill tests: `cd apps/api && npx vitest run test/unit/routes/bill.test.ts`
- [ ] T014 Manual test per quickstart.md checklist (6 items)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: No dependencies - can start immediately
- **Phase 3 (US1)**: Depends on T004 for service method
- **Phase 4 (US2)**: No dependencies on other stories - can run parallel with US1
- **Phase 5 (US3)**: Depends on T001-T003 (backend API) and T004 (service method)
- **Phase 6 (Polish)**: After all user stories complete

### User Story Dependencies

| Story                   | Depends On      | Can Parallel With |
| ----------------------- | --------------- | ----------------- |
| US1 (Create Bill)       | T004            | US2               |
| US2 (View PO Link)      | None            | US1, US3          |
| US3 (Duplicate Warning) | T001-T003, T004 | US2               |

### Parallel Opportunities

```text
# Parallel Group A (Backend):
T001, T002, T003 can be done sequentially (same module)

# Parallel Group B (Frontend Services):
T004 [US1] and T009 [US3] in same file but can be in one edit

# Parallel Group C (Different Files):
T005-T006 [US1] (PurchaseOrders.tsx) || T007-T008 [US2] (AccountsPayable.tsx)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Backend API (T001-T003)
2. Complete Phase 3: User Story 1 (T004-T006)
3. **STOP and VALIDATE**: Test "Create Bill" button works
4. Run verification (T011-T014)

### Full Feature

1. Backend API → US1 → US2 → US3 → Polish
2. Total: 14 tasks
3. Estimated time: ~2 hours

---

## Summary

| Phase        | Tasks        | Description                 |
| ------------ | ------------ | --------------------------- |
| Foundational | T001-T003    | Backend duplicate check API |
| US1 (P1)     | T004-T006    | Create Bill button          |
| US2 (P2)     | T007-T008    | Show PO reference           |
| US3 (P2)     | T009-T010    | Duplicate warning           |
| Polish       | T011-T014    | Verification                |
| **Total**    | **14 tasks** |                             |
