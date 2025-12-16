# Phase 0.5: Stability Hardening (Safety First)

> **"ERP yang benar bukan yang bisa membuat transaksi, tapi yang bisa SELAMAT dari kesalahan."**

**Objective**: Secure the backend against operational chaos (network retries, user errors, race conditions) before building the UI.

---

## 1. Idempotency (Duplicate Prevention)

**Goal**: Prevent double-posting of Invoices, Stock Movements, and Payments due to retries or network glitches.

### Strategy

- **Idempotency Key**: Clients must send a unique key (header `X-Idempotency-Key` or body field).
- **Process**:
  1. Check if Key exists.
  2. If `COMPLETED`, return cached response.
  3. If `PROCESSING`, return 409 (Conflict) / 429 (Too Many Requests).
  4. If New, lock Key -> Execute -> Save Response -> Unlock.

### Scope

- [ ] **Shared Module**: `IdempotencyService` & Prisma Schema.
- [ ] **Sales**: `InvoiceService.post(..., idempotencyKey)`
- [ ] **Inventory**: `InventoryService.processShipment(..., idempotencyKey)`
- [ ] **Accounting**: `PaymentService.create(..., idempotencyKey)`

---

## 2. Reversal (Accounting Safety)

**Goal**: Provide "Undo" capabilities that respect audit trails (No Soft Delete, No Hard Delete).

### Strategy

- **Mirror Transactions**:
  - Reversing a Journal = Creating a new Journal with flipped Debit/Credit.
  - Reversing a Shipment = Creating a "Return" movement.
  - Reversing an Invoice = Creating a Credit Note.

### Scope

- [ ] **Sales**: `SalesService.createCreditNote(invoiceId)`
- [ ] **Inventory**: `InventoryService.createReturn(movementId)`
- [ ] **Accounting**: `JournalService.reverse(journalId)`

---

## 3. Concurrency Guard (Data Integrity)

**Goal**: Prevent race conditions (e.g., selling the same item twice, paying an invoice twice).

### Strategy

- **Pessimistic Locking**: Use `SELECT ... FOR UPDATE` (via Prisma `$transaction` + raw query or interactive transaction logic if supported) for Stock.
- **Atomic Checks**: `UPDATE ... WHERE id = ? AND stock >= required`.

### Scope

- [ ] **Inventory**: Atomic Stock Deduction in `InventoryRepository`.
- [ ] **Payment**: Atomic Balance Update in `InvoiceRepository`.

---

## Checklist

### Week 1: Idempotency

- [ ] Define `IdempotencyKey` model.
- [ ] Create `IdempotencyService`.
- [ ] Integrate into `InvoiceService.post`.
- [ ] Integrate into `PaymentService.create`.

### Week 2: Reversals

- [ ] Implement `CreditNote` (Link to Invoice).
- [ ] Implement `StockReturn`.
- [ ] Implement `ReverseJournal`.

### Week 3: Concurrency

- [ ] Implement Pessimistic Lock / Atomic Decrement for Stock.
- [ ] Implement Payment Race Condition Guard.
