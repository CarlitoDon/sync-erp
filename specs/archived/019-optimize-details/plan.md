# Implementation Plan: Enhanced Detail Pages & Linkage

**Branch**: `019-optimize-details` | **Date**: 2025-12-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/019-optimize-details/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement and optimize detail pages for Sales, Procurement, Finance, and Inventory modules.

- **New Pages**: `CustomerDetail`, `SupplierDetail`, `ProductDetail`, `JournalDetail`.
- **Optimization**: Add extensive cross-linking (Order ↔ Invoice ↔ Partner ↔ Product) to enable "One-Click Audit" workflows.
- **Performance**: Ensure all detail pages use backend `include` (Eager Loading) to avoid N+1 fetching of related entities.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Node.js 20
**Primary Dependencies**: `react-router-dom`, `@sync-erp/shared`, `axios`
**Storage**: Postgres (Prisma ORM)
**Testing**: Manual Verification (as per current workflow)
**Target Platform**: Web (Chrome/Safari)
**Project Type**: Monorepo (Turbo) - Web + API
**Performance Goals**: < 100ms navigation (SPA), < 500ms data load (single query)
**Constraints**: Must strictly follow "Parity Principle" (Sales/Procurement symmetry).
**Scale/Scope**: 8 Pages impacted (4 New, 4 Refactor).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Architecture**: Frontend ↔ Backend via HTTP only? Dependencies uni-directional?
- [x] **II. Contracts**: Shared types in `packages/shared`? Validators exported?
- [x] **III. Backend Layers**: Controller → Service → Repository pattern?
- [x] **IV. Multi-Tenant**: ALL data isolated by `companyId`?
- [x] **V. Frontend**: Business logic in `src/features/`? Global patterns followed?
- [x] **VIII. Verification**: `npx tsc --noEmit` and `npm run build` will pass?
- [x] **IX. Schema-First**: New API fields added to Zod schema FIRST? Types use `z.infer`?
- [x] **X. Parity**: If Feature A exists in Sales, does it exist in Procurement? (and vice versa)
- [x] **XI. Performance**: No N+1 Client loops? Lists use Backend `include` for relations?

## Project Structure

### Documentation (this feature)

```text
specs/019-optimize-details/
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
│   ├── src/
│   │   ├── app/
│   │   │   └── App.tsx              # Add new Routes here
│   │   ├── features/
│   │   │   ├── sales/pages/         # Add CustomerDetail.tsx
│   │   │   ├── procurement/pages/   # Add SupplierDetail.tsx
│   │   │   ├── inventory/pages/     # Add ProductDetail.tsx
│   │   │   └── finance/pages/       # Add JournalDetail.tsx
│   │   └── services/api.ts
│
└── api/
    ├── src/
    │   ├── modules/
    │   │   ├── partners/            # Needs findById endpoint
    │   │   ├── inventory/           # Needs findById endpoint
    │   │   └── finance/             # Needs findById endpoint
    │   └── routes/
```

**Structure Decision**: Standard feature-based structure. New pages go into their respective feature directories. Routes added to main `App.tsx` (or route config). Backend requires ensuring `findById` endpoints exist and support `include` for history.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      |            |                                      |
