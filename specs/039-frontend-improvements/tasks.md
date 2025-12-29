# Tasks: Frontend Code Quality & Performance Improvements

**Input**: Design documents from `/specs/039-frontend-improvements/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Tests**: Component tests optional for this feature (focus on manual verification).

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

```
apps/web/src/
├── components/           # Shared components
│   ├── ErrorBoundary.tsx
│   └── ui/
│       ├── PromptModal.tsx
│       └── index.ts
├── app/
│   ├── AppRouter.tsx
│   └── AppProviders.tsx
└── lib/
    └── trpcProvider.tsx
```

---

## Phase 1: Setup (No Story Label)

**Purpose**: Verify existing patterns and dependencies

- [ ] T001 Verify React 18 and existing `useConfirm()` pattern in `apps/web/src/components/ui/ConfirmModal.tsx`
- [ ] T002 [P] Document current bundle size baseline using `npm run build` in `apps/web/`

---

## Phase 2: User Story 1 - Application Resilience (Priority: P1) 🎯 MVP

**Goal**: Graceful error handling to prevent blank screens

**Independent Test**: Manually trigger error in a component → see friendly error UI instead of blank screen

### Implementation for User Story 1

- [ ] T003 [US1] Create `ErrorBoundary` class component in `apps/web/src/components/ErrorBoundary.tsx`
  - Implement `getDerivedStateFromError` and `componentDidCatch`
  - Render fallback UI with error message and "Reload" button
  - Support optional `fallback` and `onError` props
  - Include minimal inline fallback if custom fallback also throws (edge case)
- [ ] T004 [US1] Add ErrorBoundary styles using Tailwind in `apps/web/src/components/ErrorBoundary.tsx`
  - Centered error card with icon, title, message, reload button
  - Match existing design system (primary-600, rounded-xl, shadow)
- [ ] T005 [US1] Integrate ErrorBoundary in `apps/web/src/app/AppProviders.tsx`
  - Wrap RouterProvider with ErrorBoundary
  - Position as outermost wrapper (catches all route errors)
- [ ] T006 [US1] Test ErrorBoundary by temporarily throwing error in Dashboard component

**Checkpoint**: User Story 1 complete - errors show friendly UI instead of blank screen

---

## Phase 3: User Story 2 - Accessible Input Dialogs (Priority: P1)

**Goal**: Replace `window.prompt()` with accessible modal

**Independent Test**: Call `usePrompt()` → see styled modal → submit returns string, cancel returns null

### Implementation for User Story 2

- [ ] T007 [US2] Create `PromptModal` component in `apps/web/src/components/ui/PromptModal.tsx`
  - Define `PromptOptions` interface (title, message, placeholder, required, multiline, maxLength)
  - Define `PromptContextType` with `prompt: (options) => Promise<string | null>`
  - Create `PromptProvider` with state management (mirror ConfirmModal pattern)
- [ ] T008 [US2] Implement modal UI in `apps/web/src/components/ui/PromptModal.tsx`
  - Input field (or textarea if multiline)
  - Submit and Cancel buttons
  - Match ConfirmModal styling (backdrop, rounded-xl, shadow-2xl)
- [ ] T009 [US2] Implement accessibility features in `apps/web/src/components/ui/PromptModal.tsx`
  - `role="dialog"` and `aria-modal="true"`
  - `aria-labelledby` pointing to title
  - Focus trap (Tab cycles within modal)
  - Escape key closes modal (returns null)
  - Auto-focus on input when modal opens
- [ ] T010 [US2] Export `usePrompt` hook in `apps/web/src/components/ui/index.ts`
- [ ] T011 [US2] Add `PromptProvider` to `apps/web/src/app/AppProviders.tsx`
  - Position inside ConfirmProvider (both modals available)
- [ ] T012 [P] [US2] Replace `window.prompt()` in `apps/web/src/features/procurement/pages/PurchaseOrderDetail.tsx`
- [ ] T013 [P] [US2] Replace `window.prompt()` in `apps/web/src/features/procurement/pages/GoodsReceiptDetail.tsx`
- [ ] T014 [P] [US2] Replace `window.prompt()` in `apps/web/src/features/sales/pages/SalesOrderDetail.tsx`
- [ ] T015 [P] [US2] Replace `window.prompt()` in `apps/web/src/features/accounting/pages/BillDetail.tsx`
- [ ] T016 [P] [US2] Replace `window.prompt()` in `apps/web/src/features/accounting/pages/InvoiceDetail.tsx`
- [ ] T017 [P] [US2] Replace `window.prompt()` in `apps/web/src/features/accounting/pages/PaymentDetail.tsx`
- [ ] T018 [US2] Verify zero `window.prompt` occurrences with grep search

**Checkpoint**: User Story 2 complete - all prompts use accessible modal

---

## Phase 4: User Story 3 - Faster Initial Load (Priority: P2)

**Goal**: Lazy load feature pages to reduce initial bundle

**Independent Test**: Build app → initial bundle <500KB → feature chunks load on navigation

### Implementation for User Story 3

- [ ] T019 [US3] Add lazy imports for procurement pages in `apps/web/src/app/AppRouter.tsx`
  - `const PurchaseOrders = lazy(() => import(...))`
  - `const PurchaseOrderDetail = lazy(() => import(...))`
  - `const Suppliers = lazy(() => import(...))`
  - `const SupplierDetail = lazy(() => import(...))`
- [ ] T020 [P] [US3] Add lazy imports for sales pages in `apps/web/src/app/AppRouter.tsx`
  - SalesOrders, SalesOrderDetail, Customers, CustomerDetail, Quotations
- [ ] T021 [P] [US3] Add lazy imports for accounting pages in `apps/web/src/app/AppRouter.tsx`
  - Invoices, InvoiceDetail, Bills, BillDetail, Payments, PaymentDetail, etc.
- [ ] T022 [P] [US3] Add lazy imports for inventory pages in `apps/web/src/app/AppRouter.tsx`
  - Products, ProductDetail, Inventory, GoodsReceipts, Shipments, etc.
- [ ] T023 [US3] Create `SuspenseWrapper` component or inline Suspense with `LoadingState` fallback
- [ ] T024 [US3] Wrap all lazy routes with Suspense in `apps/web/src/app/AppRouter.tsx`
- [ ] T025 [US3] Add error handling for chunk load failures (retry on network error)
- [ ] T026 [US3] Verify build output - compare bundle sizes before/after

**Checkpoint**: User Story 3 complete - feature pages load on-demand

---

## Phase 5: User Story 4 - Reduced Network Requests (Priority: P2)

**Goal**: Configure query caching to prevent unnecessary refetches

**Independent Test**: Navigate away and back within 30s → no loading spinner, cached data shown

### Implementation for User Story 4

- [ ] T027 [US4] Add `staleTime: 30_000` to QueryClient config in `apps/web/src/lib/trpcProvider.tsx`
- [ ] T028 [US4] Add `gcTime: 300_000` (5 min cache) to QueryClient config in `apps/web/src/lib/trpcProvider.tsx`
- [ ] T029 [US4] Document recommended overrides for time-sensitive queries in code comments

**Checkpoint**: User Story 4 complete - queries use caching, no unnecessary refetches

---

## Phase 6: User Story 5 - Consistent Component Usage (Priority: P3)

**Goal**: Replace inline spinners with shared components

**Independent Test**: Grep for inline spinner classes → count reduced by 80%+

### Implementation for User Story 5

- [ ] T030 [US5] Audit inline spinner usage with grep `animate-spin.*border-primary` in `apps/web/src/`
- [ ] T031 [P] [US5] Replace inline spinners in `apps/web/src/features/procurement/pages/*.tsx`
- [ ] T032 [P] [US5] Replace inline spinners in `apps/web/src/features/sales/pages/*.tsx`
- [ ] T033 [P] [US5] Replace inline spinners in `apps/web/src/features/accounting/pages/*.tsx`
- [ ] T034 [P] [US5] Replace inline spinners in `apps/web/src/features/inventory/pages/*.tsx`
- [ ] T035 [US5] Verify consistent LoadingState usage with grep audit

**Checkpoint**: User Story 5 complete - loading states use shared component

---

## Phase 7: Polish & Verification (No Story Label)

**Purpose**: Final verification and cleanup

- [ ] T036 Run TypeScript check: `npx tsc --noEmit` in `apps/web/`
- [ ] T037 Run build: `npm run build` in `apps/web/`
- [ ] T038 Manual verification of all user stories per quickstart.md
- [ ] T039 Update documentation if needed

---

## Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (US1: ErrorBoundary) ──┐
    │                          │
    ▼                          │ (can run in parallel after T005)
Phase 3 (US2: PromptModal) ────┤
    │                          │
    ▼                          │
Phase 4 (US3: Lazy Loading) ◄──┘
    │
    ▼
Phase 5 (US4: staleTime) ← independent, can start after Phase 1
    │
    ▼
Phase 6 (US5: Component Consistency) ← independent, can start after Phase 1
    │
    ▼
Phase 7 (Polish)
```

## Parallel Execution Examples

### Maximum Parallelism per Phase

**Phase 3 (US2)**: After T011, tasks T012-T017 can run in parallel (different files)

**Phase 4 (US3)**: After T019, tasks T020-T022 can run in parallel (different feature domains)

**Phase 6 (US5)**: After T029, tasks T030-T033 can run in parallel (different feature domains)

### Independent Phases

- **US4 (staleTime)** can start immediately after Phase 1 (independent of US1/US2/US3)
- **US5 (Component Consistency)** can start immediately after Phase 1 (independent of other stories)

---

## Implementation Strategy

### MVP Scope (Recommended First Delivery)

**Phase 2 (US1)**: ErrorBoundary only
- 4 tasks (T003-T006)
- Immediate value: prevents blank screens
- Low risk, high impact

### Incremental Delivery Order

1. **US1: ErrorBoundary** (P1, 4 tasks) - Production stability
2. **US2: PromptModal** (P1, 12 tasks) - Accessibility compliance
3. **US4: staleTime** (P2, 3 tasks) - Quick win, low effort
4. **US3: Lazy Loading** (P2, 7 tasks) - Performance improvement
5. **US5: Component Consistency** (P3, 6 tasks) - Technical debt

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | 39 |
| **Phase 1 (Setup)** | 2 tasks |
| **Phase 2 (US1: ErrorBoundary)** | 4 tasks |
| **Phase 3 (US2: PromptModal)** | 12 tasks |
| **Phase 4 (US3: Lazy Loading)** | 8 tasks |
| **Phase 5 (US4: staleTime)** | 3 tasks |
| **Phase 6 (US5: Consistency)** | 6 tasks |
| **Phase 7 (Polish)** | 4 tasks |
| **Parallelizable Tasks** | 16 tasks marked [P] |
| **MVP (US1 only)** | 6 tasks (T001-T006) |
