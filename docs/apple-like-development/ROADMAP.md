# ERP Apple-Like Roadmap: MVP → v1 → v2

> **Purpose**: Roadmap disiplin untuk tim kecil dengan prinsip Apple: **simple first, depth later**.

---

## Prinsip Roadmap (5 Binding Rules)

1. **Core logic dulu, UI belakangan**
2. **One business flow end-to-end > banyak fitur setengah jadi**
3. **Default works, advanced hidden**
4. **Config mengubah perilaku, bukan struktur**
5. **Tidak ada fitur tanpa owner module**

Jika satu fitur melanggar ini, tunda.

---

## Phase 0 — Foundation (SELESAI ✅)

**Ini bukan MVP, ini landasan. Jangan lompat.**

### Target

ERP kokoh secara struktur, meskipun fitur masih minim.

### Scope

| Area                   | Deliverable                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Project & Architecture | Monorepo, module-based backend, layer jelas (controller → service → rule → repository) |
| Company & Config       | Company, BusinessShape (Retail/Manufacturing/Service), SystemConfig                    |

**Output penting**: Semua service bisa membaca config.

---

## Phase 1 — MVP (ERP YANG "BERFUNGSI")

**Fokus Utama**: Barang masuk → Barang keluar → Uang tercatat

### 1. Master Data (Minimal)

| Entity    | Fields                                                     |
| --------- | ---------------------------------------------------------- |
| Product   | SKU, Name, Type (goods/service), Costing (AVG hardcoded)   |
| Warehouse | Single warehouse default, multi-warehouse belum diaktifkan |

### 2. Inventory (Movement-based)

| Feature                     | Status |
| --------------------------- | ------ |
| Stock IN (Purchase Receipt) | ✅ MVP |
| Stock OUT (Sales)           | ✅ MVP |
| Stock Adjustment (manual)   | ✅ MVP |
| Reservation                 | ❌ v1  |
| Batch/FIFO                  | ❌ v2  |
| Transfer                    | ❌ v1  |

**UI Apple-like**: Tampilkan `On Hand` saja. Jangan tampilkan ledger mentah.

### 3. Sales (Sederhana tapi Nyata)

```
Sales Order → Invoice → Payment
```

- Sales Order belum reserve stock
- Invoice langsung mengurangi stock
- Payment hanya status lunas/belum

### 4. Procurement (Mirror Sales)

```
Purchase Order → Goods Receipt → Supplier Invoice
```

- Goods Receipt → stock IN
- Supplier Invoice → accounting

### 5. Accounting (Minimal Viable Accounting)

| Feature                             | Status |
| ----------------------------------- | ------ |
| Chart of Accounts                   | ✅ MVP |
| Journal Entry                       | ✅ MVP |
| Auto-posting (Sales, Purchase, HPP) | ✅ MVP |
| Manual Journal UI                   | ❌ v1  |

### MVP Exit Criteria (TIDAK BOLEH DILANGGAR)

- [ ] Semua stock movement menghasilkan jurnal
- [ ] Tidak ada perhitungan HPP di frontend
- [ ] Tidak ada logic di controller
- [ ] Data bisa diaudit ulang dari DB

---

## Phase 2 — v1 (ERP YANG TERASA "PROFESSIONAL")

**User mulai percaya sistem.**

### 1. Onboarding (Masuk Sekarang, BUKAN di MVP)

Yang diatur:

- Business type
- Enable inventory reservation
- Enable multi-warehouse
- Accounting basis

Onboarding menulis ke `system_config`, tidak mengubah schema.

### 2. Inventory v1

| Feature                  | Rule                                            |
| ------------------------ | ----------------------------------------------- |
| Reservation              | Tidak mengubah qty, hanya mengubah availability |
| Available vs Reserved    | Display only                                    |
| Transfer antar warehouse | Full stock movement audit                       |

### 3. Sales v1

- Sales Order → reserve stock
- Approval flow (optional)
- Partial delivery

### 4. Accounting v1

- Trial Balance
- Period locking
- Basic financial report

### 5. Audit & Activity Log

Invisible feature: Siapa, kapan, dari modul apa.

---

## Phase 3 — v2 (ERP YANG DALAM, BUKAN RAMAI)

**Natural growth, bukan wajib.**

### 1. Costing Advanced

- FIFO
- Stock layer
- Per-product costing method

### 2. Manufacturing (Jika Dipilih)

- BOM
- Work Order
- Consume raw material
- Produce finished goods

### 3. Reporting Intelligence

- Margin per product
- Inventory aging
- Cash flow

**Apple-like rule**: Default report sedikit, custom report belakangan.

### 4. Extensibility

- Webhook
- API key
- Integration marketplace

---

## Ringkasan Roadmap

| Phase | Fokus                |
| ----- | -------------------- |
| 0     | Struktur & config    |
| 1     | Barang + uang        |
| 2     | Kontrol & kenyamanan |
| 3     | Kedalaman & skala    |

---

## Urutan Eksekusi yang Disarankan

- [x] **Phase 0: Foundation** — Struktur & config ✅
- [x] **Phase 1: MVP Core Flows** — Barang + uang (Inventory, Sales, Procurement, Accounting) ✅
- [ ] **Phase 2: v1 Professional** — Kontrol & kenyamanan
  1. Onboarding UI
  2. Reservation & multi-warehouse
  3. Approval flows
  4. Trial Balance & Period locking
- [ ] **Phase 3: v2 Depth** — Kedalaman & skala
  1. Advanced costing (FIFO)
  2. Manufacturing module
  3. Advanced reporting

---

_Document created: 2025-12-16_
_Verified against Apple Human Interface Guidelines and ERP best practices._
