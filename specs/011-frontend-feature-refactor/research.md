# Research: Frontend Feature Refactor

## Objectives

1. Identify all "Domain" logic currently in `src/pages`, `src/services`, and `src/components`.
2. Map existing files to new `src/features/[domain]` locations.
3. Identify test files in `apps/web/test` that need updates.
4. Verify Vite alias configuration.

## Findings

### 1. Source Structure Analysis

- **Pages**: `AccountsPayable`, `Companies`, `CompanySelectionPage`, `CreateCompany`, `Customers`, `Dashboard`, `Finance`, `Inventory`, `Invoices`, `JournalEntries`, `LoginPage`, `Products`, `PurchaseOrders`, `RegisterPage`, `SalesOrders`, `Suppliers`.
- **Services**: `api.ts`, `authService`, `billService`, `companyService`, `financeService`, `invoiceService`, `partnerService`, `productService`, `purchaseOrderService`, `salesOrderService`.
- **Components**: `FinancialReport`, `Layout` family, `CompanySwitcher`, `ActionButton`, `ConfirmModal`, `ProtectedRoute`.

### 2. Test Structure Analysis

- **Tests**: Perfectly mirror source structure (`test/pages`, `test/services` assumed).

## Decisions

- **Folder Mapping**:
  - **auth**: `LoginPage`, `RegisterPage`, `authService`, `ProtectedRoute`
  - **finance**: `Finance`, `FinancialReport`, `JournalEntries`, `AccountsPayable`, `Invoices`, `financeService`, `billService`, `invoiceService`
  - **sales**: `SalesOrders`, `salesOrderService` (Customers?) -> `sales` or `partners`?
    - Decision: `Customers` -> `sales` context. `partnerService` -> `partners`.
  - **procurement**: `PurchaseOrders`, `Suppliers`, `purchaseOrderService`
  - **inventory**: `Inventory`, `Products`, `productService`
  - **company**: `Companies`, `CompanySelectionPage`, `CreateCompany`, `CompanySwitcher` (Layout?), `companyService`.
    - Note: `CompanySwitcher` is structural but domain aware. Spec says `components/layout`. I will adhere to spec for `CompanySwitcher`.
  - **partners**: `partnerService` (and potentially `Customers`/`Suppliers` shared logic if any).
  - **dashboard**: `Dashboard`

- **Test Strategy**: Mirror the new structure in `apps/web/test/features/...`.
