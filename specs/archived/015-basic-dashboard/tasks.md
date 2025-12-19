# Tasks: Basic Dashboard

**Input**: Design documents from `/specs/015-basic-dashboard/`  
**Prerequisites**: plan.md ✓, spec.md ✓, data-model.md ✓, quickstart.md ✓

**Tests**: Optional (not explicitly requested in spec)

**Organization**: Tasks grouped by user story for independent implementation

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: US1, US2, US3 maps to user stories from spec.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Types and service foundation for dashboard

- [x] T001 [P] Create `DashboardMetrics` interface in `apps/web/src/features/dashboard/types.ts`
- [x] T002 Create `dashboardService.ts` in `apps/web/src/features/dashboard/services/dashboardService.ts`

**Checkpoint**: Dashboard service ready for data fetching ✓

---

## Phase 2: User Story 1 - View Business Overview (Priority: P1) 🎯 MVP

**Goal**: Display card metrics with real data from APIs (receivables, payables, products count)

**Independent Test**: Login → Dashboard shows actual numbers matching database values

### Implementation

- [x] T003 [US1] Import `dashboardService` and hooks in `apps/web/src/features/dashboard/pages/Dashboard.tsx`
- [x] T004 [US1] Add data fetching with loading state using `useCompanyData` hook in `Dashboard.tsx`
- [x] T005 [US1] Update StatCard components to display fetched data in `Dashboard.tsx`
- [x] T006 [US1] Add loading skeleton state in `Dashboard.tsx`
- [x] T007 [US1] Add error handling state in `Dashboard.tsx`

**Checkpoint**: Dashboard displays real receivables, payables, products count ✅

---

## Phase 3: User Story 2 - View Quick Stats (Priority: P2)

**Goal**: Display actionable counts (pending orders, unpaid invoices/bills)

**Independent Test**: Counts match database records with filtered status

### Implementation

- [x] T008 [US2] Add pendingOrders, unpaidInvoices, unpaidBills to `DashboardMetrics` type in `types.ts`
- [x] T009 [US2] Update `dashboardService.getMetrics()` to calculate counts in `dashboardService.ts`
- [x] T010 [US2] Display quick stats counts in StatCard components in `Dashboard.tsx`

**Checkpoint**: Dashboard shows actionable counts ✅

---

## Phase 4: User Story 3 - View Recent Transactions (Priority: P3)

**Goal**: Display list of 5 most recent transactions

**Independent Test**: Recent Activity section shows last 5 transactions with type, date, amount

### Implementation

- [x] T011 [US3] Add `recentTransactions` field to `DashboardMetrics` type in `types.ts`
- [x] T012 [US3] Implement `getRecentTransactions()` in `dashboardService.ts`
- [x] T013 [US3] Update Recent Activity section to display transactions in `Dashboard.tsx`
- [x] T014 [US3] Add transaction type icons and date formatting in `Dashboard.tsx`

**Checkpoint**: Recent Activity shows actual transaction history ✅

---

## Phase 5: Polish & Verification

**Purpose**: Final cleanup and verification

- [x] T015 Run `npm run build` from root to verify no build errors
- [ ] T016 Manual verification: Login → Dashboard shows real data
- [ ] T017 Test empty state: New company with no data shows appropriate message

**Checkpoint**: Feature complete and verified ✅

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - start immediately
- **Phase 2 (US1)**: Depends on Phase 1 completion
- **Phase 3 (US2)**: Can start after Phase 1, but builds on US1 UI
- **Phase 4 (US3)**: Can start after Phase 1, independent of US1/US2

### User Story Dependencies

- **US1 (P1)**: No dependencies - MVP deliverable
- **US2 (P2)**: Extends US1's DashboardMetrics type
- **US3 (P3)**: Independent - can be done in parallel with US2

### Parallel Opportunities

```text
Phase 1 (all parallel):
  T001 (types.ts) + T002 (service)

Phase 2 (sequential for Dashboard.tsx):
  T003 → T004 → T005 → T006 → T007

Phase 3 (sequential):
  T008 → T009 → T010

Phase 4 (sequential):
  T011 → T012 → T013 → T014
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: User Story 1 (T003-T007)
3. **STOP and VALIDATE**: Dashboard shows real metrics
4. Deploy if MVP is sufficient

### Full Implementation

1. Complete all phases in order
2. Each user story is independently testable
3. Total: 17 tasks across 5 phases

---

## Summary

| Phase     | Story  | Tasks  | Description             |
| --------- | ------ | ------ | ----------------------- |
| 1         | Setup  | 2      | Types + Service         |
| 2         | US1    | 5      | Business Overview (MVP) |
| 3         | US2    | 3      | Quick Stats             |
| 4         | US3    | 4      | Recent Transactions     |
| 5         | Polish | 3      | Verification            |
| **Total** |        | **17** |                         |
