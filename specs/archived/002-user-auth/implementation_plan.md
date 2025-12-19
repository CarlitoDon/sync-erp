# Implementation Plan - DRY Data Fetching

Refactor frontend pages to use a reusable hook for data fetching that reacts to Company Context changes.

## User Review Required

> [!NOTE]
> This refactoring will standardize how pages load data. It ensures that when a user switches companies, the data on the current page automatically refreshes or clears if no company is selected.

## Proposed Changes

### Frontend (`apps/web`)

#### [NEW] [useCompanyData.ts](file:///c:/Offline/Coding/sync-erp/apps/web/src/hooks/useCompanyData.ts)

- Create a custom hook `useCompanyData<T>` that:
  - Accepts a `fetcher` function and `initialData`.
  - Accesses `currentCompany` from `CompanyContext`.
  - Manages `data`, `loading`, and `error` state.
  - Automatically calls `fetcher` when `currentCompany.id` changes.
  - Clears data when `currentCompany` is null.
  - Returns `{ data, loading, error, refresh, setData }`.

#### [MODIFY] Pages

Refactor the following pages to use `useCompanyData` instead of manual `useEffect` and state management:

- [Suppliers.tsx](file:///c:/Offline/Coding/sync-erp/apps/web/src/pages/Suppliers.tsx)
- [Products.tsx](file:///c:/Offline/Coding/sync-erp/apps/web/src/pages/Products.tsx)
- [Inventory.tsx](file:///c:/Offline/Coding/sync-erp/apps/web/src/pages/Inventory.tsx)
- [SalesOrders.tsx](file:///c:/Offline/Coding/sync-erp/apps/web/src/pages/SalesOrders.tsx) (Will use a composite fetcher for Orders/Customers/Products)
- [PurchaseOrders.tsx](file:///c:/Offline/Coding/sync-erp/apps/web/src/pages/PurchaseOrders.tsx)
- [Invoices.tsx](file:///c:/Offline/Coding/sync-erp/apps/web/src/pages/Invoices.tsx)
- [Finance.tsx](file:///c:/Offline/Coding/sync-erp/apps/web/src/pages/Finance.tsx)

## Verification Plan

### Automated Tests

- Run `tsc --noEmit` to ensure type safety of the new hook and refactored pages.

### Manual Verification

1.  **Suppliers**: Verify data loads. Switch company -> Data should refresh/clear.
2.  **Products**: Verify data loads. Switch company -> Data should refresh/clear.
3.  **Sales Orders**: Verify data loads (including dropdowns). Switch company -> Data should refresh/clear.
