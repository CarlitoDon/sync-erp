# Tasks: Frontend Code Quality & Performance Improvements

**Input**: Design documents from `/specs/039-frontend-improvements/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Tests**: Component tests optional for this feature (focus on manual verification).

**Organization**: Tasks grouped by user story for independent implementation.

**Status**: ✅ **IMPLEMENTATION COMPLETE** (December 29, 2025)

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

## Phase 1: Setup (No Story Label) ✅

**Purpose**: Verify existing patterns and dependencies

- [x] T001 Verify React 18 and existing `useConfirm()` pattern in `apps/web/src/components/ui/ConfirmModal.tsx`
- [x] T002 [P] Document current bundle size baseline using `npm run build` in `apps/web/`

---

## Phase 2: User Story 1 - Application Resilience (Priority: P1) 🎯 MVP ✅

**Goal**: Graceful error handling to prevent blank screens

**Independent Test**: Manually trigger error in a component → see friendly error UI instead of blank screen

### Implementation for User Story 1

- [x] T003 [US1] Create `ErrorBoundary` class component in `apps/web/src/components/ErrorBoundary.tsx`
  - Implement `getDerivedStateFromError` and `componentDidCatch`
  - Render fallback UI with error message and "Reload" button
  - Support optional `fallback` and `onError` props
  - Include minimal inline fallback if custom fallback also throws (edge case)
- [x] T004 [US1] Add ErrorBoundary styles using Tailwind in `apps/web/src/components/ErrorBoundary.tsx`
  - Centered error card with icon, title, message, reload button
  - Match existing design system (primary-600, rounded-xl, shadow)
- [x] T005 [US1] Integrate ErrorBoundary in `apps/web/src/app/AppProviders.tsx`
  - Wrap RouterProvider with ErrorBoundary
  - Position as outermost wrapper (catches all route errors)
- [x] T006 [US1] Test ErrorBoundary by temporarily throwing error in Dashboard component

**Checkpoint**: ✅ User Story 1 complete - errors show friendly UI instead of blank screen

---

## Phase 3: User Story 2 - Accessible Input Dialogs (Priority: P1) ✅

**Goal**: Replace `window.prompt()` with accessible modal

**Independent Test**: Call `usePrompt()` → see styled modal → submit returns string, cancel returns null

### Implementation for User Story 2

- [x] T007 [US2] Create `PromptModal` component in `apps/web/src/components/ui/PromptModal.tsx`
  - Define `PromptOptions` interface (title, message, placeholder, required, multiline, maxLength)
  - Define `PromptContextType` with `prompt: (options) => Promise<string | null>`
  - Create `PromptProvider` with state management (mirror ConfirmModal pattern)
- [x] T008 [US2] Implement modal UI in `apps/web/src/components/ui/PromptModal.tsx`
  - Input field (or textarea if multiline)
  - Submit and Cancel buttons
  - Match ConfirmModal styling (backdrop, rounded-xl, shadow-2xl)
- [x] T009 [US2] Implement accessibility features in `apps/web/src/components/ui/PromptModal.tsx`
  - `role="dialog"` and `aria-modal="true"`
  - `aria-labelledby` pointing to title
  - Focus trap (Tab cycles within modal)
  - Escape key closes modal (returns null)
  - Auto-focus on input when modal opens
- [x] T010 [US2] Export `usePrompt` hook in `apps/web/src/components/ui/index.ts`
- [x] T011 [US2] Add `PromptProvider` to `apps/web/src/app/AppProviders.tsx`
  - Position inside ConfirmProvider (both modals available)
- [x] T012 [P] [US2] Replace `window.prompt()` in `apps/web/src/features/inventory/pages/ShipmentDetail.tsx`
- [x] T013 [P] [US2] Replace `window.prompt()` in `apps/web/src/features/inventory/pages/GoodsReceiptDetail.tsx`
- [x] T014 [P] [US2] Replace `window.prompt()` in `apps/web/src/features/accounting/pages/InvoiceDetail.tsx`
- [x] T015 [P] [US2] Replace `window.prompt()` in `apps/web/src/features/accounting/components/BillDetail.tsx`
- [x] T016 [P] [US2] Replace `window.prompt()` in `apps/web/src/features/accounting/pages/PaymentDetail.tsx`
- [x] T017 [P] [US2] Replace `window.prompt()` in `apps/web/src/features/accounting/components/DocumentList.tsx`
- [x] T018 [P] [US2] Replace `window.prompt()` in `apps/web/src/features/accounting/components/PaymentHistoryList.tsx`
- [x] T019 [P] [US2] Update `apps/web/src/features/accounting/hooks/useBill.ts` - make reason required
- [x] T020 [P] [US2] Update `apps/web/src/features/accounting/hooks/useInvoice.ts` - make reason required
- [x] T021 [US2] Verify zero `window.prompt` occurrences with grep search

**Checkpoint**: ✅ User Story 2 complete - all prompts use accessible modal (9 files updated)

---

## Phase 4: User Story 3 - Faster Initial Load (Priority: P2) ✅

**Goal**: Lazy load feature pages to reduce initial bundle

**Independent Test**: Build app → initial bundle <500KB → feature chunks load on navigation

### Implementation for User Story 3

- [x] T022 [US3] Add lazy imports for procurement pages in `apps/web/src/app/AppRouter.tsx`
  - `const PurchaseOrders = lazy(() => import(...))`
  - `const PurchaseOrderDetail = lazy(() => import(...))`
  - `const Suppliers = lazy(() => import(...))`
  - `const SupplierDetail = lazy(() => import(...))`
- [x] T023 [P] [US3] Add lazy imports for sales pages in `apps/web/src/app/AppRouter.tsx`
  - SalesOrders, SalesOrderDetail, Customers, CustomerDetail, Quotations
- [x] T024 [P] [US3] Add lazy imports for accounting pages in `apps/web/src/app/AppRouter.tsx`
  - Invoices, InvoiceDetail, Bills, BillDetail, Payments, PaymentDetail, etc.
- [x] T025 [P] [US3] Add lazy imports for inventory pages in `apps/web/src/app/AppRouter.tsx`
  - Products, ProductDetail, Inventory, GoodsReceipts, Shipments, etc.
- [x] T026 [US3] Create `LazyRoute` wrapper component with Suspense + `LoadingState` fallback
- [x] T027 [US3] Wrap all lazy routes with LazyRoute in `apps/web/src/app/AppRouter.tsx`
- [x] T028 [US3] Verify build output - compare bundle sizes before/after
  - ✅ Build successful, feature chunks generated (e.g., `Suppliers-C1iir9lu.js`)

**Checkpoint**: ✅ User Story 3 complete - 30+ feature pages load on-demand

---

## Phase 5: User Story 4 - Reduced Network Requests (Priority: P2) ✅

**Goal**: Configure query caching to prevent unnecessary refetches

**Independent Test**: Navigate away and back within 30s → no loading spinner, cached data shown

### Implementation for User Story 4

- [x] T029 [US4] Add `staleTime: 30_000` to QueryClient config in `apps/web/src/lib/trpcProvider.tsx`
- [x] T030 [US4] Add `gcTime: 300_000` (5 min cache) to QueryClient config in `apps/web/src/lib/trpcProvider.tsx`
- [x] T031 [US4] Document recommended overrides for time-sensitive queries in code comments

**Checkpoint**: ✅ User Story 4 complete - queries use caching, no unnecessary refetches

---

## Phase 6: User Story 5 - Consistent Component Usage (Priority: P3) ✅

**Goal**: Replace inline spinners with shared components

**Independent Test**: Grep for inline spinner classes → count reduced by 80%+

### Implementation for User Story 5

- [x] T032 [US5] Audit inline spinner usage with grep `animate-spin.*border-primary` in `apps/web/src/`
  - Found 15 inline spinners across inventory, procurement, sales, accounting
- [x] T033 [P] [US5] Replace inline spinners in `apps/web/src/features/procurement/**/*.tsx`
  - Suppliers.tsx, SupplierDetail.tsx, PurchaseOrderList.tsx
- [x] T034 [P] [US5] Replace inline spinners in `apps/web/src/features/sales/**/*.tsx`
  - Customers.tsx, CustomerDetail.tsx, SalesOrderList.tsx
- [x] T035 [P] [US5] Replace inline spinners in `apps/web/src/features/accounting/**/*.tsx`
  - JournalDetail.tsx, Payments.tsx
- [x] T036 [P] [US5] Replace inline spinners in `apps/web/src/features/inventory/**/*.tsx`
  - Products.tsx, ProductDetail.tsx, Inventory.tsx, GoodsReceipts.tsx, Shipments.tsx, ShipmentDetail.tsx
- [x] T037 [US5] Verify consistent LoadingState usage with grep audit
  - ✅ Only `LoadingSpinner.tsx` contains `animate-spin` (the shared component)

**Checkpoint**: ✅ User Story 5 complete - 15 inline spinners replaced with LoadingState

---

## Phase 7: Polish & Verification (No Story Label) ✅

**Purpose**: Final verification and cleanup

- [x] T038 Run TypeScript check: `npx tsc --noEmit` in `apps/web/`
  - ✅ No errors in web app (pre-existing API errors unrelated)
- [x] T039 Run build: `npm run build` in `apps/web/`
  - ✅ Build successful in 1.31s
- [x] T040 Manual verification of all user stories per quickstart.md
- [x] T041 Update documentation if needed

---

## Dependencies

```
Phase 1 (Setup) ✅
    │
    ▼
Phase 2 (US1: ErrorBoundary) ✅ ──┐
    │                             │
    ▼                             │ (can run in parallel after T005)
Phase 3 (US2: PromptModal) ✅ ────┤
    │                             │
    ▼                             │
Phase 4 (US3: Lazy Loading) ✅ ◄──┘
    │
    ▼
Phase 5 (US4: staleTime) ✅ ← independent, can start after Phase 1
    │
    ▼
Phase 6 (US5: Component Consistency) ✅ ← independent, can start after Phase 1
    │
    ▼
Phase 7 (Polish) ✅
```

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | 41 |
| **Phase 1 (Setup)** | 2 tasks ✅ |
| **Phase 2 (US1: ErrorBoundary)** | 4 tasks ✅ |
| **Phase 3 (US2: PromptModal)** | 15 tasks ✅ |
| **Phase 4 (US3: Lazy Loading)** | 7 tasks ✅ |
| **Phase 5 (US4: staleTime)** | 3 tasks ✅ |
| **Phase 6 (US5: Consistency)** | 6 tasks ✅ |
| **Phase 7 (Polish)** | 4 tasks ✅ |
| **Files Created** | 2 (ErrorBoundary.tsx, PromptModal.tsx) |
| **Files Modified** | 26 |
| **window.prompt calls removed** | 9 |
| **Inline spinners replaced** | 15 |
