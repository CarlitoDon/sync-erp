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
     ↘ CANCELLED
```

### API Reference

| Method | Endpoint                           | Deskripsi                   |
| ------ | ---------------------------------- | --------------------------- |
| `POST` | `/api/purchase-orders`             | Buat PO baru (status DRAFT) |
| `GET`  | `/api/purchase-orders`             | List semua PO               |
| `GET`  | `/api/purchase-orders/:id`         | Detail PO                   |
| `POST` | `/api/purchase-orders/:id/confirm` | Confirm PO                  |
| `POST` | `/api/purchase-orders/:id/cancel`  | Cancel PO                   |

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
| **Save**             | GRN dibuat dengan status `DRAFT`                    |
| **Post**             | Klik `Post GRN` → Status = `POSTED`, stok bertambah |

### Hasil

- ✅ Stok inventory bertambah sesuai qty yang diterima
- ✅ PO status berubah: `PARTIALLY_RECEIVED` atau `RECEIVED`
- ✅ GRN siap dijadikan dasar untuk Bill

### Status Transitions

```
DRAFT → POSTED → VOIDED
```

### Partial Receiving Scenario

Jika barang datang bertahap, setiap pengiriman harus dibuat GRN terpisah:

```
PO: 100 units Widget
    ├── GRN-001: 40 units (PO status → PARTIALLY_RECEIVED)
    ├── GRN-002: 35 units (PO status → PARTIALLY_RECEIVED)
    └── GRN-003: 25 units (PO status → RECEIVED) ✓ Complete
```

### Validation Rules

- ❌ Tidak bisa buat GRN kalau PO masih `DRAFT`
- ❌ Tidak bisa menerima qty lebih dari sisa qty di PO
- ❌ Tidak bisa post GRN jika sudah pernah di-void

### API Reference

| Method | Endpoint                       | Deskripsi                    |
| ------ | ------------------------------ | ---------------------------- |
| `POST` | `/api/goods-receipts`          | Buat GRN baru (status DRAFT) |
| `GET`  | `/api/goods-receipts`          | List semua GRN               |
| `GET`  | `/api/goods-receipts/:id`      | Detail GRN                   |
| `POST` | `/api/goods-receipts/:id/post` | Post GRN (update stok)       |
| `POST` | `/api/goods-receipts/:id/void` | Void GRN (rollback stok)     |

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
- ✅ Jurnal akuntansi otomatis dibuat

### Journal Entry (saat Post)

| Account             | Debit    | Credit   |
| ------------------- | -------- | -------- |
| Inventory / Expense | Rp X.XXX | -        |
| Accounts Payable    | -        | Rp X.XXX |

### Status Transitions

```
DRAFT → POSTED → PARTIALLY_PAID → PAID
     ↘ VOIDED
```

### Validation Rules

- ❌ Tidak bisa buat Bill kalau belum ada GRN (barang harus sudah diterima)
- ❌ Tidak bisa post Bill kalau data tidak matching dengan GRN
- ❌ Tidak bisa void Bill yang sudah ada payment

### API Reference

| Method | Endpoint              | Deskripsi                     |
| ------ | --------------------- | ----------------------------- |
| `POST` | `/api/bills`          | Buat Bill baru (status DRAFT) |
| `GET`  | `/api/bills`          | List semua Bills              |
| `GET`  | `/api/bills/:id`      | Detail Bill                   |
| `POST` | `/api/bills/:id/post` | Post Bill (create AP)         |
| `POST` | `/api/bills/:id/void` | Void Bill (reverse AP)        |

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
- ✅ Jurnal akuntansi otomatis dibuat

### Journal Entry (saat Payment)

| Account          | Debit    | Credit   |
| ---------------- | -------- | -------- |
| Accounts Payable | Rp X.XXX | -        |
| Bank / Cash      | -        | Rp X.XXX |

### Status Transitions

```
PENDING → COMPLETED → VOIDED
```

### Validation Rules

- ❌ Tidak bisa bayar Bill yang masih `DRAFT`
- ❌ Tidak bisa bayar melebihi outstanding amount
- ❌ Tidak bisa void payment jika Bill sudah fully paid dan closed

### API Reference

| Method | Endpoint                 | Deskripsi              |
| ------ | ------------------------ | ---------------------- |
| `POST` | `/api/payments`          | Record payment baru    |
| `GET`  | `/api/payments`          | List semua payments    |
| `GET`  | `/api/payments/:id`      | Detail payment         |
| `POST` | `/api/payments/:id/void` | Void payment (reverse) |

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
    ├── [Post] → Status jadi POSTED, stok bertambah
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

### Validasi 3-Way Matching

| Check     | PO vs GRN        | GRN vs Bill             |
| --------- | ---------------- | ----------------------- |
| **Qty**   | GRN qty ≤ PO qty | Bill qty = GRN qty      |
| **Harga** | -                | Bill price = PO price   |
| **Total** | -                | Bill total = calculated |

---

## Cancellation & Rollback Flows

### Cancel Purchase Order

```
Kondisi: PO harus status CONFIRMED dan belum ada GRN
Aksi:    PO status → CANCELLED
Efek:    Tidak ada efek ke inventory atau AP
```

### Void Goods Receipt (GRN)

```
Kondisi: GRN sudah POSTED tapi belum ada Bill yang linked
Aksi:    GRN status → VOIDED
Efek:    Stok inventory berkurang (rollback)
         PO status di-recalculate (bisa kembali ke CONFIRMED/PARTIALLY_RECEIVED)
```

### Void Bill

```
Kondisi: Bill sudah POSTED tapi belum ada Payment
Aksi:    Bill status → VOIDED
Efek:    AP di-reverse (jurnal kebalikannya)
         GRN masih intact, bisa di-bill ulang
```

### Void Payment

```
Kondisi: Payment sudah COMPLETED
Aksi:    Payment status → VOIDED
Efek:    Bill status kembali ke POSTED atau PARTIALLY_PAID
         Saldo Bank/Cash dikembalikan
         AP balance dikembalikan
```

---

## Error Scenarios & Handling

### Saat Buat GRN

| Error Code | Message                 | Solusi                              |
| ---------- | ----------------------- | ----------------------------------- |
| `E001`     | PO belum CONFIRMED      | Confirm PO terlebih dahulu          |
| `E002`     | Qty melebihi sisa PO    | Kurangi qty atau cek PO yang benar  |
| `E003`     | PO sudah CANCELLED      | Tidak bisa receive, gunakan PO lain |
| `E004`     | Product tidak ada di PO | Cek product yang benar              |

### Saat Buat Bill

| Error Code | Message                           | Solusi                             |
| ---------- | --------------------------------- | ---------------------------------- |
| `E101`     | Belum ada GRN untuk PO ini        | Buat GRN terlebih dahulu           |
| `E102`     | GRN sudah di-bill                 | Cek Bill yang sudah ada            |
| `E103`     | Qty/Price tidak match dengan GRN  | Sesuaikan dengan data GRN          |
| `E104`     | Supplier invoice number sudah ada | Gunakan nomor invoice yang berbeda |

### Saat Post Bill

| Error Code | Message              | Solusi                           |
| ---------- | -------------------- | -------------------------------- |
| `E201`     | Bill masih DRAFT     | Post Bill terlebih dahulu        |
| `E202`     | Data tidak lengkap   | Lengkapi semua required fields   |
| `E203`     | 3-Way matching gagal | Cek kesesuaian PO, GRN, dan Bill |

### Saat Payment

| Error Code | Message                           | Solusi                         |
| ---------- | --------------------------------- | ------------------------------ |
| `E301`     | Bill belum POSTED                 | Post Bill terlebih dahulu      |
| `E302`     | Amount melebihi outstanding       | Kurangi amount payment         |
| `E303`     | Bank account insufficient balance | Pilih account lain atau top-up |
| `E304`     | Bill sudah PAID                   | Tidak perlu payment lagi       |

---

## Status Summary

| Dokumen     | Draft   | Confirmed/Posted | In Progress          | Complete    | Cancelled/Voided |
| ----------- | ------- | ---------------- | -------------------- | ----------- | ---------------- |
| **PO**      | `DRAFT` | `CONFIRMED`      | `PARTIALLY_RECEIVED` | `RECEIVED`  | `CANCELLED`      |
| **GRN**     | `DRAFT` | `POSTED`         | -                    | -           | `VOIDED`         |
| **Bill**    | `DRAFT` | `POSTED`         | `PARTIALLY_PAID`     | `PAID`      | `VOIDED`         |
| **Payment** | -       | `PENDING`        | -                    | `COMPLETED` | `VOIDED`         |

---

## Anti-Patterns (Harus Dihindari)

| ❌ Anti-Pattern                      | ✅ Correct Pattern                            |
| ------------------------------------ | --------------------------------------------- |
| Membuat Bill langsung tanpa PO/GRN   | Bill harus dari GRN yang valid                |
| Membuat GRN dari PO yang masih DRAFT | GRN hanya dari PO yang CONFIRMED              |
| Membayar invoice yang belum di-post  | Payment hanya untuk Bill yang POSTED          |
| Partial receiving tanpa tracking     | Setiap partial receive harus ada GRN terpisah |
| Stok bertambah saat PO dibuat        | Stok bertambah saat GRN di-POST               |
| Void Bill yang sudah ada payment     | Void payment dulu, baru void Bill             |
| Edit GRN setelah Bill dibuat         | Void Bill, edit GRN, buat Bill baru           |

---

## Related Documents

- [Order-to-Cash (O2C) Flow](./order-to-cash-o2c.md)
- [Inventory Management](./inventory-management.md)
- [Financial Reporting](./financial-reporting.md)
