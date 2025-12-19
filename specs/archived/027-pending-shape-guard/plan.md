# Implementation Plan: PENDING Shape Guard

**Branch**: `027-pending-shape-guard` | **Date**: 2025-12-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/027-pending-shape-guard/spec.md`

## Summary

Implement a centralized middleware guard that blocks business operations when a company's `businessShape` is PENDING. Currently, shape checks are scattered across individual policies (Sales, Procurement, Inventory have them; Product, Journal don't). This creates gaps where operations can proceed without proper shape configuration.

**Technical Approach**: Express middleware applied at route level to check `req.company.businessShape !== 'PENDING'` before allowing write operations through.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js backend)  
**Primary Dependencies**: Express.js, Prisma  
**Storage**: PostgreSQL (via Prisma)  
**Testing**: Vitest  
**Target Platform**: Linux server (Docker container)  
**Project Type**: Monorepo (Turborepo)  
**Performance Goals**: <5ms additional latency per request  
**Constraints**: Must not break existing request flows; company already loaded in auth middleware  
**Scale/Scope**: Applies to all write endpoints (~30 routes)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Architecture**: Frontend ↔ Backend via HTTP only? Dependencies uni-directional? ✅ Backend-only feature
- [x] **II. Contracts**: Shared types in `packages/shared`? Validators exported? ✅ No new shared types needed
- [x] **III. Backend Layers**: Service checks `Policy` before Action? ✅ Middleware layer (before controller)
- [x] **IV. Multi-Tenant**: ALL data isolated by `companyId`? ✅ Check is company-scoped
- [N/A] **V. Frontend**: UI is State Projection? No complex conditionals? N/A - Backend only
- [x] **VIII. Verification**: `npx tsc --noEmit` and `npm run build` will pass? ✅ Must verify
- [N/A] **IX. Schema-First**: New API fields? N/A - No new API contracts
- [N/A] **X. Parity**: If Feature A exists in Sales/Procurement? N/A - Infrastructure middleware
- [x] **XI. Performance**: No N+1 Client loops? ✅ Single check, no DB queries
- [x] **XII. Apple-Standard**: Does logic derive from `BusinessShape`? ✅ Core principle of this feature
- [N/A] **XIII. Data Flow**: Is Frontend pure reflection? N/A - Backend only
- [N/A] **XIV-XVII. Human Experience**: N/A - Backend only (error message formatting is important)

**Gate Status**: ✅ PASSED - All applicable principles satisfied

## Project Structure

### Documentation (this feature)

```text
specs/027-pending-shape-guard/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal for this feature)
├── quickstart.md        # Phase 1 output
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
apps/api/src/
├── middlewares/
│   ├── auth.ts              # Existing: Loads company into req.company
│   └── shapeGuard.ts        # NEW: Blocks PENDING companies
├── routes/
│   ├── product.ts           # Apply guard middleware
│   ├── invoice.ts           # Apply guard middleware
│   ├── bill.ts              # Apply guard middleware
│   ├── salesOrder.ts        # Apply guard middleware (has policy check too)
│   ├── purchaseOrder.ts     # Apply guard middleware (has policy check too)
│   ├── inventory.ts         # Apply guard middleware (has policy check too)
│   ├── payment.ts           # Apply guard middleware
│   └── finance.ts           # Apply guard middleware (journal)
└── types/
    └── express.d.ts         # Ensure req.company typing exists
```

**Structure Decision**: Middleware in `apps/api/src/middlewares/shapeGuard.ts` following existing auth middleware pattern. Applied globally to write routes.

## Complexity Tracking

> No Constitution violations. Feature is infrastructure-level with minimal complexity.

| Aspect         | Complexity | Notes                                   |
| -------------- | ---------- | --------------------------------------- |
| Implementation | Low        | Single middleware function              |
| Integration    | Medium     | Must apply to all relevant routes       |
| Testing        | Low        | Simple unit + integration tests         |
| Risk           | Low        | Defense-in-depth (policy checks remain) |
