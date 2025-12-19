# Feature Specification: Basic Dashboard

**Feature Branch**: `15-basic-dashboard`  
**Created**: 2025-12-13  
**Status**: Draft  
**Input**: User description: "implementasi fungsionalitas dashboard. buat yang basic dulu tapi indah dan berfungsi normal"

## User Scenarios & Testing

### User Story 1 - View Business Overview (Priority: P1)

Sebagai pengguna aplikasi, saya ingin melihat ringkasan kondisi bisnis saat membuka dashboard, sehingga saya dapat memahami status keuangan dan operasional perusahaan dengan cepat.

**Why this priority**: Dashboard adalah halaman utama yang dilihat pengguna setelah login. Overview metrics memberikan gambaran instan tentang kesehatan bisnis.

**Independent Test**: Dapat ditest dengan login ke aplikasi, memverifikasi bahwa card metrics (receivables, payables, inventory value, recent activity) tampil dengan data aktual dari database.

**Acceptance Scenarios**:

1. **Given** pengguna sudah login dan memiliki company aktif, **When** pengguna membuka halaman dashboard, **Then** sistem menampilkan 4 kartu ringkasan: Total Accounts Receivable, Total Accounts Payable, Inventory Value, dan Recent Activity.

2. **Given** perusahaan memiliki data invoice dan bill, **When** dashboard dimuat, **Then** angka yang ditampilkan sesuai dengan data aktual di database (receivables = sum of POSTED invoices balance, payables = sum of POSTED bills balance).

3. **Given** pengguna membuka dashboard, **When** data masih loading, **Then** sistem menampilkan skeleton/loading state yang informatif.

---

### User Story 2 - View Quick Stats (Priority: P2)

Sebagai pengguna, saya ingin melihat statistik cepat seperti jumlah order baru, invoice tertunda, dan bill yang perlu dibayar, sehingga saya tahu apa yang perlu ditindaklanjuti.

**Why this priority**: Memberikan insight actionable tentang item yang memerlukan perhatian segera.

**Independent Test**: Dapat ditest dengan memverifikasi bahwa angka statistik sesuai dengan jumlah record di database dengan filter status tertentu (DRAFT, PENDING, dll).

**Acceptance Scenarios**:

1. **Given** ada beberapa sales order dengan status berbeda, **When** dashboard dimuat, **Then** sistem menampilkan jumlah order yang masih pending/draft.

2. **Given** ada invoice dengan status POSTED, **When** dashboard dimuat, **Then** sistem menampilkan jumlah invoice yang belum dibayar.

---

### User Story 3 - View Recent Transactions (Priority: P3)

Sebagai pengguna, saya ingin melihat daftar transaksi terbaru (invoice, bill, payment), sehingga saya dapat mengikuti aktivitas bisnis terkini.

**Why this priority**: Memberikan visibility terhadap aktivitas terbaru tanpa perlu navigasi ke halaman lain.

**Independent Test**: Dapat ditest dengan memverifikasi bahwa list menampilkan 5-10 transaksi terakhir dengan informasi yang relevan (tanggal, tipe, amount).

**Acceptance Scenarios**:

1. **Given** ada berbagai transaksi dalam sistem, **When** dashboard dimuat, **Then** sistem menampilkan 5 transaksi terbaru dengan tipe, tanggal, dan jumlah.

---

### Edge Cases

- Apa yang terjadi jika perusahaan baru dibuat dan belum ada data? Sistem menampilkan state kosong dengan pesan informatif.
- Apa yang terjadi jika koneksi API gagal? Menampilkan error state dengan opsi retry.
- Apa yang terjadi jika data sangat besar? Metrics tetap responsif karena menggunakan aggregate queries.

## Requirements

### Functional Requirements

- **FR-001**: Sistem HARUS menampilkan Total Accounts Receivable (jumlah balance invoice POSTED).
- **FR-002**: Sistem HARUS menampilkan Total Accounts Payable (jumlah balance bill POSTED).
- **FR-003**: Sistem HARUS menampilkan Inventory Value (total value dari stock yang tersedia).
- **FR-004**: Sistem HARUS menampilkan jumlah pending orders (sales orders dengan status non-COMPLETED).
- **FR-005**: Sistem HARUS menampilkan jumlah unpaid invoices.
- **FR-006**: Sistem HARUS menampilkan jumlah unpaid bills.
- **FR-007**: Sistem HARUS menampilkan loading state saat data sedang diambil.
- **FR-008**: Sistem HARUS menampilkan empty state jika tidak ada data.
- **FR-009**: Sistem HARUS menampilkan 5 transaksi terbaru (mixed: invoices, bills, payments).
- **FR-010**: Dashboard HARUS refresh data setiap kali halaman dikunjungi.

### Key Entities

- **Dashboard Metrics**: Aggregated values (receivables, payables, inventory) - read-only computed from existing entities.
- **Invoice**: Existing entity - filtered by type=INVOICE, status=POSTED for receivables.
- **Bill**: Existing entity (Invoice with type=BILL) - filtered by status=POSTED for payables.
- **Stock Item**: Existing entity - aggregated for inventory value.
- **Order**: Existing entity - filtered for pending orders count.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Dashboard loads fully dalam waktu kurang dari 2 detik pada kondisi normal.
- **SC-002**: Metric values yang ditampilkan akurat 100% sesuai data aktual di database.
- **SC-003**: Pengguna dapat melihat overview bisnis tanpa perlu navigasi ke halaman lain.
- **SC-004**: Dashboard menampilkan visual yang menarik dengan card-based layout dan warna yang informatif.
- **SC-005**: Dashboard menangani empty state dan loading state dengan baik.

## Constitution Compliance

### Frontend Architecture Checklist

- [ ] **Feature Isolation**: Logic in `src/features` (not global pages/components)
- [ ] **Component Abstraction**: Any repeated UI pattern extracted to reusable `ui` component
- [ ] **Hook Abstraction**: Any repeated logic extracted to custom hook
- [ ] **No Copy-Paste**: No duplicate button styles, error handling, or API patterns
- [ ] **Global Error Handling**: Errors handled via Axios interceptor, not per-page try-catch
- [ ] **Success Toasts**: Using `apiAction()` helper, not direct toast imports
- [ ] **Confirmation Dialogs**: Using `useConfirm()` hook, not native `window.confirm()`
- [ ] **Systematic Updates**: All instances updated when changing patterns (grep verified)

## Assumptions

- Dashboard akan menggunakan backend API endpoints yang sudah ada untuk mengambil data (invoices, bills, orders, stock).
- Jika endpoint aggregation khusus tidak ada, frontend akan melakukan perhitungan dari data list.
- Design mengikuti style guide yang sudah ada di aplikasi (Tailwind CSS, card-based layout).
- Dashboard merupakan halaman home setelah login (route: `/` atau `/dashboard`).
