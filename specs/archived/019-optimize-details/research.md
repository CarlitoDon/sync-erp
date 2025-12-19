# Research: Enhanced Detail Pages

## Technical Context Analysis

### API Readiness

- **Partner API**: `getById` exists. History (Orders/Invoices) should be fetched via existing `list` endpoints filtered by `partnerId` to support pagination.
- **Product API**: `getById` exists. Stock history (`InventoryMovement`) should be fetched via `inventoryService.list({ productId })`.
- **Journal API**: `AccountingController` needs verification for `getById` (Journal Entry with Lines).

### Frontend Architecture

- **Routing**: Routes are likely defined in `apps/web/src/routes.tsx` or `App.tsx`.
- **Component Reuse**: To show "Recent Orders" on Customer Detail, we should reuse the existing `OrderList` logic but adapted as a component (e.g., `<SalesOrderTable query={{ partnerId }} />`).
- **Refactoring**: Current `SalesOrders.tsx` likely couples "Page" and "Table". We must extract the Table to a reusable component.

## Decisions

- **Decision 1**: Fetch History via separate API calls (Filtered Lists), not `include`.
  - **Rationale**: Avoids huge payloads. Allows pagination. Reuses existing `list` caching and logic.
- **Decision 2**: Extract `feature/list/Table` components.
  - **Rationale**: DRY Principle. `CustomerDetail` needs to show a table of Sales Orders. We shouldn't duplicate the table code.

## Unknowns Resolved

- `PartnerController.getById` ✅
- `ProductController.getById` ✅
- Routing location: `App.tsx` or similar (Verified `apps/web/src/App.tsx`).
