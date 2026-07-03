# Sync ERP — Domain Context

## Glossary

### BusinessShape
Enum yang menentukan mode operasional sebuah perusahaan. Nilai:
- `PENDING` — state awal, semua operasi bisnis diblokir sampai shape dipilih (immutable setelah dipilih)
- `RETAIL` — jual barang fisik, stock tracking, AVG costing
- `MANUFACTURING` — inventory dengan WIP, FIFO costing, BOM
- `SERVICE` — tanpa physical stock, operasi berbasis jasa
- `RENTAL` — operasi sewa dengan rentable items, booking, return, overdue control

### Company
Entitas bisnis terpisah dengan data, user, dan BusinessShape sendiri. Setiap user bisa punya akses ke satu atau lebih Company.

### Onboarding
Proses state machine dari `NOT_INITIALIZED` → `ACTIVE`. Steps: WELCOME → BUSINESS_SHAPE → CONFIGURE_SYSTEM → OPENING_BALANCE → FIRST_TRANSACTION → ALIVE_MOMENT → DONE.

### State > CRUD
Prinsip arsitektur: UI adalah consequence dari backend state. Sistem digerakkan oleh state machines dan events, bukan data entry endpoints. Backend mendikte defaults, frontend hanya merefleksikan state.

### Decision Lives Once
Keputusan BusinessShape terjadi sekali dan mengontrol seluruh sistem. Tidak bisa diubah setelah company aktif.

### No Knobs
Configuration tables exist tapi tidak diekspos ke UI. Backend menentukan perilaku berdasarkan BusinessShape.

## Architecture Pillars

1. **Monorepo (Turborepo)** — apps: api, web, bot, mcp | packages: database, shared
2. **Hybrid Constructor Injection** — constructor dengan default instances, DI container untuk production wiring
3. **tRPC** — full-stack type-safe API layer
4. **Prisma + Postgres** — database ORM dan source of truth
5. **State machines over CRUD** — onboarding, order lifecycle, dll.
