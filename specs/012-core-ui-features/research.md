# Phase 0: Research Findings

## Decisions

1.  **API Contracts**:
    - **Inventory**: Use existing `GoodsReceiptSchema` and `StockAdjustmentSchema` from `@sync-erp/shared`.
    - **Payments**: Use `CreatePaymentSchema` ({ invoiceId, amount, method }) and `GET /invoice/:id` endpoint.
    - **Users**: Use `InviteUserSchema` and `AssignUserSchema`. Note: `assign` endpoint requires `userId` in body even though present in URL params.
2.  **UI Patterns**: Replicate existing Modal pattern (using `Dialog` from shadcn) and Table pattern (using `StandardTable` if applicable, or simple `Table` for history).

## Alternatives Considered

- **Payment History**: Fetching payments with the Invoice (nested include) vs Separate Endpoint.
  - _Decision_: Separate Endpoint (`/api/payments/invoice/:id`) exists and is cleaner for lazy loading or reducing initial payload size.
- **Team Management**: Merging with Company Settings vs Separate Page.
  - _Decision_: Separate "Team Management" page for clarity, as requested by prompt "Halaman Team atau Users".
