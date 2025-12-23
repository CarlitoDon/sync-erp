# API Contracts: Phase 1 Frontend Operational UI

**Feature**: 031-phase1-frontend-ops  
**Date**: 2025-12-17

## Overview

This document defines the API endpoints consumed by the frontend screens. Most endpoints already exist - only Dashboard KPIs and Admin endpoints are new.

---

## Existing Endpoints (No Changes)

### Invoice Endpoints

| Method | Endpoint                     | Purpose                                |
| ------ | ---------------------------- | -------------------------------------- |
| GET    | `/api/invoices`              | List invoices (supports status filter) |
| GET    | `/api/invoices/:id`          | Get invoice detail with lines          |
| GET    | `/api/invoices/:id/payments` | Get payment history                    |
| POST   | `/api/invoices/:id/payments` | Record payment                         |
| POST   | `/api/invoices/:id/post`     | Post invoice                           |
| POST   | `/api/invoices/:id/void`     | Void invoice                           |

### Purchase Order Endpoints

| Method | Endpoint                           | Purpose                           |
| ------ | ---------------------------------- | --------------------------------- |
| GET    | `/api/purchase-orders`             | List POs (supports status filter) |
| GET    | `/api/purchase-orders/:id`         | Get PO detail with lines          |
| POST   | `/api/purchase-orders/:id/confirm` | Confirm PO                        |
| POST   | `/api/purchase-orders/:id/receive` | Record goods receipt              |
| POST   | `/api/purchase-orders/:id/cancel`  | Cancel PO                         |

---

## New Endpoints

### 1. Dashboard KPIs

```
GET /api/dashboard/kpis
```

**Request Headers**:

```
Authorization: Bearer {token}
X-Company-Id: {companyId}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "totalSales": 15000000,
    "outstandingAR": 5000000,
    "outstandingAP": 3000000,
    "inventoryValue": 25000000,
    "currency": "IDR"
  }
}
```

**Implementation Notes**:

- `totalSales`: SUM(Invoice.amount) WHERE status IN (POSTED, PAID)
- `outstandingAR`: SUM(Invoice.balance) WHERE status = POSTED AND balance > 0
- `outstandingAP`: SUM(Bill.balance) WHERE status = POSTED AND balance > 0
- `inventoryValue`: SUM(InventoryItem.quantity × Product.costPrice)

---

### 2. Admin: Saga Failures

```
GET /api/admin/saga-logs
```

**Request Headers**:

```
Authorization: Bearer {token}
X-Company-Id: {companyId}
```

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| step | string | No | Filter by step (FAILED, COMPENSATED, COMPENSATION_FAILED) |
| limit | number | No | Default: 50 |
| offset | number | No | Default: 0 |

**Response** (200 OK):

```json
{
  "success": true,
  "data": [
    {
      "id": "saga-123",
      "sagaType": "INVOICE_POST",
      "entityId": "inv-456",
      "step": "FAILED",
      "error": "Journal entry already exists",
      "createdAt": "2025-12-17T10:00:00Z",
      "updatedAt": "2025-12-17T10:00:05Z"
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 50,
    "offset": 0
  }
}
```

**Authorization**: Requires ADMIN role

---

### 3. Admin: Journal Orphans

```
GET /api/admin/journals/orphans
```

**Request Headers**:

```
Authorization: Bearer {token}
X-Company-Id: {companyId}
```

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| limit | number | No | Default: 50 |
| offset | number | No | Default: 0 |

**Response** (200 OK):

```json
{
  "success": true,
  "data": [
    {
      "id": "jnl-789",
      "entryDate": "2025-12-15",
      "sourceType": null,
      "sourceId": null,
      "memo": "Manual adjustment",
      "totalDebit": 1000000,
      "totalCredit": 1000000
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 50,
    "offset": 0
  }
}
```

**Query Logic**:

```sql
SELECT * FROM journal_entries
WHERE source_type IS NULL
   OR source_id IS NULL
   OR source_id = 'unknown source'
```

**Authorization**: Requires ADMIN role

---

## Request/Response Patterns

### Payment Input Schema

```typescript
// packages/shared/src/validators/payment.validator.ts
export const RecordPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD']),
  businessDate: z.coerce.date(), // G5 Compliance
  reference: z.string().optional(),
});

export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
```

### GRN Input Schema

```typescript
// packages/shared/src/validators/grn.validator.ts
export const GoodsReceiptSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive(),
        warehouseId: z.string().uuid(),
      })
    )
    .min(1, 'At least one item required'),
  businessDate: z.coerce.date(), // G5 Compliance
  notes: z.string().optional(),
});

export type GoodsReceiptInput = z.infer<typeof GoodsReceiptSchema>;
```

---

## Error Responses

All endpoints follow standard error format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "DOMAIN_ERROR_CODE"
}
```

### Common Error Codes

| Code                    | HTTP Status | Description                          |
| ----------------------- | ----------- | ------------------------------------ |
| INVOICE_NOT_FOUND       | 404         | Invoice ID does not exist            |
| INVOICE_INVALID_STATE   | 400         | Action not allowed in current status |
| PAYMENT_EXCEEDS_BALANCE | 400         | Amount > invoice.balance             |
| PO_NOT_FOUND            | 404         | PO ID does not exist                 |
| INSUFFICIENT_STOCK      | 400         | Stock validation failed              |
| UNAUTHORIZED            | 401         | Missing or invalid token             |
| FORBIDDEN               | 403         | Missing required role                |
