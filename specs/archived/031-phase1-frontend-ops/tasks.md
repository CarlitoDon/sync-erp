# Tasks: Phase 1 Frontend Operational UI & Observability

**Input**: Design documents from `/specs/031-phase1-frontend-ops/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Tests are NOT explicitly requested - focus on implementation tasks.

**Organization**: Tasks grouped by user story (P1-P3) for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1-US5) from spec.md
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared component enhancements required for all user stories

- [x] T001 Add `isLoading` prop to Button component in `apps/web/src/components/ui/Button.tsx`
- [x] T002 [P] Create `useLoadingSubmit` hook for form submission in `apps/web/src/hooks/useLoadingSubmit.ts`
- [x] T003 [P] Add DatePicker component (if not exists) in `apps/web/src/components/ui/DatePicker.tsx`

---

## Phase 2: Foundational (Backend APIs)

**Purpose**: New backend endpoints that user stories depend on

**⚠️ CRITICAL**: These APIs must be complete before frontend integration

- [x] T004 Create admin routes file in `apps/api/src/routes/admin.ts`
- [x] T005 [P] Create admin controller in `apps/api/src/modules/admin/controller.ts`
- [x] T006 [P] Create admin service in `apps/api/src/modules/admin/service.ts`
- [x] T007 [P] Create admin repository in `apps/api/src/modules/admin/repository.ts`
- [x] T008 Implement `GET /api/dashboard/kpis` endpoint in `apps/api/src/modules/dashboard/controller.ts`
- [x] T009 [P] Add dashboard KPI aggregation logic in `apps/api/src/modules/dashboard/service.ts`

**Checkpoint**: Backend APIs ready - frontend implementation can begin

---

## Phase 3: User Story 1 - Dashboard KPIs (Priority: P1) 🎯 MVP

**Goal**: Display read-only KPIs on Dashboard: Total Sales, Outstanding AR/AP, Inventory Value

**Independent Test**: Login → Dashboard → Verify KPI cards show aggregated data from backend

### Implementation for User Story 1

- [x] T010 [P] [US1] Create dashboard service to fetch KPIs in `apps/web/src/features/dashboard/services/dashboard.service.ts`
- [x] T011 [P] [US1] Create DashboardKPIs component in `apps/web/src/features/dashboard/components/DashboardKPIs.tsx`
- [x] T012 [US1] Add StatCard component for individual KPIs in `apps/web/src/features/dashboard/components/StatCard.tsx`
- [x] T013 [US1] Integrate DashboardKPIs into Dashboard page in `apps/web/src/features/dashboard/pages/Dashboard.tsx`
- [x] T014 [US1] Add loading skeleton for KPI cards while data loads

**Checkpoint**: Dashboard shows real KPI data from backend

---

## Phase 4: User Story 2 - Invoice Management (Priority: P1)

**Goal**: Invoice List + Detail + Payment Modal with businessDate field

**Independent Test**: Navigate to Invoices → Select POSTED invoice → Record Payment with businessDate → Verify balance updates

### Implementation for User Story 2

- [x] T015 [P] [US2] Verify Invoice List component exists in `apps/web/src/features/finance/components/InvoiceList.tsx`
- [x] T016 [P] [US2] Create PaymentModal component with businessDate in `apps/web/src/features/finance/components/PaymentModal.tsx`
- [x] T017 [US2] Add payment service method in `apps/web/src/features/finance/services/invoice.service.ts`
- [x] T018 [US2] Integrate PaymentModal into InvoiceDetail page in `apps/web/src/features/finance/pages/InvoiceDetailPage.tsx`
- [x] T019 [US2] Add button disable during in-flight request in PaymentModal
- [x] T020 [US2] Add confirmation modal before payment submission

**Checkpoint**: Can record payments against POSTED invoices with businessDate

---

## Phase 5: User Story 3 - Purchase Order & GRN (Priority: P1)

**Goal**: PO List + Receive Goods screen with businessDate field

**Independent Test**: Navigate to POs → Select CONFIRMED PO → Receive Goods with businessDate → Verify stock updates

### Implementation for User Story 3

- [x] T021 [P] [US3] Verify PO List component exists in `apps/web/src/features/procurement/components/POList.tsx`
- [x] T022 [P] [US3] Create ReceiveGoodsModal component with businessDate in `apps/web/src/features/procurement/components/ReceiveGoodsModal.tsx`
- [x] T023 [US3] Add goods receipt service method in `apps/web/src/features/procurement/services/po.service.ts`
- [x] T024 [US3] Integrate ReceiveGoodsModal into PODetail page in `apps/web/src/features/procurement/pages/PODetailPage.tsx`
- [x] T025 [US3] Add button disable during in-flight request in ReceiveGoodsModal
- [x] T026 [US3] Add over-receipt warning confirmation modal

**Checkpoint**: Can receive goods against CONFIRMED POs with businessDate

---

## Phase 6: User Story 4 - UI Guardrails (Priority: P1)

**Goal**: Implement preventive UI patterns across all actionable screens

**Independent Test**: Any destructive action → Confirm modal appears → Cancel returns to previous state

### Implementation for User Story 4

- [x] T027 [P] [US4] Verify ConfirmModal component exists in `apps/web/src/components/ui/ConfirmModal.tsx`
- [x] T028 [P] [US4] Add confirmation to Invoice void action in `apps/web/src/features/finance/components/InvoiceList.tsx`
- [x] T029 [US4] Add confirmation to PO cancel action in `apps/web/src/features/procurement/components/POList.tsx`
- [x] T030 [US4] Add confirmation to Stock Adjustment action in `apps/web/src/features/inventory/components/StockAdjustmentModal.tsx`
- [x] T031 [US4] Integrate useLoadingSubmit in all critical action forms
- [x] T032 [US4] Add visual feedback for in-flight requests across all forms

**Checkpoint**: All destructive actions require confirmation, all forms show loading states

---

## Phase 7: User Story 5 - Admin Observability (Priority: P2)

**Goal**: Admin-only page showing saga failures and orphan journals

**Independent Test**: Navigate to Admin → Saga Failures shows list with error details

### Implementation for User Story 5

- [x] T033 [P] [US5] Create admin feature directory structure in `apps/web/src/features/admin/`
- [x] T034 [P] [US5] Create admin service for observability in `apps/web/src/features/admin/services/admin.service.ts`
- [x] T035 [US5] Create SagaFailureList component in `apps/web/src/features/admin/components/SagaFailureList.tsx`
- [x] T036 [US5] Create JournalOrphanList component in `apps/web/src/features/admin/components/JournalOrphanList.tsx`
- [x] T037 [US5] Create Observability page in `apps/web/src/features/admin/pages/Observability.tsx`
- [x] T038 [US5] Add admin route to AppRouter in `apps/web/src/app/AppRouter.tsx`
- [x] T039 [US5] Add loading and error states to observability components

**Checkpoint**: Admin can view system health via observability page

---

## Phase 8: Polish & Deploy (Priority: P2)

**Goal**: Final integration testing and deployment preparation

### Implementation for Polish

- [x] T040 [P] Run full integration test suite
- [x] T041 [P] Verify responsive design on mobile viewports
- [x] T042 Verify error handling for all API failures
- [x] T043 Add console error logging for failed API calls
- [x] T044 Update user documentation if needed
- [x] T045 Create release notes for Phase 1 features

**Checkpoint**: Feature complete and ready for deployment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - start immediately
- **Phase 2 (Foundational)**: Depends on Setup - BLOCKS frontend work
- **Phases 3-5 (P1 Stories)**: All depend on Phase 2 - can run in parallel
- **Phase 6 (P2 Story)**: Can run after Phase 2, independent of P1 stories
- **Phase 7 (P3 Story)**: Can run after Phase 2, independent of other stories
- **Phase 8 (Polish)**: Depends on all desired stories complete

### User Story Dependencies

| Story            | Depends On | Can Run Parallel With |
| ---------------- | ---------- | --------------------- |
| US1 (Dashboard)  | Phase 2    | US2, US3, US4, US5    |
| US2 (Invoices)   | Phase 2    | US1, US3, US4, US5    |
| US3 (PO/GRN)     | Phase 2    | US1, US2, US4, US5    |
| US4 (Guardrails) | Phase 2    | All others            |
| US5 (Admin)      | Phase 2    | All others            |

### Parallel Opportunities

```bash
# Phase 2 - Backend APIs (all parallel):
T005, T006, T007, T009 can run together

# Phase 3 - Dashboard (parallel):
T010, T011 can run together

# Phase 4 - Invoices (parallel):
T015, T016 can run together

# Phase 7 - Admin (parallel):
T033, T034, T035, T036 can run together
```

---

## Implementation Strategy

### MVP First (User Stories 1-3)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Backend APIs (T004-T009)
3. Complete Phase 3: Dashboard KPIs (T010-T014)
4. **VALIDATE**: Dashboard shows real data
5. Complete Phase 4: Invoice Management (T015-T020)
6. **VALIDATE**: Can record payments
7. Complete Phase 5: PO/GRN (T021-T026)
8. **VALIDATE**: Can receive goods

### Full Feature

Continue with US4 (Guardrails) and US5 (Admin) after MVP is validated.

---

## Task Summary

| Phase        | Story | Task Count |
| ------------ | ----- | ---------- |
| Setup        | -     | 3          |
| Foundational | -     | 6          |
| Dashboard    | US1   | 5          |
| Invoices     | US2   | 6          |
| PO/GRN       | US3   | 6          |
| Guardrails   | US4   | 6          |
| Admin        | US5   | 7          |
| Polish       | -     | 6          |
| **TOTAL**    | -     | **45**     |

---

## Notes

- All P1 stories (US1, US2, US3) are core MVP
- US4 enhances safety but can be implemented incrementally
- US5 is admin-only and lowest priority
- Each story should be tested independently before moving to next
- Commit after each task or logical group
