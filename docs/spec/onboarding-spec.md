# Spec: Onboarding v1 (Company Bootstrap + Guided First Value)

**Produk**: Sync ERP  
**Area**: Onboarding, Company Bootstrap, UX Gating, Seed Data  
**Status**: Draft siap implementasi  
**Tanggal**: 2026-05-04  
**Owner**: Product + Engineering  
**PRD**: `docs/prd/onboarding-prd.md`

## 1. Ringkasan

Spec ini mendefinisikan implementasi onboarding end-to-end dengan tujuan:

- user baru tidak masuk ke sistem kosong,
- company bootstrap selalu konsisten (business shape + default config + CoA siap posting),
- onboarding dapat di-resume,
- ada guided “first transaction” yang menghasilkan dampak nyata (stok/jurnal),
- UI core dikunci sampai onboarding selesai.

## 2. Terminologi

- **Business shape**: `RETAIL | MANUFACTURING | SERVICE`, saat ini tersimpan sebagai `Company.businessShape` (default `PENDING`).
- **Onboarding (v1)**: flow yang membawa company dari “baru dibuat” → “siap dipakai”.
- **Guided first transaction**: flow transaksi pertama yang dipandu dan dibatasi.

## 3. Kondisi Sistem Saat Ini (Baseline)

- `Company.businessShape` default `PENDING` dan setelah dipilih menjadi immutable.
- Pemilihan shape sudah memanggil seeding:
  - `seedSystemConfig(companyId, shape)`
  - `seedChartOfAccounts(companyId, shape)`
  - `AccountService.seedDefaultAccounts(companyId)`
- Frontend sudah punya:
  - `PendingShapeBanner` (jika `businessShape === PENDING`)
  - `OnboardingGuide` berbasis metrik (lebih mirip checklist, bukan gating)

Kesenjangan terhadap PRD:

- Belum ada state machine onboarding yang bisa di-resume.
- Belum ada hard gate untuk “opening balance” dan “first transaction”.
- Sidebar/menu tidak terkunci saat company belum siap.

## 4. Desain: State Model

### 4.1 Company Onboarding Status

Tambahkan ke database:

- `Company.onboardingStatus`:
  - `NOT_INITIALIZED`
  - `IN_PROGRESS`
  - `ACTIVE`
- `Company.onboardingStep`:
  - `WELCOME`
  - `BUSINESS_SHAPE`
  - `CONFIGURE_SYSTEM`
  - `OPENING_BALANCE`
  - `FIRST_TRANSACTION`
  - `ALIVE_MOMENT`
  - `DONE`
- `Company.onboardingCompletedAt` (`DateTime?`)

Catatan:

- Step `IDENTITY` dan `CORE_PRODUCT` tidak dimasukkan ke v1 state machine (opsional, bisa ditambahkan v1.1). PRD menyebutnya, tapi implementasi awal fokus ke gating yang berdampak ke konsistensi data.
- `Company.businessShape === PENDING` tetap dipakai sebagai gate tambahan.

### 4.2 Event Log Onboarding

Gunakan `AuditLog` yang sudah ada untuk event onboarding agar tidak menambah tabel baru di v1.

Event minimal (action string):

- `onboarding.started`
- `onboarding.step_completed`
- `onboarding.completed`
- `onboarding.abandoned`
- `onboarding.first_transaction_completed`

Field minimum (disimpan ke `AuditLog.metadata`):

- `companyId`
- `userId`
- `step`
- `idempotencyKey` (jika ada)
- `resultIds` (mis: purchaseOrderId, grnId, journalId)

## 5. Backend: Prisma Changes

### 5.1 Schema

Tambah enum:

- `CompanyOnboardingStatus`
- `CompanyOnboardingStep`

Tambah field ke `Company`:

- `onboardingStatus CompanyOnboardingStatus @default(NOT_INITIALIZED)`
- `onboardingStep CompanyOnboardingStep @default(WELCOME)`
- `onboardingCompletedAt DateTime?`

### 5.2 Migration

- Buat migration Prisma untuk field baru.
- Untuk company existing:
  - jika `businessShape != PENDING` dan company sudah punya data transaksi (heuristic optional) → set `ACTIVE`
  - default aman: `NOT_INITIALIZED` untuk semua company existing (karena produk belum release publik)

## 6. Backend: API / tRPC Contracts

Tambahkan router baru: `onboarding.router.ts` (atau extend `company.router.ts` bila ingin sederhana).

### 6.1 `onboarding.getState`

- Auth required.
- Output:
  - `companyId`
  - `businessShape`
  - `onboardingStatus`
  - `onboardingStep`
  - `blockedReason` (nullable string enum)
  - `nextAction` (nullable string enum)

### 6.2 `onboarding.start`

- Auth required, company membership required.
- Effect:
  - `onboardingStatus = IN_PROGRESS`
  - `onboardingStep = BUSINESS_SHAPE` jika shape masih `PENDING`
  - audit log `onboarding.started`
- Idempotent:
  - Jika sudah `IN_PROGRESS` atau `ACTIVE`, return state saat ini.

### 6.3 `onboarding.selectBusinessShape`

- Reuse `company.selectShape` yang sudah ada.
- Tambahkan wrapper yang:
  - memastikan `onboardingStatus == IN_PROGRESS`
  - setelah success:
    - set `onboardingStep = OPENING_BALANCE`
    - audit log step completed

### 6.4 `onboarding.submitOpeningBalance`

- Input:
  - `cash` number (>= 0)
  - `bank` number (>= 0)
  - `currency` optional (default IDR)
- Effect (idempotent):
  - membuat journal entry opening balance
  - membuat/menyetel bank account default jika diperlukan (jika sistem butuh objek akun bank)
  - set `onboardingStep = FIRST_TRANSACTION`
  - audit log step completed
- Idempotency:
  - pakai `IdempotencyKey` existing:
    - key: `onboarding:${companyId}:opening-balance`

### 6.5 `onboarding.runFirstTransactionRetail`

V1 fokus ke shape `RETAIL` (Manufacturing/Service menyusul).

- Preconditions:
  - `businessShape === RETAIL`
  - `onboardingStep === FIRST_TRANSACTION`
- Input minimal:
  - `supplierName`
  - `productName`
  - `quantity`
  - `unitPrice`
  - optional: `payNow` boolean
- Effect (orchestrated):
  - create partner supplier (idempotent by name, scoped by company)
  - create product (idempotent by name)
  - create purchase order
  - confirm purchase order
  - create GRN
  - post GRN
  - optional: create bill + payment (jika payNow)
  - set `onboardingStep = ALIVE_MOMENT`
  - audit log `onboarding.first_transaction_completed` + `resultIds`
- Idempotency:
  - key: `onboarding:${companyId}:first-transaction`

### 6.6 `onboarding.complete`

- Preconditions:
  - `onboardingStep === ALIVE_MOMENT`
- Effect:
  - `onboardingStatus = ACTIVE`
  - `onboardingStep = DONE`
  - `onboardingCompletedAt = now()`
  - audit log `onboarding.completed`

## 7. Frontend: Routing & Gating

### 7.1 Entry Gate

Semua route internal (kecuali onboarding) harus memaksa:

- jika user authenticated dan company selected:
  - jika `company.onboardingStatus != ACTIVE` → redirect ke `/onboarding`
  - jika `company.businessShape === PENDING` → redirect ke `/onboarding` (step business shape)

### 7.2 Layout Lock

Saat user berada di `/onboarding`:

- sidebar tidak dirender
- navigasi dibatasi
- back button hanya untuk step tanpa side-effect besar

### 7.3 Onboarding UI Screens (v1)

1. Welcome
2. Business shape picker
3. Configuring (loading UI, auto-advance setelah API selesai)
4. Opening balance form
5. First transaction guided (retail)
6. Alive moment

UI menggunakan komponen yang sudah ada semampunya:

- `Card`, `FormModal`, `CurrencyInput`, `Select`, dsb.

### 7.4 Integrasi dengan Dashboard

- Setelah onboarding `ACTIVE`, user diarahkan ke dashboard normal.
- `OnboardingGuide` tetap boleh ada sebagai “guide” lanjutan, tetapi tidak menjadi gate.

## 8. Idempotensi & Konsistensi Data

Aturan:

- Setiap step yang membuat data harus:
  - punya idempotency key,
  - aman saat retry,
  - aman saat user membuka 2 tab dan submit bersamaan (best-effort).

Sumber idempotency:

- Model `IdempotencyKey` yang sudah ada pada company.

## 9. Error Handling

Backend harus punya error code yang jelas (tRPC error):

- `FORBIDDEN` jika user bukan member company atau tidak punya role yang cukup
- `PRECONDITION_FAILED` jika step state tidak sesuai
- `CONFLICT` jika onboarding sudah `ACTIVE` tapi endpoint step dipanggil
- `BAD_REQUEST` untuk input invalid

Frontend:

- Jika API mengembalikan `PRECONDITION_FAILED`, UI harus refresh state dan redirect ke step yang benar.

## 10. Testing Strategy

### 10.1 Backend

- Integration test:
  - start onboarding → select shape → opening balance → first transaction → complete
  - opening balance idempotent (call 2x, tidak membuat journal dobel)
  - first transaction idempotent (call 2x, tidak membuat dokumen dobel)

### 10.2 Frontend

- Unit test routing gate:
  - user tidak bisa masuk `/dashboard` jika onboarding belum `ACTIVE`
  - user diarahkan ke `/onboarding` saat `businessShape === PENDING`

## 11. Rollout

Tambahkan feature flag:

- `ONBOARDING_V1_ENABLED=true`

Jika flag off:

- fallback ke behavior saat ini (banner + guide tanpa gating).

