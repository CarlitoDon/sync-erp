# Implementation Plan: GRN & Shipment Fullstack

**Branch**: `034-grn-fullstack` | **Date**: 2025-12-18 | **Spec**: [spec.md](specs/034-grn-fullstack/spec.md)
**Input**: Integrated GRN (Goods Receipt Note) and Shipment (Delivery Note/Goods Issue) as symmetric physical inventory events.

## Summary

Implement fullstack Goods Receipt Note (P2P) and Shipment (O2C) modules to handle physical inventory movements (Stock IN/OUT), enforcing strict separation from financial documents (Bill/Invoice).

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 18+)
**Primary Dependencies**: Express, Prisma, React, Vitest, Zod
**Storage**: PostgreSQL (via Prisma)
**Testing**: Integration Tests (Full P2P and O2C flows), Unit Tests for Rules/Utils
**Target Platform**: Node.js Container / Static Web Setup
**Project Type**: Monorepo (Web + API + Shared)
**Performance Goals**: <500ms API response, instant Optimistic UI
**Constraints**: Audit-friendly (Stock Journal immutable), Strict 3-way match
**Scale/Scope**: Moderate throughput, High data integrity requirement

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Architecture**: Frontend ↔ Backend via HTTP only? Dependencies uni-directional?
- [x] **II. Contracts**: Shared types in `packages/shared`? Validators exported?
- [x] **III. Backend Layers**: Service checks `Policy` before Action? (Service → Policy → Repository)
- [x] **III-A. Dumb Layers**: Controller only calls service? Repository has no business logic?
- [x] **IV. Multi-Tenant**: ALL data isolated by `companyId`?
- [x] **V. Frontend**: UI is State Projection? No complex conditionals?
- [x] **VIII. Verification**: `npx tsc --noEmit` and `npm run build` will pass?
- [x] **IX. Schema-First**: New API fields added to Zod schema FIRST? Types use `z.infer`?
- [x] **X. Parity**: If Feature A exists in Sales, does it exist in Procurement? (and vice versa - YES, Symmetry is key here)
- [x] **XI. Performance**: No N+1 Client loops? Lists use Backend `include` for relations?
- [x] **XII. Apple-Standard**: Does logic derive from `BusinessShape`? No technical questions to user?
- [x] **XIII. Data Flow**: Is Frontend pure reflection? No local business state calculation?
- [x] **XIV-XVII. Human Experience**: Clear Navigation? Simplified Workflows? Performance-First? Pixel Perfect?
- [x] **XVIII. Test Contracts**: Mocks satisfy all Policy/Service layer expectations?
- [x] **XIX. Financial Precision**: Decimal for money? `Number()` in test assertions?
- [x] **XX. Integration State**: Sequential flows in single `it()` block?
- [x] **XXI. Schema for Raw SQL**: `$executeRaw` column names match Prisma schema?
- [x] **XXII. Seed Completeness**: All expected accounts/configs in seed files?

## Project Structure

### Documentation (this feature)

```text
specs/034-grn-fullstack/
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
├── web/                    # Frontend (Vite + React)
│   ├── src/features/
│   │   ├── inventory/      # Shared Inventory (Products, Stock)
│   │   │   ├── pages/      # Receipts/Shipments Lists
│   │   │   └── services/   # InventoryService (GRN/Shipment API)
│   │   ├── procurement/    # Purchase Orders (Linked to Receipts)
│   │   └── sales/          # Sales Orders (Linked to Shipments)
│
└── api/                    # Backend (Express)
    └── src/modules/
        ├── inventory/      # GRN/Shipment Logic (Service/Rules/Repo)
        ├── procurement/    # Purchase Contracts
        └── sales/          # Sales Contracts

packages/
├── database/prisma/schema.prisma  # Schema Updates (GoodsReceipt, Shipment)
└── shared/src/validators/index.ts # Zod Schemas
```

**Structure Decision**: Standard feature-module structure. Inventory module will house both GRN and Shipment logic to centralize Stock Journal interactions.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
|           |            |                                      |
