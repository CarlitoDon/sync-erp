# API Contracts: E2E Business Flows

## Shared Header Standards

All state-changing operations SHOULD include these headers:

- `X-Company-Id`: (Required) UUID for multi-tenant isolation.
- `X-Correlation-Id`: (Recommended) UUID for cross-log traceability.

---

## 1. Accounting: Invoice Posting

**Endpoint**: `POST /api/accounting/invoices/:id/post`

### Request Body

```json
{
  "businessDate": "2025-12-18"
}
```

### Constraints

- Invoice MUST be in `DRAFT` state.
- Order MUST be `CONFIRMED` or `COMPLETED`.
- Sufficient stock MUST be available (for Sales Invoices).

---

## 2. Accounting: Payment Receipt

**Endpoint**: `POST /api/accounting/payments`

### Request Body

```json
{
  "invoiceId": "uuid",
  "amount": 1500.0,
  "method": "CASH",
  "businessDate": "2025-12-18",
  "memo": "Ref: INV-001"
}
```

### Constraints

- Invoice MUST be in `POSTED` state.
- Amount MUST be <= Invoice balance.
- Idempotency enforced via `(companyId, PAYMENT_CREATE, invoiceId)`.

---

## 3. Inventory: Goods Receipt

**Endpoint**: `POST /api/inventory/receive`

### Request Body

```json
{
  "orderId": "uuid",
  "reference": "GRN-001",
  "notes": "Quality check passed",
  "businessDate": "2025-12-18"
}
```

### Constraints

- Order MUST be a `PURCHASE` order in `CONFIRMED` state.
- Increases `product.stockQty` and creates `InventoryMovement`.
- Sets PO status to `RECEIVED`.
