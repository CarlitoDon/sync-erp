# Implementation Plan: Alur Operasional Rental Riil (Rental Flow Alignment)

**Branch**: `045-rental-flow-alignment` | **Date**: 2026-09-18 | **Spec**: [specs/045-rental-flow-alignment/spec.md](spec.md)

**Input**: Feature specification from `specs/045-rental-flow-alignment/spec.md`

## Summary

Menyelaraskan alur operasional sewa kasur Santi Living pada Sync ERP dengan SOP riil hasil grilling session:
1. **DRAFT & DP Booking**: Pembuatan pesanan awal tanpa penguncian nomor seri kasur fisik. Penguncian unit fisik (`RESERVED`) dilakukan saat DP ~30% diterima dan dikonfirmasi, otomatis memposting jurnal uang muka ke buku besar.
2. **Serah Terima & Pelunasan 70% di Lokasi**: Menghilangkan konsep security deposit tunai semu. Pelunasan sisa sewa 70% dicatat terpadu pada saat serah terima unit (`Release Units`), mengubah status order menjadi `ACTIVE` dan chip pembayaran menjadi `Lunas`, serta memposting jurnal pengakuan pendapatan sewa dan kliring uang muka.
3. **Fleksibilitas Perpanjangan (Full & Partial)**: Mendukung perpanjangan sebagian unit dengan pencatatan biaya tambahan armada ekstra penjemputan terpisah beserta jurnal pendapatannya.
4. **Pengembalian & Isolasi Unit**: Pemeriksaan fisik langsung saat unit dijemput. Unit bersih langsung kembali ke sirkulasi (`AVAILABLE`), sedangkan unit bernoda/rusak diarahkan ke `MAINTENANCE` dengan penagihan denda cuci langsung di tempat tanpa memotong deposit semu.

## Technical Context

**Language/Version**: TypeScript 5.3+ / Node.js 20+

**Primary Dependencies**: 
- Fastify / Express (via `apps/api`)
- tRPC v10 / TanStack Query
- React 18 / Tailwind CSS / Headless UI (via `apps/web`)
- Prisma ORM (via `packages/database`)
- Zod v3 (via `packages/shared`)
- Decimal.js for strict currency precision

**Storage**: PostgreSQL with Prisma Schema (Multi-tenant isolated by `companyId`)

**Testing**: Vitest (`npm test`), ESLint strict rules (`npm run lint`)

**Target Platform**: Linux server / macOS / Docker Web & API services

**Project Type**: Full-stack multi-package monorepo (Monorepo with `apps/api`, `apps/web`, `packages/shared`, `packages/database`)

**Performance Goals**: 
- Order state transitions complete in < 200ms p95.
- Double-entry journal balance verification executed in transactional boundary (< 50ms).

**Constraints**:
- Strict Zero-`any` TypeScript Policy across all layers.
- Strict multi-tenant data isolation scoped by `companyId`.
- No pseudo cash deposit requirements in Santi Living rental flows.

**Scale/Scope**: Santi Living operational scale (~10-50 rental transactions/day, ~200 active rental mattress units).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Compliance Status | Analysis & Evidence |
|------------------|-------------------|---------------------|
| **F-1. Single Source of Truth** | **PASS** | Semua tipe dan validator didefinisikan di `packages/shared/src/validators/rental.ts` dan di-infer via `z.infer`. Frontend mengimpor tipe dari `@sync-erp/shared`. |
| **I. Dependency Flow** | **PASS** | `apps/web` ─HTTP/tRPC→ `apps/api` ─Repository→ `packages/database`. Arah ketergantungan strictly unidirectional. |
| **II. Type System & Contracts** | **PASS** | Runtime validation menggunakan Zod schemas. Zero `any`. Unsafe casts dilarang keras. |
| **III. Multi-Tenant Isolation** | **PASS** | Semua query Prisma dan operasi tRPC di-scope dengan `companyId`. |
| **Double-Entry Accounting** | **PASS** | Seluruh transaksi keuangan (DP, pelunasan 70%, extension, denda cuci) menghasilkan jurnal seimbang (`debit === credit`) via `JournalRentalService`. |

## Project Structure

### Documentation (this feature)

```text
specs/045-rental-flow-alignment/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── rental-orders.contract.ts
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/shared/
└── src/
    └── validators/
        ├── rental.ts                    # Updated Zod schemas (Confirm, Release, Extend, Return)
        └── index.ts                     # Re-exports

packages/database/
└── prisma/
    └── schema.prisma                    # Rental models & enums verification

apps/api/
└── src/
    ├── modules/
    │   ├── accounting/
    │   │   └── services/
    │   │       ├── journal-rental.service.ts # Full double-entry methods (DP, release, return, ext)
    │   │       └── journal.service.ts        # Journal facade updates
    │   └── rental/
    │       ├── rental-order-fulfillment.service.ts # Confirm with DP, Release with 70% settlement
    │       ├── rental-order-lifecycle.service.ts   # Extend with partial selection & fleet fee
    │       ├── rental-return.service.ts            # Return with AVAILABLE/MAINTENANCE routing
    │       └── rental.policy.ts                    # Updated business policy checks
    └── trpc/
        └── routers/
            └── rental.router.ts                    # tRPC router endpoints

apps/web/
└── src/
    └── features/
        └── rental/
            ├── components/
            │   ├── RentalActionsCard.tsx           # Action triggers
            │   └── RentalPaymentStatusCard.tsx     # Payment chips & Lunas indicator
            ├── modals/
            │   ├── ConfirmOrderModal.tsx           # DP payment & serial allocation
            │   ├── UnitAssignmentModal.tsx         # Serah terima + 70% settlement input
            │   ├── ReturnModal.tsx                 # Return condition & on-the-spot damage billing
            │   └── RentalExtensionsCard.tsx        # Partial extension & extra fleet fee
            └── pages/
                └── RentalOrderDetail.tsx           # Order details view
```

## Complexity Tracking

> **No Constitution Violations Detected.** Standard architectural patterns (Zod schema-first, repository-service pattern, tRPC routing, dual-entry accounting) are strictly adhered to.
