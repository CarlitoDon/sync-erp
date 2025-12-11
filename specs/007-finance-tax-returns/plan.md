# Implementation Plan: Finance Tax, Returns & Accruals

**Branch**: `007-finance-tax-returns` | **Date**: 2025-12-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-finance-tax-returns/spec.md`

## Summary

Implement comprehensive tax handling and sales return reversals. This includes supporting VAT (PPN) selection (0%, 11%, 12%) for both Sales and Purchases, splitting invoice journals into Revenue/Tax Liability, and automating COGS reversal for sales returns.

## Technical Context

**Language/Version**: TypeScript 5.3+ (Node.js 18+)
**Primary Dependencies**: Express, Prisma, React 18, Vite
**Storage**: PostgreSQL (via Prisma)
**Testing**: Vitest
**Target Platform**: Web (Vite Frontend, Express Backend)
**Project Type**: Monorepo (Turbo)
**Performance Goals**: Journal posting < 500ms
**Constraints**: Zero variance in financial reconciliation
**Scale/Scope**: Feature-level update, touching Finance/Inventory modules

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Boundaries**: Frontend strictly avoids calls to Prisma/DB.
- [x] **II. Dependencies**: Uni-directional flow (Service -> Shared -> DB).
- [x] **III. Contracts**: Shared types will be used for Requests/Responses.
- [x] **IV. Layered Backend**: Logic resides in Services (`InvoiceService`, `JournalService`).
- [x] **V. Multi-Tenant**: All updates include `companyId` context.

## Project Structure

### Documentation (this feature)

```text
specs/007-finance-tax-returns/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
apps/
├── web/
│   └── src/
│       ├── pages/finance/
│       │   ├── InvoiceCreatePage.tsx    # Update (Tax Selection)
│       │   └── BillCreatePage.tsx       # Update (Tax Selection)
│       └── services/                    # Api Clients
│
└── api/
    └── src/
        ├── services/
        │   ├── InvoiceService.ts        # Update (Subtotal/Tax calc)
        │   ├── JournalService.ts        # Update (Posting methods)
        │   ├── InventoryService.ts      # Update (Goods Receipt Accrual)
        │   ├── SalesOrderService.ts     # Update (Return logic)
        │   └── BillService.ts           # Update (Tax posting)
        └── routes/                      # API Routes

packages/
├── database/
│   └── prisma/schema.prisma             # Schema updates (Invoice/Bill fields)
└── shared/
    └── src/types/                       # Shared DTOs (TaxRate Enum?)
```

**Structure Decision**: Standard Monorepo structure. Updates centered on `apps/api/services` for logic and `packages/database` for schema. Frontend updates limited to Forms for Tax Selection.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      |            |                                      |
