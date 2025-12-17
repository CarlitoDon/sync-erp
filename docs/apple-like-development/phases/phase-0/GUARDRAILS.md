# Phase 0: Guardrails

**Non-Negotiable Rules for Foundation Phase**

## 1. Domain & Data Integrity

### 1.1 Single Source of Truth

- Backend adalah satu-satunya penentu state
- Frontend **tidak pernah** menghitung saldo, stok, atau status final

### 1.2 Invariant First

Contoh invariant wajib:

- `invoice.balance >= 0`
- `sum(debit) == sum(credit)`
- `stock.qty >= 0` (kecuali explicit policy)

---

## 2. Saga & Side Effects

### 2.1 No Cross-Aggregate Without Saga

Jika sebuah flow menyentuh ≥2 aggregate → **WAJIB Saga**

### 2.2 Compensation Is Mandatory

Setiap step Saga harus punya compensation

### 2.3 Failure Is First-Class

- FAILED / COMPENSATED / COMPENSATION_FAILED harus eksplisit
- Tidak ada `catch { console.log }`

---

## 3. Idempotency & Concurrency

### 3.1 Idempotency Scope

Harus scoped ke `(companyId, entityId, action)`

### 3.2 No Parallel Mutation

Entity yang sama tidak boleh diproses paralel

---

## 4. Testing Rules

- Bug tanpa test = bug belum diperbaiki
- Test yang tidak bisa fail = test tidak valid
- Integration test > unit test untuk flow bisnis

---

_Phase 0 guardrails established: 2025-12-16_
