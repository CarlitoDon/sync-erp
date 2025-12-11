# Implementation Plan: Integrasi Finance Accounting

**Branch**: `006-finance-integration` | **Date**: 2025-12-11 | **Spec**: [specs/006-finance-integration/spec.md](spec.md)
**Input**: Feature specification from `specs/006-finance-integration/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature implements the automation of financial journal entries for inventory movements, specifically Cost of Goods Sold (COGS) for Sales Shipments and Financial adjustments for Stock Corrections. It leverages the existing `JournalService` and `InventoryService` to ensure the General Ledger satisfies the accounting equation and provides accurate Profit & Loss reporting.

## Technical Context

**Language/Version**: TypeScript 5.3 (Node.js)
**Primary Dependencies**: Prisma (ORM), Express (API)
**Storage**: PostgreSQL
**Testing**: Jest (Unit/Integration)
**Target Platform**: Node.js Server
**Project Type**: Monorepo (apps/api, packages/shared)
**Performance Goals**: Journal creation must be synchronous within the transaction or strictly consistent.
**Constraints**: Must not break existing `InvoiceService` and `BillService` logic. "System Accounts" (Chart of Accounts) must exist.
**Scale/Scope**: Backend implementation only. No frontend changes expected (other than verifying reports).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Boundaries**: Logic stays in `apps/api/src/services`. No Frontend imports.
- [x] **II. Dependencies**: `InventoryService` → `JournalService` (Service-to-Service is allowed within API).
- [x] **III. Contracts**: Using `packages/shared` types for Journal Inputs.
- [x] **IV. Layered Backend**: Logic in Services.
- [x] **V. Multi-Tenant**: All queries use `companyId`.

## Project Structure

### Documentation (this feature)

```text
specs/006-finance-integration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - Internal Logic)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
apps/
└── api/
    └── src/
        └── services/
            ├── FulfillmentService.ts   # [VERIFY] Trigger Journal or delegate
            ├── InventoryService.ts     # [MODIFY] Add Journal Calls
            └── JournalService.ts       # [MODIFY] Add postShipment/postAdjustment methods

packages/
└── shared/
    └── src/types/
        └── finance.ts                  # [VERIFY] Ensure types exist
```

**Structure Decision**: Extending existing Services. No new Services or Modules required.

## Complexity Tracking

_None required. Standard Service extension._
