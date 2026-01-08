<!--
SYNC IMPACT REPORT
Version: 3.3.0 -> 3.4.0 (MINOR - Added BusinessShape-Aware Feature Development)
Modified Principles:
- None
Added Sections:
- XXIII. BusinessShape-Aware Feature Development
Removed Sections:
- None
Templates requiring updates:
- spec-template.md ⚠ (add BusinessShape Integration section requirement)
- plan-template.md ✓ (no changes needed)
- tasks-template.md ✓ (no changes needed)
Follow-up TODOs:
- Update spec-template.md to include BusinessShape Integration as standard section
Last Updated: 2026-01-08
-->

# Sync ERP Constitution

> "Simplicity is the ultimate sophistication."

**Version**: 3.4.0 | **Ratified**: 2025-12-08 | **Last Amended**: 2026-01-08

---

## Definisi Istilah

| Istilah            | Definisi                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| **Controller**     | Lapisan HTTP boundary yang menerima request dan mengembalikan response. Tidak mengandung logika bisnis. |
| **Service**        | Unit orchestration yang mengkoordinasi Policy, Rules, dan Repository. Mengandung "why" dari operasi.    |
| **Repository**     | Lapisan akses data yang hanya tahu "how" berbicara ke database. Tidak mengandung logika bisnis.         |
| **Policy**         | Komponen yang menentukan "can this run?" berdasarkan business shape constraints.                        |
| **Rules**          | Pure business logic yang stateless dan testable.                                                        |
| **Saga**           | Serangkaian operasi transaksional dengan compensation logic.                                            |
| **State Machine**  | Alur status dokumen yang rigid dan tidak dapat dilanggar.                                               |
| **Business Shape** | Konfigurasi bisnis (contoh: TRADING vs SERVICE) yang mendikte semua logika downstream.                  |

---

## Fundamental Principles (Immutable)

### F-1. Single Source of Truth

1. Prisma schema **HARUS** menjadi sumber utama tipe data.
2. Types **HARUS** didefinisikan di `packages/shared`.
3. Frontend **DILARANG** mendefinisikan manual interface untuk API types.
4. Setiap API field baru **HARUS** ditambahkan ke Zod schema terlebih dahulu.

---

## Architectural Laws (Tidak Boleh Dilanggar)

### Part A: Technical Architecture

### I. Architecture & Dependency Flow

```text
apps/web ─HTTP→ apps/api ─Repository→ packages/database
    ↓               ↓                       ↓
packages/shared ←── packages/shared ←── (Prisma types)
```

**Dependency Rules:**

1. Frontend **HARUS** berinteraksi dengan Backend via HTTP/REST only.
2. Hanya `packages/database` yang **BOLEH** mengimport Prisma.
3. Dependency direction **HARUS** mengikuti: `apps/` → `packages/shared` → `packages/database`.
4. Circular dependencies **DILARANG**.
5. Internal dependencies **HARUS** menggunakan `workspace:*` protocol.

**Multi-Tenant Isolation:**

6. Semua query **HARUS** di-scope dengan `companyId`.
7. `companyId` **HARUS** diperoleh dari header `X-Company-Id`.
8. Cross-company data access **DILARANG** dalam kondisi apapun.

### II. Type System & Contracts

**Single Source of Truth:**

1. Runtime validation **HARUS** menggunakan Zod schemas di `packages/shared/types`.
2. Semua validators **HARUS** di-re-export dari `packages/shared/src/validators/index.ts`.
3. Type inference **HARUS** menggunakan `z.infer<typeof Schema>`.
4. Manual interface definitions untuk API types **DILARANG**.

**Schema-First Workflow (HARUS diikuti untuk API field baru):**

```text
1. Schema First  → Tambah field ke packages/shared/src/validators/*.ts
2. Export Type   → export type Input = z.infer<typeof Schema>
3. Frontend      → Import type dari @sync-erp/shared
4. Backend       → Service menerima validated data
5. Rebuild       → cd packages/shared && npm run build
```

**Rules:**

5. API field baru **HARUS** ada di Zod schema sebelum frontend/backend code.
6. Frontend types **HARUS** menggunakan `z.infer<typeof Schema>` dari shared.
7. Schema rebuild **HARUS** dilakukan setelah setiap perubahan schema.

### III. Layered Backend Architecture

| Layer          | Location                        | Responsibility            | Can Import                |
| :------------- | :------------------------------ | :------------------------ | :------------------------ |
| **Route**      | `src/routes/*.ts`               | URL → Controller mapping  | Controller, Middleware    |
| **Controller** | `src/modules/*/*.controller.ts` | HTTP Boundary, Validation | Service only              |
| **Service**    | `src/modules/*/*.service.ts`    | Orchestration ("Why")     | Policy, Rules, Repository |
| **Rules**      | `src/modules/*/*.rules/*.ts`    | Pure Business Logic       | None (Pure)               |
| **Policy**     | `src/modules/*/*.policy.ts`     | Shape Constraints         | Shared Constants only     |
| **Repository** | `src/modules/*/*.repository.ts` | Data Access               | `packages/database` only  |

**Separation of Concerns (Aturan Layer):**

1. Setiap layer **HARUS** memiliki tanggung jawab tunggal.
2. Route **DILARANG** mengandung logic apapun selain mapping URL ke Controller.
3. Controller **HARUS** hanya memanggil Service.
4. Controller **DILARANG** memanggil Repository secara langsung.
5. Controller **DILARANG** mengandung business logic.
6. Service **HARUS** menjadi satu-satunya tempat orchestration.
7. Service **HARUS** memeriksa Policy sebelum melakukan Action.
8. Policy **DILARANG** mengakses database.
9. Policy **DILARANG** bergantung pada persistence.
10. Repository **DILARANG** mengandung business logic.
11. Repository **DILARANG** mengatur transaction boundary.
12. Repository **DILARANG** melakukan validasi bisnis.

### III-A. Dumb Controller / Dumb Repository

> Repository knows _how_ to talk to the database, not _why_ a write is allowed.

**Layer Knowledge Matrix:**

| Layer      | Knows About                         | MUST NOT Know About         |
| ---------- | ----------------------------------- | --------------------------- |
| Controller | HTTP, auth, DTO                     | Business rules              |
| Service    | Use case, state rules, policy, saga | SQL, table shape            |
| Repository | Persistence, queries, locks         | State machine, policy, saga |
| Policy     | Business constraints                | DB, transactions            |

**Repository BOLEH melakukan:**

- SQL shape optimization
- Atomic guards (`balance: { gte: amount }`)
- Optimistic concurrency
- Row locking (`SELECT ... FOR UPDATE`)
- Aggregate-safe updates
- Transaction client support (`tx?: Prisma.TransactionClient`)

**Repository DILARANG melakukan:**

1. State logic: `if (invoice.status !== 'POSTED') throw new Error(...)`
2. Policy checks: `if (company.shape === 'SERVICE') throw new Error(...)`
3. Intent branching: `if (paymentType === 'REFUND') { ... } else { ... }`
4. Saga orchestration: `try { updateInvoice(); createJournal(); } catch { compensate(); }`

**Mental Test:**

> Jika logic ini dipindah dari Prisma ke raw SQL, apakah masih masuk akal di Repository?
>
> - **Ya** → **BOLEH** di Repository
> - **Tidak** → **HARUS** di Service atau Policy

### III-B. Database Error Encapsulation

1. Repository **HARUS** menangkap semua error database (Prisma Client errors).
2. Repository **HARUS** melempar _application-specific error_ (e.g., `RecordNotFound`, `ConstraintViolation`).
3. Service **DILARANG** menangkap atau mengimport Prisma types/errors secara langsung.
4. Raw database errors **DILARANG** bocor ke layer Service atau Controller.

**Rationale**: Memastikan Service layer agnostik terhadap database technology dan mencegah error kryptik bocor ke client.

### IV. Frontend Architecture

**Directory Structure:**

- `src/features/[domain]/` - Business logic (components, hooks, services, types)
- `src/components/ui/` - Generic UI atoms only

**Rules:**

1. Frontend components **DILARANG** menghitung derived business state.
2. UI **HARUS** murni merender `backendState`.
3. Error handling **HARUS** melalui Axios interceptor.
4. Per-page try-catch **DILARANG**.
5. Success feedback **HARUS** menggunakan `apiAction()` helper.
6. Direct `toast()` calls **DILARANG**.
7. Confirmation dialogs **HARUS** menggunakan `useConfirm()` hook.
8. `window.confirm()` **DILARANG**.

### V. Callback-Safe Services

1. Frontend services **HARUS** menggunakan standalone functions.
2. Object methods dengan `this` context **DILARANG**.

```typescript
// ✅ BENAR
export const svc = { getData };
async function getData() {...}

// ❌ SALAH
export const svc = {
  async getData() { this.x }  // 'this' akan hilang!
}
```

### VI. Build Verification

Sebelum menandai task sebagai complete:

1. **HARUS** menjalankan `npx tsc --noEmit` (zero errors).
2. **HARUS** menjalankan `npm run build` (sebelum merge).
3. Jika `packages/shared` dimodifikasi, **HARUS** rebuild: `cd packages/shared && npm run build`.
4. **HARUS** memeriksa `typecheck:watch` terminal jika sedang berjalan.

### VII. Modular Parity (Symmetry)

1. Domain yang berhubungan (Sales ↔ Procurement) **HARUS** mengimplementasi fitur equivalent.
2. Naming patterns **HARUS** identik across related domains.
3. UI layouts **HARUS** konsisten untuk operasi serupa.

### VIII. Performance by Design

**Preventing N+1:**

1. Repositories **HARUS** mendukung eager loading (`include` atau joins).
2. Frontend **DILARANG** fetch individual related records dalam loop.
3. Missing 1:1 relations yang trigger error toasts **HARUS** dihindari.
4. Patterns yang menyebabkan 404 error toasts untuk missing relations **DILARANG**.

### IX. The Apple-Like Standard

1. Business Shape **HARUS** mendikte semua downstream logic.
2. Core system **HARUS** driven by explicit rigid state machines.
3. Technical questions ke user **DILARANG**.
4. Configuration tables **HARUS** tersembunyi dari user interface.

### X. Single Direction of Truth

```text
UI → API → Controller → Service → Rules/Policy → Repository → DB
↑                                                             ↓
└──────────────────────── (Response) ─────────────────────────┘
```

1. Frontend **DILARANG** menjadi "key" atau source of truth.
2. Semua keputusan **HARUS** terjadi di Service/Rules.
3. Feature = Service + Rule, bukan Controller atau Route.
4. Onboarding adalah Config, bukan logic.

---

### Part B: Human Experience Philosophy

### XI. Human Interface & Design

**Simplicity & Clarity:**

1. Non-essential features **HARUS** dipotong tanpa kompromi.
2. User **DILARANG** bingung tentang "where am I?" atau "what do I do next?".
3. Visual aesthetic **HARUS** clean dan minimalist.
4. Designed lists **HARUS** digunakan, bukan generic tables.

**Human-Centered Design:**

5. Aplikasi **HARUS** pleasing to use dan terasa stable.
6. Complex ERP tasks **HARUS** dipecah menjadi linear, bite-sized steps (Wizards).
7. Smart suggestions **HARUS** disediakan untuk mengantisipasi user needs.

### XII. Privacy by Design

**Minimization & Transparency:**

1. Permission untuk sensitive interactions **HARUS** diminta secara explicit.
2. Alasan mengapa data dibutuhkan **HARUS** dijelaskan dengan jelas.
3. Data processing di client side **HARUS** diprioritaskan jika memungkinkan.

**Security:**

4. Role-Based Access Control (RBAC) **HARUS** diterapkan secara strict.
5. Sensitive business data **HARUS** diperlakukan sebagai confidential.

### XIII. Engineering Excellence

**Performance-First:**

1. UI **HARUS** tetap fluid (60fps).
2. Interactions **HARUS** terasa instant.
3. Heavy calculations **HARUS** di-background agar main thread tidak block.
4. Optimistic UI updates **HARUS** digunakan untuk network requests.

**Architecture & Quality:**

5. Code **HARUS** diorganisir dalam strict, decoupled modules.
6. Automated pipelines **HARUS** memverifikasi setiap commit.
7. Code **HARUS** clean, readable, dan standard-compliant.

### XIV. Development Standards (Non-Negotiables)

1. Interaksi apapun **DILARANG** membekukan UI (Zero-Lag Rule).
2. Alignment, spacing, dan typography **HARUS** konsisten (Pixel Perfection).
3. Unnecessary polling atau heavy background scripts **DILARANG** (Battery/Resource Minded).
4. Setiap feature **HARUS** memiliki accompanying tests.
5. Integration Tests **HARUS ADA** untuk business flows dan cross-layer logic.
6. Unit tests **BOLEH** untuk isolated pure logic di `rules/` jika beneficial.

---

### Part C: Testing & Data Integrity

### XV. Test Contract Compliance

1. Mock return values **HARUS** memenuhi semua implicit contracts yang diharapkan oleh consuming layers.
2. Mock **HARUS** menyertakan semua fields yang di-check oleh Policy/Service.
3. Semua repositories/services yang dipanggil **HARUS** di-mock.
4. Jika Policy memeriksa status, mock **HARUS** mengembalikan status yang valid.

**Contoh SALAH:**

```typescript
// ❌ Incomplete mock gagal di Policy layer
mockRepo.findOrder.mockResolvedValue({ id, items: [] });
// Error: "Order must be CONFIRMED" (Policy expects status field)
```

**Contoh BENAR:**

```typescript
// ✅ Complete mock memenuhi Policy requirements
mockRepo.findOrder.mockResolvedValue({
  id,
  items: [{ productId, quantity: 10, price: 100 }],
  status: 'CONFIRMED',
  partnerId: 'partner-1',
});
```

### XVI. Financial Precision (Decimal Handling)

1. Financial values **HARUS** menggunakan Decimal type.
2. Konversi ke Number **BOLEH** hanya untuk comparisons dan assertions.
3. Business calculations **HARUS** menggunakan `Decimal.js` library.

| Context               | Use                           |
| --------------------- | ----------------------------- |
| Database fields       | Prisma `Decimal` type         |
| Business calculations | `Decimal.js` library          |
| Test assertions       | `Number(value)` wrapper       |
| Display formatting    | `toFixed(2)` after conversion |

### XVII. Integration Test as Tracked Tasks

1. Integration tests **HARUS** dilacak menggunakan status markers.
2. Sequential business flows **HARUS** ditest dalam single test block.
3. Flows **DILARANG** dipecah ke multiple `it()` blocks.

**Status Notation:**

| Marker | Status      | Meaning                        |
| ------ | ----------- | ------------------------------ |
| `[ ]`  | TODO        | Test not started               |
| `[/]`  | In Progress | Test implementation ongoing    |
| `[x]`  | Finished    | Test passing, reviewed, merged |

**Contoh SALAH:**

```typescript
// ❌ Variables tidak persist across it() blocks
describe('Flow', () => {
  let orderId: string;
  it('Step 1', async () => {
    orderId = order.id;
  });
  it('Step 2', async () => {
    /* orderId undefined! */
  });
});
```

**Contoh BENAR:**

```typescript
// ✅ Single block untuk complete flow
it('Full P2P Flow: PO -> GRN -> Bill -> Post', async () => {
  const order = await createOrder();
  await confirmOrder(order.id);
  await processGRN(order.id);
  const bill = await createBill(order.id);
  await postBill(bill.id);
});
```

### XVIII. Schema is Source of Truth (Raw SQL)

1. Raw SQL queries **HARUS** menggunakan column names persis seperti di Prisma schema.
2. Table names **HARUS** menggunakan quoted PascalCase seperti di schema.
3. `prisma.model.deleteMany()` **HARUS** diprioritaskan daripada raw SQL.
4. Setiap `$executeRaw` **HARUS** di-double-check terhadap schema.

**Contoh SALAH:**

```typescript
// ❌ Wrong column name
prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "entryId" IN ...`;
// Error: ColumnNotFound (seharusnya "journalId")
```

**Contoh BENAR:**

```typescript
// ✅ Column name sesuai schema
prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN ...`;
```

### XIX. Seed Data Completeness

1. Seed files **HARUS** menyertakan semua data yang services harapkan ada saat runtime.
2. Chart of Accounts **HARUS** lengkap di seed.
3. System configs **HARUS** ada di base seed.
4. Default roles **HARUS** ada di base seed.

| Data Type         | Seed Location                      | Used By                      |
| ----------------- | ---------------------------------- | ---------------------------- |
| Chart of Accounts | `packages/database/prisma/seed.ts` | JournalService               |
| System Configs    | Base seed                          | PolicyService, ConfigService |
| Default Roles     | Base seed                          | AuthService                  |
| Test fixtures     | `test/fixtures/`                   | Integration tests            |

---

## Implementation Rules (Dapat Dievolusi)

### XX. Systematic Refactoring

1. Sebelum refactoring, **HARUS** search dulu: `grep -r "pattern" apps/ --include="*.tsx"`.
2. Semua occurrences **HARUS** diubah dalam single commit.
3. Setelah refactoring, **HARUS** verify zero remaining instances.
4. Commit **HARUS** satu per feature, bukan per session.

### XXI. Context-First & Anti-Method Bloat (Smart Coding)

1. Agent **HARUS** memahami full context file (via `view_file` atau `view_file_outline`) sebelum melakukan edit.
2. Agent **DILARANG** membuat method baru jika fungsionalitasnya tumpang tindih (>50%) dengan yang sudah ada.
3. Refactoring method existing **LEBIH DIUTAMAKAN** daripada membuat method baru (e.g., `updateV2`).
4. Jika logic baru unik tapi mirip, ekstrak shared logic ke private helper.

**Rationale**: Mencegah "fear-driven development" dimana AI takut mengubah kode lama dan memilih membuat duplikasi, yang merusak maintainability jangka panjang.

### XXII. The Golden Flow Standard

Semua Business Flow (transaksi) **HARUS** mengikuti struktur 4-Tahap standar ini:

1. **Prepare (Validation & Policy)**
   - Check input types (Zod).
   - Check business constraints (Policy).
   - Ensure state prerequisites (e.g., "PO must be CONFIRMED").

2. **Orchestrate (Saga/Steps)**
   - Define exact steps required (e.g., "Update Stock -> Create Journal -> Update Status").
   - Prepare data payloads for Repository.

3. **Execute (Repository Transaction)**
   - Perform atomic DB operations via Repository.
   - **HARUS** dalam satu transaction block jika multiple writes.

4. **Post-Process (Side Effects)**
   - Send notifications (Email/Slack).
   - Trigger async jobs (Webhooks).
   - Return clean DTO output.

**Rule**: Service method yang menangani transaksi **HARUS** terlihat jelas memisahkan 4 tahap ini.

### XXIII. BusinessShape-Aware Feature Development

Features **HARUS** dirancang dengan kesadaran penuh terhadap Business Shape:

1. **Universal Features**: Features yang logis untuk semua shapes (TRADING, SERVICE, HYBRID) **TIDAK BOLEH** di-gate.
   - Contoh: Rental (bisa rental barang fisik atau tools untuk service)
   - Contoh: Cash & Bank Management (semua bisnis butuh cash flow tracking)
   - Contoh: Partner Management (supplier/customer universal)

2. **Shape-Specific Features**: Features yang hanya masuk akal untuk shape tertentu **HARUS** di-gate dengan Policy check.
   - Contoh: Inventory Management (requires TRADING or HYBRID, not SERVICE)
   - Contoh: Service Ticketing (requires SERVICE or HYBRID, not pure TRADING)
   - Policy **HARUS** throw error yang jelas jika shape tidak kompatibel

3. **Adaptive UI**: Sidebar menu **HARUS** menyesuaikan berdasarkan businessShape dan data existence.
   - Menu item muncul **hanya jika**: (a) shape kompatibel DAN (b) ada data (atau toggle aktif)
   - Contoh: "Rental" menu muncul saat pertama kali rental item dibuat
   - Contoh: "Inventory" menu tidak muncul untuk SERVICE shape

4. **Shape-Aware Logic**: Service/Policy **HARUS** menggunakan businessShape untuk branching logic.
   - ✅ BENAR: `if (shape === BusinessShape.TRADING) { validatePhysicalInventory() }`
   - ❌ SALAH: Hardcode asumsi bahwa semua company punya inventory

5. **Spec Documentation**: Feature specs **HARUS** mendokumentasikan:
   - Bagaimana feature berinteraksi dengan setiap businessShape
   - Apakah feature di-gate atau universal
   - Sidebar placement dan visibility rules

**Rationale**: Mencegah feature bloat dan kebingungan user dengan menampilkan hanya menu/fitur yang relevan untuk business model mereka. Memastikan ERP tetap fleksibel tanpa memaksa semua company menggunakan semua fitur.

---

## Project Structure

```text
sync-erp/
├── apps/
│   ├── web/src/                    # Vite + React (State Projection)
│   └── api/src/                    # Express + TS (Orchestrator)
│       ├── routes/                 # Dumb Adapters
│       └── modules/[domain]/       # DOMAIN-FIRST STRUCTURE
│           ├── *.controller.ts     # HTTP Boundary
│           ├── *.service.ts        # Orchestrator
│           ├── *.policy.ts         # Shape Constraints
│           ├── *.rules/*.ts        # Pure Logic
│           └── *.repository.ts     # Data Access
```

---

## Governance

1. Constitution ini **HARUS** supersede semua preferensi lain.
2. Amendments **HARUS** melalui PR + team consensus.
3. Code reviews **HARUS** memverifikasi adherence terhadap principles.
4. Tooling: `npm` + `turbo` + `vite` (frontend) + `tsc` (backend).

---

## Tes Kualitas Konstitusi

Sebelum aturan dianggap final, **HARUS** lolos tes ini:

- [ ] Apakah bisa ditegakkan secara otomatis (lint, test, review)?
- [ ] Apakah satu aturan bisa ditafsirkan dua cara?
- [ ] Apakah kata normatifnya konsisten?
- [ ] Apakah aturan ini punya pengecualian tersembunyi?

Jika "ya" pada salah satu poin, tata bahasanya belum cukup baik.
