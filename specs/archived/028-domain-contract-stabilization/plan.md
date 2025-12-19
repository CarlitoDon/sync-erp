# Implementation Plan: Domain Contract Stabilization

**Branch**: `028-domain-contract-stabilization` | **Date**: 2025-12-17
**Spec**: [specs/028-domain-contract-stabilization/spec.md](spec.md)

## Summary

This feature stabilizes the backend domain contracts for core entities (Invoice, Bill, Sales Order, Purchase Order) by enforcing strict state machines, write protection rules, and policy-based validation before any UI development begins.

**Key Deliverables**:

1.  **State Machine Enforcement**: Explicit guards for all state transitions.
2.  **Write Protection**: Immutability for POSTED/VOID documents.
3.  **Policy Layer**: Shape-aware constraints (Retail/Service/Manufacturing).
4.  **Financial Integrity**: Explicit `businessDate` and queryable invariants.
5.  **Traceability**: Journal source references and audit logs.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Express, Zod, Prisma
**Storage**: PostgreSQL (via Prisma)
**Testing**: Vitest (Unit + Integration)
**Target Platform**: Node.js 20+ (Containerized)
**Project Type**: Monorepo (apps/api)
**Performance Goals**: N/A (Functional correctness first)
**Constraints**: Zero UI changes (Backend only)
**Scale/Scope**: 4 Core Entites (Invoice, Bill, SO, PO) + 3 Business Shapes

## Constitution Check

_GATE: Must pass before Phase 0 research._

- [x] **I. Architecture**: Backend logic only, exposed via API.
- [x] **II. Contracts**: Contracts defined in `packages/shared`.
- [x] **III. Backend Layers**: Enforcing Service → Policy flow.
- [x] **IV. Multi-Tenant**: All operations scoped by `companyId`.
- [x] **V. Frontend**: N/A (Backend only feature).
- [x] **VIII. Verification**: `tsc` and `vitest` will be main verification.
- [x] **IX. Schema-First**: New fields (`businessDate`) will be added to Zod.
- [x] **X. Parity**: Sales/Purchase and AR/AP implemented symmetrically.
- [x] **XI. Performance**: N/A (No new list queries).
- [x] **XII. Apple-Standard**: Logic driven by `BusinessShape`.
- [x] **XIII. Data Flow**: Strict usage of Service/Policy layers.
- [ ] **XIV-XVII. Human Experience**: N/A (Backend only).

## Project Structure

### Documentation

```text
specs/028-domain-contract-stabilization/
├── plan.md              # This file
├── research.md          # Clarification decisions
├── data-model.md        # Entity definitions & states
└── contracts/           # API schemas (if logic changes)
```

### Source Code

```text
apps/api/src/
├── modules/
│   ├── accounting/         # Invoice, Bill, Payment
│   │   ├── services/       # State transition logic
│   │   ├── policies/       # Shape constraints
│   │   └── rules/          # Invariant checks
│   │
│   └── sales/              # Sales Order
│       ├── services/
│       └── policies/
│
│   └── procurement/        # Purchase Order
│       ├── services/
│       └── policies/
```

**Structure Decision**: Using existing modular structure in `apps/api`. No new modules, just hardening existing ones.

## Complexity Tracking

N/A - Standard Clean Architecture implementation.
