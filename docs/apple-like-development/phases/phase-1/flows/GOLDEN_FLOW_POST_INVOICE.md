# 🔐 GOLDEN FLOW — Post Sales Invoice (O2C Core)

**Status**: Reference Implementation  
**Domain**: Order-to-Cash (O2C)

> Jika flow ini salah, **semua laporan salah**.

---

## 1. Flow Definition

| Property      | Value                                              |
| :------------ | :------------------------------------------------- |
| **Flow Name** | Post Sales Invoice                                 |
| **Actor**     | Finance Staff                                      |
| **Intent**    | DRAFT → POSTED + stock reduction + journal posting |

---

## 2. Preconditions (Hard Guards)

Semua kondisi ini **HARUS true** sebelum flow boleh jalan.

```txt
Company:
- businessShape != PENDING
- company ACTIVE

Invoice:
- exists
- type = INVOICE
- status = DRAFT
- has invoiceNumber
- has ≥ 1 item
- totalAmount > 0

Inventory:
- stock sufficient (shape-aware rule)

Concurrency:
- no active saga on this invoice
```

Jika satu saja gagal → **reject sebelum saga dimulai**.

---

## 3. API Contract

```http
POST /api/invoices/{invoiceId}/post
Headers:
  Idempotency-Key: required

Response:
  200 Invoice (POSTED)
```

### Idempotency Rule

```txt
Scope: INVOICE_POST
Key: invoiceId + companyId
```

Retry dengan key yang sama **HARUS return response yang sama**.

---

## 4. High-Level Sequence

```
UI
 ↓
Controller
 ↓
Policy Guards
 ↓
Idempotency Lock
 ↓
InvoicePostingSaga
   ├─ Step 1: Reserve / Ship Stock
   ├─ Step 2: Post Journal
   ├─ Step 3: Update Invoice Status
 ↓
Idempotency Complete
 ↓
Response
```

Tidak ada shortcut. Tidak ada conditional skip.

---

## 5. Detailed Saga Steps

### Step 0 — Saga Lock

```txt
Lock entity: Invoice(id) FOR UPDATE
```

Mencegah parallel post. Satu saga per invoice.

---

### Step 1 — Stock Shipment (Inventory)

**Action**:

- Create StockMovement OUT
- Snapshot cost per item
- Decrease stock atomically

**Invariant**:

```txt
product.stockQty >= 0
```

**Failure**: Insufficient stock → STOP (no compensation needed)

**Compensation**:

```txt
If later step fails:
- Reverse StockMovement
- Restore stockQty using snapshot cost
```

---

### Step 2 — Journal Posting

**Action**:

- Create journal entry:
  - Debit: Accounts Receivable
  - Credit: Revenue
  - Credit: VAT (if applicable)

**Invariant**:

```txt
sum(debit) == sum(credit)
unique(companyId, sourceType=INVOICE, sourceId=invoiceId)
```

**Failure**: DB constraint, accounting validation

**Compensation**:

```txt
journalService.reverse(journalId)
```

---

### Step 3 — Invoice State Transition

**Action**:

```ts
status: DRAFT → POSTED
postedAt: now()
```

**Invariant**:

- Invoice immutable after POSTED
- Balance initialized = totalAmount

**Failure**: Compensate stock + journal

---

## 6. Compensation Matrix

| Step Failed | Compensation Required   |
| :---------- | :---------------------- |
| Step 1      | None                    |
| Step 2      | Reverse stock           |
| Step 3      | Reverse journal + stock |

Tidak ada "manual review" excuse.

---

## 7. Idempotency Behavior

### Scenario A — Retry after success

- Return cached POSTED invoice
- Do NOT re-run saga

### Scenario B — Retry during PROCESSING

- Reject or wait
- Never double-execute

---

## 8. Error Taxonomy

| Code                 | When            | Retryable |
| :------------------- | :-------------- | :-------: |
| INVOICE_NOT_FOUND    | invoice missing |    ❌     |
| INVALID_STATE        | not DRAFT       |    ❌     |
| INSUFFICIENT_STOCK   | stock < qty     |    ❌     |
| JOURNAL_CONFLICT     | double post     |    ❌     |
| CONCURRENT_OPERATION | saga locked     |    ✅     |

Semua error dari [ERROR_CATALOG.md](./ERROR_CATALOG.md).

---

## 9. Resulting State (Post-Conditions)

```txt
Invoice:
- status = POSTED
- immutable

Inventory:
- stock reduced
- cost snapshotted

Accounting:
- journal balanced
- reference linked to invoice

System:
- idempotency COMPLETED
- saga log SUCCESS
```

Jika salah satu tidak tercapai → **bug**.

---

## 10. Pattern Summary

Ini **template mental** untuk semua flow lain:

- Purchase Order → Bill → Stock IN
- Payment Posting
- Credit Note
- Stock Adjustment

Semua harus punya:

1. Preconditions
2. Saga steps
3. Compensation table
4. Idempotency scope
5. Final invariants

---

_Golden reference established: 2025-12-17_
