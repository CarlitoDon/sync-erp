---
description: 'Complete Finance & Accounting Module Implementation'
---

# Tasks: Complete Finance Module

**Input**: Design documents from `/specs/005-finance-accounting/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.yaml

**Tests**: Not explicitly requested in spec, but good practice.
**Organization**: Tasks grouped by User Story (P1, P2, P3).

## Phase 1: Setup

**Purpose**: Project initialization and types setup

- [x] T001 Create `packages/shared/src/types/finance.ts` for Journal/Report DTOs
- [x] T002 [P] Update `packages/shared/src/index.ts` to export new types

---

## Phase 2: Foundational (Blocking)

**Purpose**: Core backend logic required for all stories

- [x] T003 Create `apps/api/src/services/journalService.ts` template
- [x] T004 [P] Ensure `Account` model seeding in `financeService.ts` is robust (idempotent)

---

## Phase N-1: UI Components & Patterns (Constitution Compliance)

**Purpose**: Ensure frontend consistency with new principles

- [x] T005 [P] Verify `ActionButton` and `ConfirmModal` availability in `apps/web/src/components/` (Already exists)
- [x] T006 [P] Create `FinancialReport.tsx` component in `apps/web/src/components/` (Reusable for P&L/Balance Sheet)

---

## Phase 3: User Story 1 - Manual Journal Entries (Priority: P1) 🎯 MVP

**Goal**: Accountants can manually record balanced journal entries for adjustments.

**Independent Test**: Create journal entry -> Verify in Trial Balance.

### Implementation

- [x] T007 [P] [US1] Implement `create` method in `apps/api/src/services/journalService.ts` (Validates debit=credit)
- [x] T008 [US1] Create POST `/api/journals` endpoint in `apps/api/src/routes/journals.ts`
- [x] T009 [P] [US1] Add `createJournal` to `apps/web/src/services/journalService.ts`
- [x] T010 [US1] Create `JournalEntries.tsx` page in `apps/web/src/pages/` (List view)
- [x] T011 [US1] Implement "New Journal Entry" modal/form with dynamic lines in `JournalEntries.tsx`
- [x] T012 [US1] Integrate `useConfirm` for deleting journals (if needed) and `apiAction` for submit

---

## Phase 4: User Story 2 & 3 - AP & AR Management (Priority: P2)

**Goal**: Manage Bills (AP) and Invoices (AR) payments.

**Independent Test**: Record payment against invoice -> Balance updates -> Status becomes PAID.

### Implementation for AP (User Story 2)

- [x] T013 [P] [US2] Create `AccountsPayable.tsx` page in `apps/web/src/pages/`
- [x] T014 [US2] Implement filter tabs (Draft, Posted, Paid) using `DataTable` pattern (if avail) or table
- [x] T015 [US2] Implement "Record Payment" modal using `apiAction` calling existing payment service

### Implementation for AR (User Story 3)

- [x] T016 [P] [US3] Create `AccountsReceivable.tsx` page in `apps/web/src/pages/` (Alias Invoices)
- [x] T017 [US3] Implement overdue highlighting logic (Constitution: No copy-paste style, use utility if pervasive)
- [x] T018 [US3] Connect "Record Payment" action for customers

---

## Phase 5: User Story 4 - Financial Reports (Priority: P3)

**Goal**: Generate P&L and Balance Sheet.

**Independent Test**: Generate reports -> Verify totals match journal entries.

### Implementation

- [x] T019 [P] [US4] Implement `getBalanceSheet` in `apps/api/src/services/financeService.ts` (Aggregation logic in Frontend/Service)
- [x] T020 [P] [US4] Implement `getIncomeStatement` in `apps/api/src/services/financeService.ts` (Aggregation logic in Frontend/Service)
- [x] T021 [US4] Add report endpoints to `apps/api/src/routes/finance.ts`
- [x] T022 [US4] Update `Finance.tsx` to use `FinancialReport` component for displaying data
- [x] T023 [US4] Add Date Range picker to `Finance.tsx` and pass params to API

---

## Phase 6: User Story 5 - Auto Journal Posting (Priority: P3)

**Goal**: Automate double-entry book keeping.

**Independent Test**: Post Invoice -> Verify Journal Entry created automatically.

### Implementation

- [x] T024 [P] [US5] Implement `autoPostInvoice` logic in `journalService.ts` (Transaction: Update Status + Create Journal)
- [x] T025 [P] [US5] Implement `autoPostPayment` logic in `journalService.ts` (Transaction: Create Payment + Create Journal)
- [x] T026 [US5] Refactor `invoiceService.ts` to call `journalService.autoPostInvoice` instead of simple update
- [x] T027 [US5] Refactor `paymentService.ts` to call `journalService.autoPostPayment`

---

## Phase 7: Polish & Constitution Verification

**Purpose**: Ensure quality and compliance

- [x] T028 Update `apps/web/src/App.tsx` routes for new pages
- [x] T029 Add Navigation links to Sidebar
- [ ] T030 **Constitution Check**: Grep for `window.confirm`, inline button styles, direct toast imports in new files
- [ ] T031 Run `quickstart.md` validation manual test steps

## Dependencies

- **Setup** blocks everything
- **US1 (Journals)** blocks US4 (Reports) - Reports need data
- **US2/3 (AP/AR)** dependent on existing Invoice/Payment modules
- **US5 (Auto-posting)** enhances US2/3 but can be done last (manual entries work meanwhile)
