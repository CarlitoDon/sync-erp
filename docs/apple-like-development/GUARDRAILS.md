# Engineering Guardrails (Non-Negotiable Rules)

Dokumen ini adalah **aturan keras**.
Melanggar guardrail = **bug**, bukan "tech debt".

---

## 1. Domain & Data Integrity

### 1.1 Single Source of Truth

- Backend adalah satu-satunya penentu state
- Frontend **tidak pernah** menghitung saldo, stok, atau status final

---

### 1.2 Invariant First

Contoh invariant wajib:

- `invoice.balance >= 0`
- `sum(debit) == sum(credit)`
- `stock.qty >= 0` (kecuali explicit policy)

Jika invariant tidak bisa dipaksakan:

- Tambahkan guard
- Tambahkan test
- Tambahkan monitoring

---

## 2. Saga & Side Effects

### 2.1 No Cross-Aggregate Without Saga

Jika sebuah flow menyentuh:

- ≥2 aggregate, atau
- ≥1 aggregate + external side effect

➡️ **WAJIB Saga**

---

### 2.2 Compensation Is Mandatory

Setiap step Saga:

- Harus punya compensation
- Jika tidak bisa → step itu **tidak boleh ada**

---

### 2.3 Failure Is a First-Class State

- FAILED / COMPENSATED / COMPENSATION_FAILED harus eksplisit
- Tidak ada `catch { console.log }`

---

## 3. Idempotency & Concurrency

### 3.1 Idempotency Scope

Idempotency key:

- **Tidak boleh arbitrary**
- Harus scoped ke `(companyId, entityId, action)`

---

### 3.2 No Parallel Mutation

- Entity yang sama tidak boleh diproses paralel
- Gunakan row-level lock atau equivalent

---

## 4. Accounting Rules

### 4.1 Double Entry Enforcement

- Tidak ada journal tanpa balance
- Tidak ada posting tanpa source reference

---

### 4.2 Immutability Direction

- Draft → Mutable
- Posted → Immutable
- Adjustment → New entry, bukan edit

---

## 5. Testing Rules

- Bug tanpa test = bug belum diperbaiki
- Test yang tidak bisa fail = test tidak valid
- Integration test > unit test untuk flow bisnis
