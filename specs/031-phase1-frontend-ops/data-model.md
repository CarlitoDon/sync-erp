# Data Model: Phase 1 Frontend Operational UI

**Feature**: 031-phase1-frontend-ops  
**Date**: 2025-12-17

## Overview

This document describes the data entities and their relationships relevant to the frontend screens. All data is read from backend APIs - frontend does not maintain business state.

---

## Entities

### 1. DashboardKPIs

**Source**: Aggregated from Invoice, Bill, InventoryItem tables  
**Endpoint**: `GET /api/dashboard/kpis`

| Field          | Type   | Description                       |
| -------------- | ------ | --------------------------------- |
| totalSales     | number | Sum of all posted invoice amounts |
| outstandingAR  | number | Sum of invoice balances > 0       |
| outstandingAP  | number | Sum of bill balances > 0          |
| inventoryValue | number | Sum of (stock qty × unit cost)    |

**Frontend Representation**: Read-only stat cards

---

### 2. Invoice (Existing)

**Source**: `Invoice` table via `/api/invoices`

| Field         | Type          | UI Usage                    |
| ------------- | ------------- | --------------------------- |
| id            | string (UUID) | Row key                     |
| invoiceNumber | string        | Display                     |
| customerId    | string        | → Customer.name lookup      |
| amount        | number        | Display formatted           |
| balance       | number        | Display, Payment validation |
| status        | InvoiceStatus | Button state, filters       |
| createdAt     | Date          | Display                     |

**Status Values**: DRAFT, POSTED, PAID, VOID

**Frontend Actions**:

- List: Filter by status
- Detail: View line items, payment history
- Record Payment: Only when POSTED && balance > 0

---

### 3. Payment (Existing)

**Source**: `Payment` table via `POST /api/invoices/:id/payments`

| Field        | Type    | UI Usage                                |
| ------------ | ------- | --------------------------------------- |
| amount       | number  | Form input (required)                   |
| method       | string  | Form select (CASH, BANK_TRANSFER, etc.) |
| businessDate | Date    | Form date input (default: today)        |
| reference    | string? | Optional reference number               |

**Frontend Form Fields**:

- Amount (required, max: invoice.balance)
- Payment Method (required, dropdown)
- Business Date (required, default: today)
- Reference (optional)

---

### 4. PurchaseOrder (Existing)

**Source**: `PurchaseOrder` table via `/api/purchase-orders`

| Field       | Type          | UI Usage               |
| ----------- | ------------- | ---------------------- |
| id          | string (UUID) | Row key                |
| orderNumber | string        | Display                |
| supplierId  | string        | → Supplier.name lookup |
| totalAmount | number        | Display formatted      |
| status      | POStatus      | Button state, filters  |
| createdAt   | Date          | Display                |

**Status Values**: DRAFT, CONFIRMED, COMPLETED, CANCELLED

**Frontend Actions**:

- List: Filter by status
- Detail: View line items, GRN history
- Receive Goods: Only when CONFIRMED

---

### 5. GoodsReceiptNote (GRN)

**Source**: Created via `POST /api/purchase-orders/:id/receive`

| Field        | Type      | UI Usage                         |
| ------------ | --------- | -------------------------------- |
| items        | GRNItem[] | Form line items                  |
| businessDate | Date      | Form date input (default: today) |
| notes        | string?   | Optional notes                   |

**GRNItem**:
| Field | Type | Description |
|-------|------|-------------|
| productId | string | From PO line item |
| quantity | number | Received quantity |
| warehouseId | string | Destination warehouse |

---

### 6. SagaLog (Admin View)

**Source**: `SagaLog` table via `GET /api/admin/saga-logs`

| Field     | Type     | UI Usage                     |
| --------- | -------- | ---------------------------- |
| id        | string   | Row key                      |
| sagaType  | SagaType | Display (e.g., INVOICE_POST) |
| entityId  | string   | Reference to source entity   |
| step      | SagaStep | Status indicator             |
| error     | string?  | Error message display        |
| createdAt | Date     | Timestamp                    |

**Filters**: step = FAILED, COMPENSATED, COMPENSATION_FAILED

---

### 7. JournalEntry (Admin View - Orphans Only)

**Source**: `JournalEntry` table via `GET /api/admin/journals/orphans`

| Field      | Type    | UI Usage                |
| ---------- | ------- | ----------------------- |
| id         | string  | Row key                 |
| sourceType | string  | Expected reference type |
| sourceId   | string  | Expected reference ID   |
| entryDate  | Date    | Display                 |
| memo       | string? | Context                 |

**Query**: WHERE sourceType IS NULL OR sourceId IS NULL

---

## State Machines

### Invoice Status Flow

```text
DRAFT → POSTED → PAID
           ↓
         VOID
```

**UI Button States**:
| Status | Edit | Post | Record Payment | Void |
|--------|------|------|----------------|------|
| DRAFT | ✓ | ✓ | ✗ | ✗ |
| POSTED | ✗ | ✗ | ✓ (if balance > 0) | ✓ |
| PAID | ✗ | ✗ | ✗ | ✗ |
| VOID | ✗ | ✗ | ✗ | ✗ |

### PurchaseOrder Status Flow

```text
DRAFT → CONFIRMED → COMPLETED
           ↓
       CANCELLED
```

**UI Button States**:
| Status | Edit | Confirm | Receive Goods | Cancel |
|--------|------|---------|---------------|--------|
| DRAFT | ✓ | ✓ | ✗ | ✗ |
| CONFIRMED | ✗ | ✗ | ✓ | ✓ |
| COMPLETED | ✗ | ✗ | ✗ | ✗ |
| CANCELLED | ✗ | ✗ | ✗ | ✗ |

---

## Relationships

```text
Invoice (1) ←─── (N) Payment
    │
    └── (1) Customer

PurchaseOrder (1) ←─── (N) GoodsReceiptNote
    │
    └── (1) Supplier

JournalEntry ←─── sourceType:sourceId ───→ Invoice/Bill/Payment/GRN
```
