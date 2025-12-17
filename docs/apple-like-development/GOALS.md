# ERP Development Goals (Phase 0–3)

Dokumen ini mendefinisikan **tujuan sistem** per fase.
Jika sebuah pekerjaan **tidak mendorong goal di bawah**, maka itu **bukan prioritas**.

---

## Phase 0 — System Correctness Foundation

### Primary Goal

> Sistem **benar secara domain**, **aman dari race condition**, dan **bisa diaudit**, bahkan saat gagal.

### Success Means

- Tidak ada silent failure
- Tidak ada double side-effect
- Tidak ada state "kelihatannya sukses tapi datanya salah"

### Explicit Outcomes

- Semua write path dilindungi guard
- Semua multi-step process menggunakan Saga
- Semua side-effect bisa direverse atau dilacak

---

## Phase 1 — Usability Without Compromise

### Primary Goal

> User bisa menggunakan sistem **tanpa merusak kebenaran Phase 0**.

### Success Means

- User non-teknis bisa menjalankan flow utama
- UX tidak menyimpan business logic
- Semua aksi user = command ke backend

---

## Phase 2 — Operational Resilience

### Primary Goal

> Sistem **bertahan di dunia nyata**, bukan hanya di test suite.

### Success Means

- Error bisa dilacak ujung ke ujung
- Anomali data bisa dideteksi
- Sistem bisa diperbaiki tanpa DB hack

---

## Phase 3 — Accounting & Compliance Readiness

### Primary Goal

> Sistem layak dipakai untuk pembukuan serius dan audit.

### Success Means

- Journal immutable setelah closing
- Period correctness terjaga
- Accountant tidak butuh Excel paralel

---

## Anti-Goals (Seluruh Phase)

- Kecepatan development > kebenaran data
- UX convenience > domain integrity
- "Nanti juga bisa dibenerin di DB"
