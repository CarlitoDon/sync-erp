# SAGA Transaction Safety

## Meta

| Property   | Value                                |
| ---------- | ------------------------------------ |
| Feature ID | 022                                  |
| Created    | 2025-12-16                           |
| Status     | Clarified                            |
| Priority   | High (Risk #3 from Phase 0.5 Review) |

## Problem Statement

Multi-module operations that touch **stock AND money** require saga pattern to prevent data drift when partial failures occur.

### Saga is WAJIB When:

1. Menyentuh **uang (accounting impact)**
2. Menyentuh **stok fisik**
3. Mengubah **status dokumen bisnis irreversible**
4. Melibatkan **lebih dari satu aggregate / tabel utama**
5. Partial success = **data korup**

> **Aturan Emas:** "Jika satu API call bisa mengubah stok DAN uang, maka dia wajib Saga, idempotent, dan reversible."

---

## Risk Matrix (Complete Module Coverage)

### 🔴 WAJIB Saga - Prioritas 1 (Critical Path)

| Module          | Operasi       | Alur                                        | Kompensasi                       |
| --------------- | ------------- | ------------------------------------------- | -------------------------------- |
| **Sales**       | Post Invoice  | Invoice → Stock OUT → Journal (Revenue, AR) | Reverse stock, reverse journal   |
| **Sales**       | Ship Order    | Order → Stock OUT → Movement log            | Re-increase stock                |
| **Procurement** | Receive Goods | PO → Stock IN → Accrual journal             | Decrease stock, reverse accrual  |
| **Procurement** | Post Bill     | Receipt → Stock value → AP Journal          | Reverse stock value, journal     |
| **Accounting**  | Apply Payment | Payment → Invoice balance → Cash journal    | Restore balance, reverse journal |

### 🔴 WAJIB Saga - Prioritas 2 (High)

| Module          | Operasi            | Alur                                         | Kompensasi             |
| --------------- | ------------------ | -------------------------------------------- | ---------------------- |
| **Sales**       | Create Credit Note | Invoice → Negative stock → Reversing journal | Restore stock, reverse |
| **Procurement** | Vendor Return      | Bill → Stock OUT → AP reduction              | Restore stock, journal |
| **Inventory**   | Stock Transfer     | WH-A OUT → WH-B IN → Movement                | Reverse both           |
| **Inventory**   | Stock Return       | Customer return → Stock IN → Cost update     | Reverse                |
| **Inventory**   | Stock Adjustment   | Qty change → Variance journal                | Reverse                |

### 🟡 Saga Opsional

| Module        | Operasi             | Condition            |
| ------------- | ------------------- | -------------------- |
| Manufacturing | Issue Raw Material  | Jika ada cost rollup |
| Manufacturing | Complete Production | Jika WIP → FG        |
| Fixed Assets  | Capitalize Asset    | Jika auto-journal    |

### ❌ Tidak Perlu Saga

- Master Data (Product, Customer, Vendor, CoA) - CRUD biasa
- Configuration (Company settings, Tax, Numbering) - Single transaction
- Reporting (Dashboard, Ledger, Stock card) - Read-only

---

## Functional Requirements

### FR-001: Explicit Step Tracking

All multi-module operations MUST track progress through explicit step states.

```
PostingContext {
  step: PENDING | STOCK_DONE | JOURNAL_DONE | COMPLETED | FAILED
  stepData: { stockMovementId, journalId, ... }
}
```

### FR-002: Compensating Actions (NOT Deletion)

**❌ Never:** Delete records, direct SQL fix
**✅ Always:** Create reversing records, set explicit failure state

### FR-003: Per-Step Retry and Compensation

Each saga step MUST be independently retryable and compensatable.

### FR-004: Failure State Visibility

Failed saga operations MUST be clearly visible with error reason.

---

## Scope & Implementation Phases

### Phase 1: Critical Path (WAJIB)

| Saga            | Module      | Tasks                   |
| --------------- | ----------- | ----------------------- |
| Invoice Posting | Sales       | Stock OUT → Journal     |
| Shipment        | Sales       | Order → Stock OUT       |
| Goods Receipt   | Procurement | PO → Stock IN → Accrual |
| Bill Posting    | Procurement | Receipt → AP Journal    |
| Payment Posting | Accounting  | Balance → Cash Journal  |

### Phase 2: High Priority

| Saga           | Module    | Tasks                                |
| -------------- | --------- | ------------------------------------ |
| Credit Note    | Sales     | Invoice → -Stock → Reversing Journal |
| Stock Transfer | Inventory | WH-A OUT → WH-B IN                   |
| Stock Return   | Inventory | Customer → Stock IN                  |

### Phase 3: Deferred

- Stock Adjustment saga
- Vendor Return saga
- Manufacturing sagas

### Out of Scope

- Event bus / async choreography
- Distributed transactions across services
- Automatic background saga recovery job

---

## Success Criteria

| Metric                   | Target                           |
| ------------------------ | -------------------------------- |
| Stock drift incidents    | Zero                             |
| Orphan journal entries   | Zero                             |
| Posting atomicity        | 100% (all-or-compensate)         |
| Failure recovery time    | < 1 minute for auto-compensation |
| Audit trail completeness | 100% of saga steps logged        |

---

## Key Entities

| Entity          | Saga Role                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| SagaLog         | Tracks step progress for all sagas                                                                        |
| SagaType (enum) | INVOICE_POST, SHIPMENT, GOODS_RECEIPT, BILL_POST, PAYMENT_POST, CREDIT_NOTE, STOCK_TRANSFER, STOCK_RETURN |
| SagaStep (enum) | PENDING → STOCK_DONE → JOURNAL_DONE → COMPLETED / FAILED                                                  |

---

## Implementation Approach

**Orchestrated Saga Pattern:**

- Each operation has dedicated saga class
- Explicit step tracking with SagaLog
- Compensation in reverse order
- No event bus for MVP

---

## Clarifications

### Session 2025-12-16

- Q: What modules need Saga? → A: Sales, Procurement, Inventory, Accounting (operations touching stock + money)
- Q: How to rollback? → A: Compensating actions (reversing records), NOT deletion
- Q: Implementation style? → A: Orchestrated saga with explicit step tracking
- Q: Priority order? → A: Phase 1 = Invoice, Shipment, Goods Receipt, Bill, Payment
