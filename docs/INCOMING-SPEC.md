# Finance Integration - Incoming Specifications & Gap Analysis

## Overview

This document outlines critical financial features that are currently missing or improperly implemented in the Finance Integration module. These items were identified during the E2E verification of the Phase 5 implementation.

## 1. Value Added Tax (VAT/PPN) Accounting

**Severity:** Critical
**Current Behavior:**
`InvoiceService` and `JournalService.postInvoice` book the **Total Amount** (Subtotal + Tax) directly to `Sales Revenue (4100)`.

**Impact:**

- Revenue is overstated.
- Tax Liability is understated (not recorded).
- Compliance risk.

**Proposed Solution:**

- Update `InvoiceService.createFromSalesOrder` to explicitly store `subtotal` and `taxAmount`.
- Update `JournalService.postInvoice` to accept split amounts.
- **Journal Entry:**
  - Dr Accounts Receivable (1300): [Total]
  - Cr Sales Revenue (4100): [Subtotal]
  - Cr Tax Payable (2300): [TaxAmount]

## 2. Sales Return Reversal (Retur Penjualan)

**Severity:** High
**Current Behavior:**
`JournalService` has a helper `postSalesReturn`, but it is **never called**. Logic for processing returns exists in isolation or is missing entirely from `SalesOrderService` / `FulfillmentService` for the financial trigger.

**Impact:**

- Inventory quantity increases physically, but Financial Inventory Asset remains low.
- COGS remains high (cost not reversed).
- Profit margins are understated.

**Proposed Solution:**

- Implement `ReturnService` or specific `return` method in `SalesOrderService`.
- Trigger `InventoryService.processReturn` (to be created/updated).
- **Journal Entry:**
  - Dr Inventory Asset (1400): [Original Avg Cost * Qty]
  - Cr COGS (5000): [Original Avg Cost * Qty]
  - _Note: Refund/Credit Memo logic is separate (Dr Revenue / Cr AR)._

## 3. Goods Receipt Accrual (GRNI - Goods Received Not Invoiced)

**Severity:** Medium (Timing Difference)
**Current Behavior:**
Stock is added to `InventoryService` upon Receipt (`processGoodsReceipt`), but **no journal** is created until the Bill is posted.

**Impact:**

- If Receipt and Bill happen in different months, Inventory Asset is understated during the Receipt month.
- "Free stock" appears in reports until billed.

**Proposed Solution:**

- Implement Accrual Posting on Goods Receipt.
- **Journal Entry (at Receipt):**
  - Dr Inventory Asset (1400): [PO Cost]
  - Cr GRN Suspense / Unbilled Payables (2105): [PO Cost]
- **Journal Entry (at Bill):**
  - Dr GRN Suspense (2105): [PO Cost]
  - Cr Accounts Payable (2100): [Bill Amount]
