# Phase 1: API Contracts

Menjaga frontend **bodoh dan patuh**.

Jika frontend perlu "nebak", kontrak belum cukup jelas.

---

## Invoice Endpoints

### POST /invoices

**Headers**:

- `X-Company-Id` (required)
- `Authorization` (required)

**Body**:

```json
{
  "salesOrderId": "uuid",
  "partnerId": "uuid",
  "items": [{ "productId": "uuid", "quantity": 1, "unitPrice": 100 }]
}
```

**Behavior**:

- Creates DRAFT invoice

**Errors**:

- `404` PARTNER_NOT_FOUND
- `404` PRODUCT_NOT_FOUND
- `422` INVALID_ITEMS

---

### POST /invoices/:id/post

**Headers**:

- `X-Company-Id` (required)
- `Idempotency-Key` (required)

**Behavior**:

- Atomic posting via Saga
- Idempotent by invoiceId

**Errors**:

- `404` INVOICE_NOT_FOUND
- `409` ALREADY_POSTED
- `422` INVALID_STATE (not DRAFT)
- `422` INSUFFICIENT_STOCK
- `500` SAGA_FAILED (with compensation)

---

## Bill Endpoints

### POST /bills

**Headers**:

- `X-Company-Id` (required)
- `Authorization` (required)

**Body**:

```json
{
  "purchaseOrderId": "uuid",
  "partnerId": "uuid",
  "items": [{ "productId": "uuid", "quantity": 1, "unitPrice": 100 }]
}
```

**Behavior**:

- Creates DRAFT bill

**Errors**:

- `404` PARTNER_NOT_FOUND
- `404` PRODUCT_NOT_FOUND
- `422` INVALID_ITEMS

---

### POST /bills/:id/post

**Headers**:

- `X-Company-Id` (required)
- `Idempotency-Key` (required)

**Behavior**:

- Atomic posting via Saga
- Idempotent by billId

**Errors**:

- `404` BILL_NOT_FOUND
- `409` ALREADY_POSTED
- `422` INVALID_STATE
- `500` SAGA_FAILED

---

## Payment Endpoints

### POST /payments

**Headers**:

- `X-Company-Id` (required)
- `Idempotency-Key` (required)

**Body**:

```json
{
  "invoiceId": "uuid",
  "amount": 100,
  "method": "CASH|BANK_TRANSFER|CHECK"
}
```

**Behavior**:

- Atomic per invoice
- Idempotent per invoiceId + paymentId

**Errors**:

- `404` INVOICE_NOT_FOUND
- `409` OVERPAYMENT
- `422` INVALID_STATE (invoice not POSTED)
- `422` INVALID_AMOUNT

---

### POST /bill-payments

**Headers**:

- `X-Company-Id` (required)
- `Idempotency-Key` (required)

**Body**:

```json
{
  "billId": "uuid",
  "amount": 100,
  "method": "CASH|BANK_TRANSFER|CHECK"
}
```

**Behavior**:

- Atomic per bill
- Idempotent per billId + paymentId

**Errors**:

- `404` BILL_NOT_FOUND
- `409` OVERPAYMENT
- `422` INVALID_STATE
- `422` INVALID_AMOUNT

---

## Stock Endpoints

### POST /stock/adjustments

**Headers**:

- `X-Company-Id` (required)
- `Idempotency-Key` (required)

**Body**:

```json
{
  "productId": "uuid",
  "warehouseId": "uuid",
  "quantity": 10,
  "reason": "Inventory count correction"
}
```

**Behavior**:

- Creates stock movement
- Idempotent by adjustmentId

**Errors**:

- `404` PRODUCT_NOT_FOUND
- `404` WAREHOUSE_NOT_FOUND
- `422` INSUFFICIENT_STOCK (if negative not allowed)

---

## Common Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "OVERPAYMENT",
    "message": "Payment exceeds remaining balance",
    "details": { "remaining": 50, "attempted": 100 }
  }
}
```

---

_Document required before Phase 1 work proceeds._
