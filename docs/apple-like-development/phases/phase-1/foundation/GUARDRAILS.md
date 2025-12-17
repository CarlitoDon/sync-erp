# Phase 1 Guardrails

**Hard Rules for Day-to-Day Development**

Ini aturan **operasional**, bukan filosofi.

---

## G1. Feature Entry Rule

Tidak boleh menambah fitur jika:

- Mengubah >1 aggregate
- Tanpa Saga
- Tanpa compensation plan

**Checklist sebelum merge:**

- [ ] Aggregate utama jelas
- [ ] Side effects terdaftar
- [ ] Failure path ditulis

---

## G2. Saga Is Mandatory for Cross-Aggregate

Jika sebuah flow menyentuh:

- Invoice + Journal
- Stock + Order
- Payment + Balance

→ **Saga wajib**. Tanpa exception.

---

## G3. Idempotency Is Entity-Scoped

**DILARANG:**

- Client-defined arbitrary key

**WAJIB:**

```
(scope, entityId, companyId)
```

Jika tidak bisa entity-scoped, berarti flow belum matang.

---

## G4. Journal Must Be Uniquely Addressable

Setiap JournalEntry:

- Harus punya `sourceType`
- Harus punya `sourceId`
- Harus unik per company

Tanpa ini, accounting tidak bisa diaudit.

---

## G5. Business Date Always Required

Semua command finansial (Invoice Post, Payment, Bill, Credit Note) WAJIB punya:

```ts
businessDate: Date;
```

Default boleh today. Tidak boleh implicit.

---

## G6. No Silent Partial Success

Jika Saga gagal:

- Entity masuk state khusus
- Tidak bisa lanjut flow normal
- Tidak bisa "dianggap sukses"

**State yang valid:**

- `FAILED`
- `COMPENSATION_FAILED`
- `REQUIRES_ATTENTION`

---

## G7. Invariants Must Be Queryable

Minimal invariant yang harus bisa dicek via SQL:

- Invoice balance >= 0
- Journal debit == credit
- StockQty >= 0 (by shape)

Belum perlu constraint, tapi harus bisa dicari dan dimonitor.

---

## G8. Tests That Block Release

Tidak boleh release jika belum ada test untuk:

- Retry after partial failure
- Concurrent same-entity request
- Idempotency reuse
- Saga compensation failure

Test boleh jelek. Tidak boleh tidak ada.

---

## G9. Frontend Is Projection Only

Frontend:

- Tidak menyimpan state final
- Tidak menyimpulkan hasil

Jika frontend bisa salah paham, backend yang harus diperjelas.

---

## G10. Refactor Beats Feature

Jika menambah fitur:

- Memaksa duplikasi logic
- Menambah flag tak jelas
- Menambah `if (type === …)`

**STOP. Refactor dulu.**

---

## Penutup

Yang Anda bangun sekarang **sudah di level "real ERP engine"**, bukan side project.

Masalah ke depan **bukan lagi teknis**, tapi:

- Disiplin
- Konsistensi
- Keberanian menunda fitur
