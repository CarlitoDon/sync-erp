# Finance Integration - Incoming Specifications & Gap Analysis

## Overview

This document outlines critical financial features that are currently missing or improperly implemented in the Finance Integration module. These items were identified during the E2E verification of the Phase 5 implementation and require immediate attention in the next iteration.

## 1. Value Added Tax (VAT/PPN) Accounting

**Severity:** Critical
**Current Behavior:**
`InvoiceService` creates an invoice where `amount` includes tax. `JournalService.postInvoice` books this **Total Amount** directly to `Sales Revenue (4100)`.

**Impact:**

- Revenue is overstated (Gross Revenue includes Tax).
- Tax Liability is understated (not recorded).
- Compliance risk (tax not isolated).

**Technical Specification:**

### Database Schema Updates (`schema.prisma`)

Existing `Invoice` model likely stores a single `amount`. We need to explicitly store `taxAmount` and `subtotal` or calculate them reliably.

```prisma
model Invoice {
  // ... existing fields
  subtotal    Decimal  @default(0)
  taxAmount   Decimal  @default(0)
  // amount remains as Total (Subtotal + Tax)
}
```

### Service Logic Updates

**1. InvoiceService.ts**

- Update `createFromSalesOrder` to:
  - Accept `taxRate` (default 0 or from Company/Product settings).
  - Calculate `subtotal` = Sum(Line Items).
  - Calculate `taxAmount` = `subtotal` \* `taxRate`.
  - Store these values in the new DB fields.

**2. JournalService.ts**

- Update `postInvoice(companyId, invoiceNumber, amount, taxAmount)`:
  - **Debit**: Accounts Receivable (1300) -> `amount` (Total)
  - **Credit**: Sales Revenue (4100) -> `amount - taxAmount` (Net)
  - **Credit**: Tax Payable (2300) -> `taxAmount`

## 2. Sales Return Reversal (Retur Penjualan)

**Severity:** High
**Current Behavior:**
`JournalService.postSalesReturn` helper exists but is **never called** by any service. There is no centralized `ReturnService` or `processReturn` method wired to financial logic.

**Impact:**

- Inventory quantity increases physically (if manually adjusted), but Financial Inventory Asset balance is not reconciled with the COGS reversal.
- COGS remains high (cost not reversed).
- Incorrect Profit/Loss Statement.

**Technical Specification:**

### Service Logic Updates

**1. SalesOrderService.ts / ReturnService.ts**

- Create `processReturn(orderId, items[])` method.
- This method must:
  - Verify original order status.
  - Create `InventoryMovement` (Type: IN, Ref: "Return...").
  - Update Product Stock.
  - **Trigger Journal:** `journalService.postSalesReturn`.

**2. JournalService.ts**

- Logic exists, verify account mapping:
  - **Debit**: Inventory Asset (1400) -> [AvgCost * Qty]
  - **Credit**: COGS (5000) -> [AvgCost * Qty]

## 3. Goods Receipt Accrual (GRNI - Goods Received Not Invoiced)

**Severity:** Medium (Timing Difference)
**Current Behavior:**
Stock is added to `InventoryService` upon Receipt (`processGoodsReceipt`), but **no journal** is created until the Bill is posted.

**Impact:**

- **Stock Received but not Billed:** Inventory Asset is understated locally.
- **Bill Received later:** Jumps in asset value detached from physical receipt timing.

**Technical Specification:**

### Service Logic Updates

**1. InventoryService.ts**

- In `processGoodsReceipt`, calculate `totalEstimatedCost` (from PO Line Items).
- Trigger `journalService.postGoodsReceipt(companyId, ref, amount)`.

**2. JournalService.ts**

- Add `postGoodsReceipt`:
  - **Debit**: Inventory Asset (1400)
  - **Credit**: GRN Suspense / Accrued Liability (2105)

**3. BillService.ts**

- Update `postBill`:
  - Instead of (Dr Inventory, Cr AP), it should be:
  - **Debit**: GRN Suspense (2105) -> [Bill Amount]
  - **Credit**: Accounts Payable (2100) -> [Bill Amount]
    _Note: Handle price variances between PO and Bill (Dr/Cr Price Variance Expense)._
