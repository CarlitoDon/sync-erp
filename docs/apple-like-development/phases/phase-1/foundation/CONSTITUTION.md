# Phase 1 Constitution

**Apple-Style ERP – Phase 1 (User-Facing Features)**

> Phase 1 bukan soal menambah modul.
> Phase 1 adalah soal **menambah fitur tanpa merusak kebenaran sistem**.

---

## I. Domain Truth Is Sacred

> Sistem lebih baik menolak operasi valid secara UX
> daripada menerima operasi invalid secara domain.

**Implikasi:**

- Tidak ada "nanti kita perbaiki datanya"
- Tidak ada silent correction
- Error > corruption

**Contoh:**

- Payment gagal → error
- Journal tidak balance → abort
- Stock tidak cukup → hard stop

---

## II. Backend Owns Reality

**Frontend:**

- Menampilkan
- Mengirim intent
- Tidak menghitung kebenaran

**Backend:**

- Menghitung HPP
- Menentukan status
- Menentukan efek samping

**Larangan eksplisit:**

- ❌ Frontend menghitung balance
- ❌ Frontend menentukan invoice PAID
- ❌ Frontend menentukan stock OUT

---

## III. No Side Effect Without Policy

Setiap efek samping harus:

1. Dicek Policy
2. Dieksekusi Service
3. Dicatat atau bisa ditelusuri

Jika satu efek terjadi tanpa policy:

- Itu bug, walaupun test hijau

---

## IV. One Business Event = One Source of Truth

Satu kejadian bisnis:

- Satu aggregate utama
- Banyak konsekuensi
- Satu referensi

**Contoh — Invoice Posted:**

- Stock movement
- Journal entry
- Status update

Semua harus menunjuk ke **satu event yang sama**, bukan saling trigger.

---

## V. Time Is a Business Concept

Waktu:

- Bukan `new Date()`
- Bukan server time
- Bukan retry time

Waktu adalah:

- `businessDate`
- Diset di command
- Dipakai konsisten

---

## VI. Failure Must Be Visible

Jika sistem gagal:

- Ada status
- Ada jejak
- Ada cara recovery

Lebih baik:

- Data "macet tapi jelas" daripada data "jalan tapi salah"

---

## VII. ERP Should Become Boring

Target akhir:

- Tidak heroik
- Tidak penuh if/else
- Tidak banyak edge case manual

Jika engineer merasa:

> "Wah ini ribet banget tapi aman"

Berarti arahnya benar.
