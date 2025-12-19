# Procure-to-Pay (P2P) Flow

> Dokumentasi lengkap alur pembelian dari pembuatan PO hingga pembayaran ke supplier.

## Overview

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  CREATE PO   │ →  │ RECEIVE GOODS│ →  │ CREATE BILL  │ →  │   PAY BILL   │
│  (Purchasing)│    │  (Warehouse) │    │   (Finance)  │    │   (Finance)  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

---

## Step 1: Buat Purchase Order (PO)

**Menu:** `Purchasing` → `Purchase Orders`

### User Actions

| Aksi          | Detail                                          |
| ------------- | ----------------------------------------------- |
| **Klik**      | Tombol `+ New Purchase Order`                   |
| **Isi Form**  | Pilih Supplier, Tanggal PO, Payment Terms       |
| **Add Items** | Pilih produk, qty, harga per unit               |
| **Save**      | Status = `DRAFT`                                |
| **Confirm**   | Klik tombol `Confirm PO` → Status = `CONFIRMED` |

### Hasil

- PO dengan status `CONFIRMED` siap untuk diterima barangnya
- Supplier bisa mulai dikirimkan PO ini

### Status Transitions

```
DRAFT → CONFIRMED → PARTIALLY_RECEIVED → RECEIVED
                 → CANCELLED
```

---

## Step 2: Terima Barang (Goods Receipt Note / GRN)

**Menu:** `Inventory` → `Goods Receipt` atau dari **detail PO** klik `Receive Goods`

### User Actions

| Aksi                 | Detail                                              |
| -------------------- | --------------------------------------------------- |
| **Pilih PO**         | Sistem menampilkan daftar PO yang sudah `CONFIRMED` |
| **Klik**             | Tombol `Create GRN` atau `Receive`                  |
| **Verifikasi Qty**   | Cek qty yang diterima vs qty di PO                  |
| **Input Actual Qty** | Qty aktual yang diterima (bisa partial)             |
| **Save/Post**        | GRN dibuat, stok bertambah                          |

### Hasil

- ✅ Stok inventory bertambah sesuai qty yang diterima
- ✅ PO status berubah: `PARTIALLY_RECEIVED` atau `RECEIVED`
- ✅ GRN siap dijadikan dasar untuk Bill

### Validation Rules

- ❌ Tidak bisa buat GRN kalau PO masih `DRAFT`
- ❌ Tidak bisa menerima qty lebih dari sisa qty di PO

---

## Step 3: Buat Bill (Tagihan Supplier)

**Menu:** `Finance` → `Accounts Payable` → `Bills` atau dari **detail GRN/PO** klik `Create Bill`

### User Actions

| Aksi                 | Detail                                    |
| -------------------- | ----------------------------------------- |
| **Pilih GRN/PO**     | Sistem menampilkan GRN yang belum di-bill |
| **Klik**             | Tombol `Create Bill`                      |
| **Verifikasi**       | Cek harga, qty, dan total tagihan         |
| **Input Invoice No** | Nomor invoice dari supplier               |
| **Save**             | Status = `DRAFT`                          |
| **Post**             | Klik `Post Bill` → Status = `POSTED`      |

### Hasil

- ✅ Hutang (AP) tercatat di sistem
- ✅ Bill siap untuk dibayar
- ✅ Jurnal akuntansi: `Debit: Inventory/Expense` | `Credit: Accounts Payable`

### Status Transitions

```
DRAFT → POSTED → PARTIALLY_PAID → PAID
```

### Validation Rules

- ❌ Tidak bisa buat Bill kalau belum ada GRN (barang harus sudah diterima)
- ❌ Tidak bisa post Bill kalau data tidak matching dengan GRN

---

## Step 4: Bayar Bill (Payment)

**Menu:** `Finance` → `Payments` atau dari **detail Bill** klik `Record Payment`

### User Actions

| Aksi              | Detail                                                |
| ----------------- | ----------------------------------------------------- |
| **Pilih Bill**    | Sistem menampilkan Bill yang `POSTED` dan belum lunas |
| **Klik**          | Tombol `Pay` atau `Record Payment`                    |
| **Pilih Account** | Bank/Cash account untuk pembayaran                    |
| **Input Amount**  | Jumlah yang dibayar (bisa partial)                    |
| **Submit**        | Payment recorded                                      |

### Hasil

- ✅ Bill status: `PARTIALLY_PAID` atau `PAID`
- ✅ Saldo AP berkurang
- ✅ Saldo Bank/Cash berkurang
- ✅ Jurnal: `Debit: Accounts Payable` | `Credit: Bank/Cash`

### Validation Rules

- ❌ Tidak bisa bayar Bill yang masih `DRAFT`
- ❌ Tidak bisa bayar melebihi outstanding amount

---

## UI Navigation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR MENU                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  📦 PURCHASING                                                               │
│     └── Purchase Orders ──────► [+ New PO] ──► Fill Form ──► [Confirm]      │
│                                      │                            │         │
│  📥 INVENTORY                        │                            ▼         │
│     └── Goods Receipt ◄──────────────┴────────────── [Receive Goods]        │
│              │                                                               │
│              │ (setelah barang diterima)                                    │
│              ▼                                                               │
│  💰 FINANCE                                                                  │
│     ├── Bills (Accounts Payable) ◄─────────────────── [Create Bill]         │
│     │        │                                                               │
│     │        │ (setelah bill di-post)                                       │
│     │        ▼                                                               │
│     └── Payments ◄─────────────────────────────────── [Pay Bill]            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Shortcut Flows (Alternatif)

### Dari Detail PO

```
PO Detail Page
    ├── [Confirm] → Status jadi CONFIRMED
    ├── [Receive Goods] → Langsung ke form GRN
    └── [Create Bill] → Otomatis ambil data dari PO (setelah ada GRN)
```

### Dari Detail GRN

```
GRN Detail Page
    └── [Create Bill] → Langsung ke form Bill dengan data dari GRN
```

### Dari Detail Bill

```
Bill Detail Page
    ├── [Post] → Status jadi POSTED
    └── [Record Payment] → Langsung ke form Payment
```

---

## 3-Way Matching

Best practice dalam P2P adalah melakukan **3-Way Matching** sebelum pembayaran:

| Dokumen  | Fungsi                               |
| -------- | ------------------------------------ |
| **PO**   | Apa yang dipesan (qty, harga, terms) |
| **GRN**  | Apa yang diterima (qty aktual)       |
| **Bill** | Apa yang ditagih supplier            |

Ketiga dokumen ini harus **matching** sebelum pembayaran dilakukan.

---

## Status Summary

| Dokumen     | Draft | Confirmed | In Progress        | Complete             |
| ----------- | ----- | --------- | ------------------ | -------------------- |
| **PO**      | DRAFT | CONFIRMED | PARTIALLY_RECEIVED | RECEIVED / CANCELLED |
| **GRN**     | -     | POSTED    | -                  | -                    |
| **Bill**    | DRAFT | POSTED    | PARTIALLY_PAID     | PAID                 |
| **Payment** | -     | COMPLETED | -                  | -                    |

---

## Anti-Patterns (Harus Dihindari)

| ❌ Anti-Pattern                      | ✅ Correct Pattern                            |
| ------------------------------------ | --------------------------------------------- |
| Membuat Bill langsung tanpa PO/GRN   | Bill harus dari GRN yang valid                |
| Membuat GRN dari PO yang masih DRAFT | GRN hanya dari PO yang CONFIRMED              |
| Membayar invoice yang belum di-post  | Payment hanya untuk Bill yang POSTED          |
| Partial receiving tanpa tracking     | Setiap partial receive harus ada GRN terpisah |
| Stok bertambah saat PO dibuat        | Stok bertambah saat GRN dibuat                |

---

## Related Documents

- [Order-to-Cash (O2C) Flow](./order-to-cash-o2c.md)
- [Inventory Management](./inventory-management.md)
- [Financial Reporting](./financial-reporting.md)
