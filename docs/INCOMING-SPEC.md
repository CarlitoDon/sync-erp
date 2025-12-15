# Incoming Specifications & Gap Analysis

## Overview

This document tracks features that are identified as needed but not yet implemented. Items are added during development or user feedback sessions. When a feature is implemented, move it to `CHANGELOG.md` or delete from this file.

**Last Updated:** 2025-12-15

---

## Future Features (Backlog)

### 1. Prepayment/Down Payment (DP) Tracking

**Priority:** Medium  
**Module:** Accounting, Procurement

**Current Gap:**
No way to track payments made BEFORE goods are received (cash upfront / DP scenarios).

**Desired Flow:**

```
PO Created → Record DP Payment → Confirm PO → Receive Goods → Create Bill → Apply DP → Pay Remaining
```

**Technical Requirements:**

- New `Prepayment` entity or field on `Payment` model
- Link prepayments to PO (before Bill exists)
- Apply prepayments to Bill when created
- Balance tracking: `billAmount - appliedPrepayments = amountDue`

---

### 2. Payment Terms on Partner

**Priority:** Low  
**Module:** Partners, Accounting

**Current Gap:**
No default payment terms per supplier/customer. User must manually set due date each time.

**Desired Behavior:**

- Partner has `defaultPaymentTerms` (e.g., "Net 30", "COD", "Prepaid")
- When creating Bill/Invoice, due date auto-calculated from terms
- Override still possible per document

---

### 3. Auto-Pay on Goods Receipt (COD Flow)

**Priority:** Low  
**Module:** Accounting, Inventory

**Current Gap:**
COD transactions require manual bill creation and immediate payment recording.

**Desired Behavior:**

- Option to mark PO as "COD"
- When Goods Receipt is processed:
  - Auto-create Bill
  - Auto-post Bill
  - Prompt for payment recording (or auto-record if configured)

---

## Completed (Moved from Backlog)

### ~~VAT/PPN Accounting~~ ✅

**Implemented:** 2025-12-08 (Spec 005)

- Invoice/Bill models have `subtotal`, `taxAmount`, `taxRate` fields
- Journal entries properly split Revenue/Tax Payable

### ~~Sales Return Reversal~~ ✅

**Status:** Deferred - not critical for MVP

### ~~Goods Receipt Accrual (GRNI)~~ ✅

**Status:** Deferred - using simplified flow (Bill creates liability directly)

### ~~Create Bill from Purchase Order~~ ✅

**Implemented:** 2025-12-15 (Spec 018 - in progress)

- "Create Bill" button on COMPLETED Purchase Orders
- Bill linked to PO via `orderId`
- Duplicate warning if PO already has bill
