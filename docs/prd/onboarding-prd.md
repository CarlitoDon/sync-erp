# PRD: Product Onboarding (From Empty Account → First Transaction)

**Produk**: Sync ERP  
**Area**: Onboarding, Company Bootstrap, UX Gating, Data Seeding  
**Status**: Draft untuk scoping eksekusi  
**Tanggal**: 2026-05-04  
**Owner**: Product + Engineering

## 1. Latar Belakang

Sync ERP sudah memiliki pondasi fitur inti (company, transaksi procurement/sales, jurnal, inventory) dan pipeline CI/CD yang stabil. Risiko terbesar untuk “siap dijual” bukan hanya fitur, tapi pengalaman first-run:

- user baru sering masuk ke sistem kosong lalu bingung harus mulai dari mana,
- banyak keputusan awal terlalu kompleks (akun, inventory, costing, dsb),
- tanpa guided path, tim support akan jadi “onboarding manual” untuk setiap customer.

Kita butuh onboarding yang:

- cepat (≤ 10 menit),
- opinionated (default yang benar),
- menghidupkan sistem dengan data nyata (bukan demo),
- memberi “aha moment” yang jelas,
- aman untuk multi-tenant dan konsisten state backend ↔ frontend.

Dokumen referensi internal yang sudah ada:

- Blueprint: `docs/apple-like-development/features/onboarding/BLUEPRINT.md`
- Flow diagram: `docs/apple-like-development/features/onboarding/FLOW-DIAGRAM.md`

PRD ini mengubah blueprint tersebut menjadi scope implementasi yang bisa dieksekusi dan diuji.

## 2. Problem Statement

Tanpa onboarding yang terstruktur:

- user baru gagal mencapai “first value” (contoh: stok/jurnal pertama),
- setup company menjadi tidak konsisten (misalnya business shape belum dipilih tetapi user sudah mencoba transaksi),
- data minimum (CoA, opening balance) tidak tercipta atau tercipta setengah,
- tim support harus mengarahkan langkah-langkah yang seharusnya otomatis,
- trial→paid conversion turun karena user tidak merasa “produk bekerja”.

## 3. Tujuan Produk

### Tujuan Utama

- Mengantarkan user baru dari kondisi kosong sampai transaksi pertama yang valid dan menghasilkan dampak nyata (stok/jurnal).
- Menstandardisasi bootstrap company (business shape + default accounts + policy minimal) agar semua modul bisa dipakai tanpa error.
- Mengurangi kebutuhan onboarding manual dari tim (lebih self-serve).

### Tujuan Pendukung

- Mengaktifkan gating UI: menu ERP tidak “membanjiri” user sebelum onboarding selesai.
- Menyediakan progres onboarding dan state machine yang bisa diobservasi (debuggable).

## 4. Non-Goals

- Redesign full UI seluruh modul.
- Billing & paywall (akan jadi PRD terpisah).
- Tutorial/academy panjang (video, dokumentasi marketing, dsb).
- Import data massal (CSV import) di tahap awal.
- Setup advanced accounting (lock period, approval flow, IFRS/GAAP settings).
- Advanced inventory config (multi-warehouse, batch/serial, dsb).

## 5. Persona Utama

### Persona 1: Owner UKM

Ingin cepat melihat “bisnisnya masuk” ke sistem tanpa belajar akuntansi.

### Persona 2: Finance/Admin

Butuh chart of accounts yang benar dan transaksi pertama menghasilkan jurnal yang rapi.

### Persona 3: Operations

Fokus ke stok / pembelian / penerimaan barang.

## 6. Prinsip Onboarding (Konstitusi)

1. Onboarding adalah produk, bukan tutorial.
2. Default > pilihan.
3. Satu layar = satu keputusan.
4. Jelaskan dampak, bukan mekanisme.
5. Onboarding harus bisa selesai ≤ 10 menit.

## 7. User Journey Target

### Journey A: New User → New Company → First Value

1. User registrasi/login dan masuk ke sistem.
2. User membuat company (nama).
3. User memilih business shape (Retail/Manufacturing/Service).
4. Sistem membuat konfigurasi default (CoA, costing, policies).
5. User mengisi data minimal:
   - produk pertama (optional),
   - opening cash/bank (wajib, boleh 0).
6. User melakukan transaksi pertama (guided):
   - Retail: purchase order → GRN → stok naik → jurnal tercatat.
7. User melihat “System is alive” screen dan masuk dashboard.

### Journey B: Existing User → Company Belum Complete

1. User login.
2. Jika company status masih “not initialized/pending shape”, user langsung diarahkan ke onboarding (bukan dashboard).

### Journey C: User Keluar di Tengah Onboarding

1. User menutup tab / logout.
2. Saat login ulang, sistem melanjutkan dari step terakhir yang completed.

## 8. Scope Pekerjaan

### 8.1 In Scope

#### A. Gating dan Routing

- Entry gate berbasis state company:
  - `ACTIVE` → dashboard normal
  - selain `ACTIVE` → masuk onboarding flow
- Menu/sidebar modul utama disembunyikan/di-lock selama onboarding.

#### B. Onboarding Flow (Screens)

Mengacu ke `FLOW-DIAGRAM.md`, minimal mencakup:

1. Welcome
2. Identity (role declaration) untuk personalisasi UI (soft personalization)
3. Business shape (hard gate)
4. Invisible configuration (auto)
5. Core data: product (optional)
6. Core data: opening cash/bank (hard gate)
7. First transaction guided (hard gate)
8. System alive moment
9. Transition to dashboard + unlock sidebar

#### C. Bootstrap Company

- Setelah business shape dipilih:
  - seed CoA template (default accounts lengkap)
  - set costing method default sesuai shape (mis: retail average, manufacturing FIFO)
  - enable modul minimal sesuai shape
  - ensure transaksi procurement/sales bisa dipost tanpa error

#### D. Data Integrity dan Idempotensi

- Step onboarding harus idempotent:
  - re-submit step yang sama tidak membuat duplikasi (mis: opening balance journal).
- Validasi backend agar company tidak bisa masuk state “ACTIVE” tanpa prerequisite terpenuhi.

#### E. Observability

- Event minimal:
  - onboarding_started
  - onboarding_step_completed (per step)
  - onboarding_abandoned
  - onboarding_completed
  - first_transaction_completed
- Semua event harus menyertakan `companyId`, `userId`, `step`, dan timestamp.

### 8.2 Out of Scope

- Integrations onboarding (WhatsApp, e-commerce, dsb) sebagai step wajib.
- Advanced sample data generator yang besar.

## 9. Functional Requirements

- **FR-001**: Sistem harus mengarahkan user ke onboarding ketika company belum siap dipakai.
- **FR-002**: Sistem harus memblok akses modul utama selama onboarding berlangsung (kecuali halaman yang dipakai onboarding).
- **FR-003**: User harus bisa membuat company baru dan langsung memulai onboarding.
- **FR-004**: User harus memilih business shape sebagai hard gate sebelum transaksi bisnis lain.
- **FR-005**: Setelah business shape dipilih, sistem harus melakukan seed default accounts lengkap.
- **FR-006**: User harus mengisi opening cash/bank (boleh 0) dan sistem membuat opening balance journal secara idempotent.
- **FR-007**: Sistem harus menyediakan guided “first transaction” yang menghasilkan:
  - stock movement valid (jika applicable),
  - journal entry valid,
  - document state valid (confirmed/posted sesuai flow).
- **FR-008**: Jika user keluar di tengah onboarding, sistem harus resume dari step terakhir.
- **FR-009**: Onboarding completion harus mengubah status company menjadi `ACTIVE` dan membuka akses UI normal.
- **FR-010**: Semua step completion harus tercatat (audit/event) agar bisa di-debug saat user bermasalah.

## 10. Non-Functional Requirements

- **NFR-001**: Onboarding end-to-end harus selesai ≤ 10 menit untuk user baru.
- **NFR-002**: Semua step mutations harus aman terhadap retry (idempotent) dan concurrency sederhana.
- **NFR-003**: Tidak boleh ada data “setengah jadi” yang menyebabkan modul core error (mis: account code missing).
- **NFR-004**: Onboarding harus bekerja untuk minimal 3 shape (Retail, Manufacturing, Service).
- **NFR-005**: UX harus tetap usable di mobile minimal untuk sampai step “system alive”.

## 11. State Model (High Level)

### Status Company (rekomendasi)

- `NOT_INITIALIZED`: company baru dibuat, belum mulai onboarding
- `PENDING_SHAPE`: belum memilih business shape
- `CONFIGURING`: sistem sedang seed akun/policy
- `ONBOARDING`: user sedang menjalankan step core data / transaksi pertama
- `ACTIVE`: onboarding selesai

### Onboarding Step (rekomendasi)

- `WELCOME`
- `IDENTITY`
- `BUSINESS_SHAPE`
- `CONFIGURE_SYSTEM`
- `CORE_PRODUCT`
- `OPENING_BALANCE`
- `FIRST_TRANSACTION`
- `ALIVE_MOMENT`
- `DONE`

## 12. UX Requirements

- Maks 1 primary action per layar.
- Tidak ada sidebar / settings saat onboarding.
- Back navigation hanya untuk step yang tidak membuat mutation besar (mis: identity dan business shape).
- Bahasa copy harus berbasis dampak (“stok bertambah”, “uang tercatat”), bukan istilah akuntansi internal.

## 13. Edge Cases

- Company sudah ada tapi shape belum dipilih → selalu dipaksa ke step business shape.
- Company memiliki data sebagian (mis: CoA seeded tapi opening balance belum) → resume ke step yang tepat.
- User tanpa permission (mis: member biasa) mencoba menyelesaikan onboarding → harus diblok atau diarahkan meminta owner/admin.
- Duplicate opening balance atau duplicate first transaction akibat retry → harus dicegah.

## 14. Success Metrics

- ≥ 70% user baru yang membuat company berhasil mencapai `onboarding_completed` dalam 24 jam.
- ≥ 50% user baru yang mencapai `onboarding_completed` berhasil membuat transaksi kedua dalam 7 hari.
- Penurunan tiket support “cara mulai” minimal 50% setelah onboarding rilis.
- 0 incident “missing default accounts” pada company baru yang sudah `ACTIVE`.

## 15. Risiko Utama

### Risiko Produk

- Onboarding terlalu panjang/terlalu banyak input → drop-off tinggi.
- Guided first transaction terlalu kaku → user merasa “dipaksa”.

### Risiko Teknis

- Idempotensi mutation (opening balance, seed accounts) belum solid.
- State machine tidak konsisten antara frontend dan backend.

## 16. Open Questions

- Apakah identity/role declaration benar-benar dibutuhkan pada v1 onboarding atau bisa ditunda?
- Untuk Manufacturing, transaksi pertama yang paling tepat: purchase → receive raw material atau langsung produksi sederhana?
- Apakah user boleh melewati first transaction (skip) dengan konsekuensi status company tetap bukan `ACTIVE`?

## 17. Rencana Delivery yang Disarankan

### Phase 1 — Gating + Business Shape + Seeding

- Entry gate dan penguncian sidebar.
- Business shape selection sebagai hard gate.
- Seed default accounts + policy minimal setelah shape dipilih.

### Phase 2 — Core Data + Opening Balance

- Step product optional + opening cash/bank hard gate.
- Jurnal opening balance idempotent.

### Phase 3 — First Transaction Guided + Completion

- Guided flow transaksi pertama per shape.
- “System alive” screen + transisi ke dashboard.

### Phase 4 — Observability + QA

- Event tracking dan audit minimal.
- Test coverage e2e minimal untuk 1 shape (Retail) dan 1 flow resume.

## 18. Definition of Done

- PRD disetujui.
- Onboarding gate aktif dan tidak mengganggu user/company yang sudah `ACTIVE`.
- User baru bisa selesai onboarding sampai `ACTIVE` dan menghasilkan transaksi pertama yang valid.
- Tidak ada duplikasi critical data (CoA seed, opening balance) pada retry.
- Event onboarding terekam dan bisa dipakai debugging.
- CI lulus dan deploy web/api berjalan via CI/CD.

