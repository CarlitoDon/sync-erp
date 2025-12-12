---
description: 'Refactor frontend to Feature-Based Architecture'
---

# Tasks: Refactor Frontend to Feature-Based Architecture

**Input**: Design documents from `/specs/011-frontend-feature-refactor/`
**Prerequisites**: plan.md (required), spec.md (required), research.md

**Tests**: **CRITICAL** (FR-008): All test files in `apps/web/test/` MUST be updated to match the new paths and imports so tests do not break.

**Organization**: Tasks are grouped by User Story (US) and then by Domain to enable parallel execution.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: [US1] (Structure), [US2] (Migration)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the new directory structure.

- [x] T001 Create `src/features` directories: auth, finance, sales, procurement, inventory, company, partners, shared, dashboard
- [x] T002 Create `src/components` subdirectories: `ui`, `layout`

## Phase 2: Foundational (Generic Components & Shared)

**Purpose**: Establish the UI layer and shared utilities before migrating complex domains.

- [x] T003 [P] [US1] Move UI Atoms (`ActionButton`, `ConfirmModal`) to `src/components/ui/`
- [x] T004 [P] [US1] Move Layouts (`Sidebar`_, `Layout`, `CompanySwitcher`_, `MobileMenuButton`) to `src/components/layout/`
- [x] T005 [P] [US1] Update imports for moved UI/Layout components across the app
- [x] T006 [P] [US1] Update imports for moved UI/Layout components across the app

## Phase 3: User Story 2 - Auth Domain (Priority: P1)

**Goal**: Migrate Authentication logic to Feature folder.

- [x] T007 [US2] Move `authService.ts` to `src/features/auth/services/`
- [x] T008 [US2] Move `LoginPage.tsx`, `RegisterPage.tsx` to `src/features/auth/components/` (or `pages/`)
- [x] T009 [US2] Move `ProtectedRoute.tsx` to `src/features/auth/components/`
- [x] T010 [US2] Update `LoginPage.test.tsx`, `RegisterPage.test.tsx` imports and move to `apps/web/test/features/auth/`

## Phase 4: User Story 2 - Finance Domain (Priority: P1)

**Goal**: Migrate Finance domain logic.

- [x] T011 [P] [US2] Move Services: `financeService.ts`, `billService.ts`, `invoiceService.ts` to `src/features/finance/services/`
- [x] T012 [P] [US2] Move Components: `FinancialReport.tsx` to `src/features/finance/components/`
- [x] T013 [P] [US2] Move Pages: `Finance.tsx`, `JournalEntries.tsx`, `AccountsPayable.tsx`, `Invoices.tsx` to `src/features/finance/pages/`
- [x] T014 [P] [US2] Update Finance tests: `Finance.test.tsx`, `JournalEntries.test.tsx`, etc., and move to `apps/web/test/features/finance/`

## Phase 5: User Story 2 - Sales & Partners Domains (Priority: P1)

**Goal**: Migrate Sales and Partners logic.

- [x] T015 [P] [US2] Move `salesOrderService.ts` to `src/features/sales/services/`
- [x] T016 [P] [US2] Move `SalesOrders.tsx` to `src/features/sales/pages/`
- [x] T017 [P] [US2] Move `Customers.tsx` to `src/features/sales/pages/` (Decision: Sales context)
- [x] T018 [P] [US2] Move `partnerService.ts` to `src/features/partners/services/`
- [x] T019 [P] [US2] Move `Suppliers.tsx` to `src/features/procurement/pages/` (Decision: Procurement context, verify imports)
- [x] T020 [P] [US2] Update Sales/Partner tests and move to `apps/web/test/features/[domain]/`

## Phase 6: User Story 2 - Procurement & Inventory Domains (Priority: P1)

**Goal**: Migrate Procurement and Inventory logic.

- [x] T021 [P] [US2] Move `purchaseOrderService.ts` to `src/features/procurement/services/`
- [x] T022 [P] [US2] Move `PurchaseOrders.tsx` to `src/features/procurement/pages/`
- [x] T023 [P] [US2] Move `productService.ts` to `src/features/inventory/services/`
- [x] T024 [P] [US2] Move `Inventory.tsx`, `Products.tsx` to `src/features/inventory/pages/`
- [x] T025 [P] [US2] Update Procurement/Inventory tests and move to `apps/web/test/features/[domain]/`

## Phase 7: User Story 2 - Company & Dashboard Domains (Priority: P1)

**Goal**: Migrate Company and Dashboard logic.

- [x] T026 [P] [US2] Move `companyService.ts` to `src/features/company/services/`
- [x] T027 [P] [US2] Move `Companies.tsx`, `CompanySelectionPage.tsx`, `CreateCompany.tsx` to `src/features/company/pages/`
- [x] T028 [P] [US2] Move `Dashboard.tsx` to `src/features/dashboard/pages/`
- [x] T029 [P] [US2] Update Company/Dashboard tests and move to `apps/web/test/features/[domain]/`

## Phase 8: Polish & Routing (Cross-Cutting)

**Goal**: Finalize routing, verify build, and cleanup.

- [x] T030 Update `src/App.tsx` (or new `routes.tsx`) to import pages from their new Feature locations
- [x] T030a Extract Providers to `src/app/AppProviders.tsx`
- [x] T030b Extract Routing to `src/app/AppRouter.tsx`
- [x] T030c Simplify `src/App.tsx` import
- [x] T031 Perform global search for old import paths (e.g., `../services/`) and fix any remaining broken references
- [x] T032 Verify `vite.config.ts` aliases work with new structure
- [x] T033 Run full build `npm run build` and ensure no type errors
- [x] T034 Run all tests `npm test` and ensure zero regression

## Dependencies

- Phase 2 (Foundational) blocks all subsequent phases.
- Phases 3, 4, 5, 6, 7 can technically run in parallel, but sequential execution per domain is safer to minimize import hell.
- Phase 8 blocks completion.
