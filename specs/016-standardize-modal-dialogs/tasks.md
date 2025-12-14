# Tasks: Standardize Modal Dialogs

**Input**: Design documents from `/specs/016-standardize-modal-dialogs/`  
**Prerequisites**: plan.md ✓, spec.md ✓, data-model.md ✓, quickstart.md ✓

**Tests**: Optional (not explicitly requested in spec)

**Organization**: Tasks grouped by user story for independent implementation

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: US1, US2, US3 maps to user stories from spec.md

---

## Phase 1: Setup (Reusable Component)

**Purpose**: Create reusable FormModal component

- [x] T001 Create `FormModal` component in `apps/web/src/components/ui/FormModal.tsx`

**Checkpoint**: Reusable modal wrapper ready ✅

---

## Phase 2: User Story 1 - Consistent Create Experience (Priority: P1) 🎯 MVP

**Goal**: Convert inline forms to modal popups for simple forms (Suppliers, Customers, Products, Finance)

**Independent Test**: Click "Add" button → form appears as modal popup, not inline

### Implementation

- [x] T002 [P] [US1] Convert Suppliers page inline form to modal in `apps/web/src/features/procurement/pages/Suppliers.tsx`
- [x] T003 [P] [US1] Convert Customers page inline form to modal in `apps/web/src/features/sales/pages/Customers.tsx`
- [x] T004 [P] [US1] Convert Products page inline form to modal in `apps/web/src/features/inventory/pages/Products.tsx`
- [x] T005 [P] [US1] Convert Finance page Create Account form to modal in `apps/web/src/features/finance/pages/Finance.tsx`

**Checkpoint**: 4 simple forms now use modal popups ✅

---

## Phase 3: User Story 2 - Modal Behavior Consistency (Priority: P2)

**Goal**: Ensure all modals have consistent overlay click-to-close behavior

**Independent Test**: Click overlay → modal closes; Click Cancel → modal closes

### Implementation

- [x] T006 [US2] Verify and fix overlay click behavior in all 4 modals from Phase 2
- [x] T007 [US2] Verify form reset on Cancel in all 4 modals from Phase 2

**Checkpoint**: All modals have consistent behavior ✅

---

## Phase 4: User Story 3 - Order Forms as Modal (Priority: P3)

**Goal**: Convert complex order forms (Sales Order, Purchase Order) to scrollable modals

**Independent Test**: Click "New Order" → form appears as scrollable modal popup

### Implementation

- [x] T008 [P] [US3] Convert Sales Orders page inline form to scrollable modal in `apps/web/src/features/sales/pages/SalesOrders.tsx`
- [x] T009 [P] [US3] Convert Purchase Orders page inline form to scrollable modal in `apps/web/src/features/procurement/pages/PurchaseOrders.tsx`
- [x] T010 [US3] Verify scrollable behavior for long forms

**Checkpoint**: Order forms use scrollable modals ✅

---

## Phase 5: Polish & Verification

**Purpose**: Final verification and cleanup

- [x] T011 Run `npm run build` to verify no build errors
- [x] T012 Grep verify: zero remaining inline form toggles (`showForm &&`)
- [x] T013 Manual verification: Test all 6 pages - modal open/close/submit

**Checkpoint**: Feature complete and verified ✅

---

## Summary

| Phase     | Story  | Tasks  | Description          | Status      |
| --------- | ------ | ------ | -------------------- | ----------- |
| 1         | Setup  | 1      | FormModal component  | ✅          |
| 2         | US1    | 4      | Simple forms (MVP)   | ✅          |
| 3         | US2    | 2      | Behavior consistency | ✅          |
| 4         | US3    | 3      | Order forms          | ✅          |
| 5         | Polish | 3      | Verification         | ✅          |
| **Total** |        | **13** |                      | ✅ Complete |

---

## Additional Work (Bonus)

During implementation, we also fixed a critical bug and improved code quality:

- [x] B001 Fixed Team Management 404 error - userService was calling wrong endpoint
- [x] B002 Created `src/utils/safeData.ts` with `ensureArray()` helper
- [x] B003 Applied defensive API response handling to all 10 service files
