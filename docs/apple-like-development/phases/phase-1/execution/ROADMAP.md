# 🧭 PHASE 1 ROADMAP — _Apple-Style ERP, Usable but Safe_

**Theme Phase 1:**

> _"Make it usable without breaking invariants."_

Target akhir Phase 1:

- User bisa **operasional harian** (jual, beli, bayar)
- Tanpa membuka celah **data corruption**
- UX sederhana, tidak lengkap, tapi **jujur**

---

## 🔒 0. ENTRY GATE (WAJIB, SEKALI SAJA)

Checklist ini **HARUS 100% dicentang sebelum Phase 1 work dimulai**.

- [x] Phase 0 audit CLOSED _(Verified: 2025-12-16)_
- [x] Saga lock per entity _(SagaOrchestrator.getLockTable())_
- [x] Idempotency entity-scoped _(@@unique([companyId, scope, entityId]))_
- [x] Journal unique constraint (sourceType + sourceId) _(@@unique in schema)_
- [x] PENDING shape guard middleware _(shapeGuard.ts on 8 routes)_
- [x] No known silent data corruption paths _(Per Phase 0 review)_

✅ **GATE PASSED — 2025-12-17**

---

## 🧩 1. DOMAIN CONTRACT STABILIZATION (Backend)

Tujuan: **membekukan "cara kerja" domain sebelum UI masuk**

### 1.1 Finalize Domain States (No UI Yet)

- [ ] Invoice states final:
  - DRAFT → POSTED → PAID → VOID
- [ ] Bill states final:
  - DRAFT → POSTED → PAID → VOID
- [ ] Sales Order states:
  - DRAFT → CONFIRMED → FULFILLED → CLOSED
- [ ] Purchase Order states:
  - DRAFT → CONFIRMED → RECEIVED → CLOSED

> ❗ Tidak boleh ada "status tambahan dadakan" di Phase 1.

---

### 1.2 Lock Write Rules per State

Untuk **setiap entity**, checklist ini harus ada:

- [ ] WRITE allowed only in specific states
- [ ] Mutations after POSTED explicitly blocked
- [ ] Error codes konsisten (ERROR_CATALOG)

Contoh:

- Invoice POSTED:
  - ❌ edit item
  - ❌ change price
  - ✅ receive payment
  - ✅ credit note

---

### 1.3 Policy Layer Coverage Check

- [ ] InventoryPolicy covers all shapes (Retail, Manufacturing, Service)
- [ ] ProcurementPolicy covers P2P
- [ ] SalesPolicy covers O2C
- [ ] AccountingPolicy prevents invalid posting

Checklist per policy:

- [ ] Shape aware
- [ ] Config driven
- [ ] No DB access inside policy

---

## 🔄 2. FLOW COMPLETENESS (Golden Paths Only)

Tujuan: **end-to-end flow works perfectly**, edge cases later.

### 2.1 Golden Flow Validation

Untuk setiap flow ini, buat **FLOW.md + tests**:

- [x] Post Sales Invoice (DONE, baseline)
- [ ] Receive Goods (GRN)
- [ ] Post Vendor Bill
- [ ] Create Payment
- [ ] Create Credit Note

Checklist per flow:

- [ ] Preconditions explicit
- [ ] Saga steps enumerated
- [ ] Compensation matrix complete
- [ ] Idempotency scope defined
- [ ] Tests: success + 1 failure

---

### 2.2 Disable Non-Golden Paths

- [ ] Disable partial shipment (if not ready)
- [ ] Disable multi-currency (if not ready)
- [ ] Disable backdated posting (if not ready)

Apple rule:

> **Better missing than wrong.**

---

## 🧪 3. PHASE 1 TEST FLOOR

Tujuan: **confidence, not coverage porn**

### 3.1 Mandatory Test Types

- [ ] Unit tests for rules/policy (pure)
- [ ] Saga success test
- [ ] Saga fail + compensation test
- [ ] Idempotency retry test
- [ ] Concurrent request test (same entity)

Minimal rule:

> 1 happy path + 1 catastrophic failure per flow.

---

### 3.2 Invariant Tests (NEW)

Add tests that assert:

- [ ] invoice.balance ≥ 0
- [ ] product.stockQty ≥ 0
- [ ] sum(journal.debit) == sum(journal.credit)

These tests should **fail loudly** if broken.

---

## 🖥️ 4. FRONTEND — OPERATIONAL UI ONLY

Tujuan: **No magic, no auto-anything**

### 4.1 Screen Inventory (Minimal)

- [ ] Dashboard (read-only KPIs)
- [ ] Sales Invoice List
- [ ] Invoice Detail
- [ ] Payment Modal
- [ ] Purchase Order List
- [ ] Receive Goods Screen

NO:

- drag-drop
- inline edit POSTED entities
- batch ops

---

### 4.2 UI Guardrails

- [ ] Disable buttons based on state
- [ ] Explicit confirmation modals
- [ ] Show irreversible warnings
- [ ] Pending Shape banner (already exists)

UX principle:

> **Make irreversible actions uncomfortable.**

---

## 🔎 5. OBSERVABILITY (Enough, Not Fancy)

### 5.1 Mandatory Tables

- [ ] saga_log
- [ ] idempotency_key
- [ ] journal_entry (with sourceType/sourceId)

### 5.2 Admin Visibility (Read-Only)

- [ ] View saga failures
- [ ] View compensated vs uncompensated
- [ ] View orphan journals

No dashboards yet. SQL is fine.

---

## 🚧 6. WHAT IS EXPLICITLY OUT OF SCOPE (Phase 1)

Checklist ini penting agar Anda **tidak tergoda**:

- ❌ RBAC kompleks
- ❌ Approval workflow
- ❌ Multi-warehouse transfers
- ❌ Multi-currency
- ❌ Reporting engine
- ❌ Soft delete everywhere

---

## ✅ PHASE 1 EXIT CRITERIA

Phase 1 dianggap selesai jika:

- [ ] Real user can complete full O2C & P2P daily work
- [ ] No data corruption possible without explicit bug
- [ ] All irreversible actions are guarded
- [ ] You trust retry, concurrency, and compensation

Jika belum → **belum selesai**, meski UI "sudah cakep".

---

_Roadmap established: 2025-12-17_
