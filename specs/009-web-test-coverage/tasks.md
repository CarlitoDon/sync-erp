# Tasks: Improve Frontend Test Coverage

**Feature**: 009-web-test-coverage
**Branch**: `009-web-test-coverage`
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

## Strategy

- **Phase 1 (Setup)**: Configure vitest coverage and create global test setup.
- **Phase 2 (Foundational)**: Create reusable test helpers and mocks.
- **Phase 3 (Units)**: Implement unit tests for Utils, Hooks, Services, and simple Components.
- **Phase 4 (Integration)**: Implement integration tests for complex Pages.
- **Phase 5 (Gate)**: Enforce coverage threshold.
- **Strategy**: Tackle easier low-hanging fruit (utils/hooks) first to build velocity, then complex pages.

## Dependencies

- US1 (Verify Coverage) depends on all Phase 3 & 4 tasks.
- US2 (Enforce Gate) depends on US1 completion.

## Parallel Execution

- Services, Hooks, and Components tests can be written in parallel.
- Page tests should wait for Service mocks (Phase 2) but can run parallel to each other.

---

## Phase 1: Setup

The goal is to establish the test environment and coverage configuration.

- [x] T001 Configure Vitest coverage in `apps/web/vitest.config.ts` to use v8 and set excluded paths

## Phase 2: Foundational

- [x] T100 [US1] Create test setup file at `apps/web/test/setup.ts` with global mocks
- [x] T101 [US1] Create test utilities helper at `apps/web/test/utils/test-utils.tsx` (renderWithContext)
- [x] T102 [US1] Create specific mocks for services in `apps/web/test/mocks/services.mock.ts`
- [x] T103 [US1] Create specific mocks for hooks in `apps/web/test/mocks/hooks.mock.ts`

## Phase 3: Unit & Component Tests

### Hooks & Utils (Low effort, high reliability)

- [x] T200 [P] [US1] Test `useSidebarState` in `apps/web/test/hooks/useSidebarState.test.ts`
- [x] T201 [P] [US1] Test `useApiAction` in `apps/web/test/hooks/useApiAction.test.ts`
- [x] T202 [P] [US1] Test `useCompanyData` in `apps/web/test/hooks/useCompanyData.test.ts`
- [x] T203 [P] [US1] Test `format.ts` in `apps/web/test/utils/format.test.ts`

### Services (Logic/API mocking)

- [x] T300 [P] [US1] Test `authService.ts` in `apps/web/test/services/authService.test.ts`
- [x] T301 [P] [US1] Test `companyService.ts` in `apps/web/test/services/companyService.test.ts`
- [x] T302 [P] [US1] Test `billService.ts` in `apps/web/test/services/billService.test.ts`
- [x] T303 [P] [US1] Test `financeService.ts` in `apps/web/test/services/financeService.test.ts`
- [x] T304 [P] [US1] Test `invoiceService.ts` in `apps/web/test/services/invoiceService.test.ts`
- [x] T305 [P] [US1] Test `productService.ts` in `apps/web/test/services/productService.test.ts`
- [x] T306 [P] [US1] Test `purchaseOrderService.ts` in `apps/web/test/services/purchaseOrderService.test.ts`
- [x] T307 [P] [US1] Test `salesOrderService.ts` in `apps/web/test/services/salesOrderService.test.ts`
- [x] T308 [P] [US1] Test `api.ts` error handling in `apps/web/test/services/api.test.ts`

### Core Components

- [x] T400 [P] [US1] Test `ActionButton.tsx` in `apps/web/test/components/ActionButton.test.tsx`
- [x] T401 [P] [US1] Test `CompanySwitcher.tsx` in `apps/web/test/components/CompanySwitcher.test.tsx`
- [x] T402 [P] [US1] Test `ConfirmModal.tsx` in `apps/web/test/components/ConfirmModal.test.tsx`
- [x] T403 [P] [US1] Test `FinancialReport.tsx` in `apps/web/test/components/FinancialReport.test.tsx`
- [x] T404 [P] [US1] Test `Layout.tsx` in `apps/web/test/components/Layout.test.tsx`
- [x] T405 [P] [US1] Test `MobileMenuButton.tsx` in `apps/web/test/components/MobileMenuButton.test.tsx`
- [x] T406 [P] [US1] Test `ProtectedRoute.tsx` in `apps/web/test/components/ProtectedRoute.test.tsx`
- [x] T407 [P] [US1] Test `Sidebar.tsx` in `apps/web/test/components/Sidebar.test.tsx`
- [x] T408 [P] [US1] Test `SidebarItem.tsx` in `apps/web/test/components/SidebarItem.test.tsx`
- [x] T409 [P] [US1] Test `SidebarNav.tsx` in `apps/web/test/components/SidebarNav.test.tsx`
- [x] T410 [P] [US1] Test `SidebarToggle.tsx` (Enhance/Verify existing) in `apps/web/test/components/SidebarToggle.test.tsx`

## Phase 4: Page Integration Tests

Tests complex pages by mocking service layer and verifying render states.

- [x] T500 [P] [US1] Test `LoginPage.tsx` in `apps/web/test/pages/LoginPage.test.tsx`
- [x] T501 [P] [US1] Test `RegisterPage.tsx` in `apps/web/test/pages/RegisterPage.test.tsx`
- [x] T502 [P] [US1] Test `Dashboard.tsx` in `apps/web/test/pages/Dashboard.test.tsx`
- [x] T503 [P] [US1] Test `CompanySelectionPage.tsx` in `apps/web/test/pages/CompanySelectionPage.test.tsx`
- [x] T504 [P] [US1] Test `Companies.tsx` in `apps/web/test/pages/Companies.test.tsx`
- [x] T505 [P] [US1] Test `CreateCompany.tsx` in `apps/web/test/pages/CreateCompany.test.tsx`
- [x] T506 [P] [US1] Test `Customers.tsx` in `apps/web/test/pages/Customers.test.tsx`
- [x] T507 [P] [US1] Test `Finance.tsx` in `apps/web/test/pages/Finance.test.tsx`
- [x] T508 [P] [US1] Test `Inventory.tsx` in `apps/web/test/pages/Inventory.test.tsx`
- [x] T509 [P] [US1] Test `Invoices.tsx` in `apps/web/test/pages/Invoices.test.tsx`
- [x] T510 [P] [US1] Test `JournalEntries.tsx` in `apps/web/test/pages/JournalEntries.test.tsx`
- [x] T511 [P] [US1] Test `Products.tsx` in `apps/web/test/pages/Products.test.tsx`
- [x] T512 [P] [US1] Test `PurchaseOrders.tsx` in `apps/web/test/pages/PurchaseOrders.test.tsx`
- [x] T513 [P] [US1] Test `SalesOrders.tsx` in `apps/web/test/pages/SalesOrders.test.tsx`
- [x] T514 [P] [US1] Test `Suppliers.tsx` in `apps/web/test/pages/Suppliers.test.tsx`
- [x] T515 [P] [US1] Test `AccountsPayable.tsx` in `apps/web/test/pages/AccountsPayable.test.tsx`

## Phase 5: Verification & Gate

- [x] T601 [US2] Update `vitest.config.ts` to enable 80% threshold enforcement
- [x] T602 [US1] Run full coverage report and verify html output
- [ ] T603 [US1] Clean up `apps/web/test/mocks` if unused
