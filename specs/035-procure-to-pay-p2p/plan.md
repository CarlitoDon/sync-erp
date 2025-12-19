# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

**Language/Version**: TypeScript 5.0+ (Node.js 20 LTS)
**Primary Dependencies**: Express (Backend), Vite + React (Frontend), Prisma (ORM), Zod (Validation), Decimal.js (Finance)
**Storage**: PostgreSQL (via Prisma)
**Testing**: Vitest (Unit & Integration) - MANDATORY: Integration Tests for Business Flow
**Target Platform**: Linux container (Docker)
**Project Type**: Monorepo (Turborepo) - `apps/api` (Backend), `apps/web` (Frontend), `packages/shared`
**Performance Goals**: <200ms API response p95, Zero-Lag UI interactions
**Constraints**: Strict Multi-tenant isolation (`companyId`), 5-Layer Backend Architecture
**Scale/Scope**: P2P Module (PO, GRN, Bill, Payment)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [ ] **I. Architecture**: Frontend ↔ Backend via HTTP only? Dependencies uni-directional?
- [ ] **II. Contracts**: Shared types in `packages/shared`? Validators exported?
- [ ] **III. Backend Layers**: Service checks `Policy` before Action? (Service → Policy → Repository)
- [ ] **III-A. Dumb Layers**: Controller only calls service? Repository has no business logic?
- [ ] **IV. Multi-Tenant**: ALL data isolated by `companyId`?
- [ ] **V. Frontend**: UI is State Projection? No complex conditionals?
- [ ] **VI. Build Verification**: `npx tsc --noEmit` and `npm run build` will pass?
- [ ] **VII. Parity**: If Feature A exists in Sales, does it exist in Procurement?
- [ ] **VIII. Performance**: No N+1 Client loops? Lists use Backend `include` for relations?
- [ ] **IX. Apple-Standard**: Derived from `BusinessShape`? No technical questions to user?
- [ ] **X. Data Flow**: Frontend → API → Controller → Service → Rules/Policy → Repository → DB?
- [ ] **XI. Human Interface**: Clear Navigation? Simplified Workflows?
- [ ] **XIII. Engineering**: Zero-Lag UI? Optimistic Updates?
- [ ] **XV. Test Contracts**: Mocks satisfy all Policy/Service layer expectations?
- [ ] **XVI. Financial Precision**: `Decimal` for money? `Number()` in test assertions?
- [ ] **XVII. Integration State**: Sequential flows in single `it()` block?
- [ ] **XVIII. Schema for Raw SQL**: `$executeRaw` column names match Prisma schema?
- [ ] **XIX. Seed Completeness**: All expected accounts/configs in seed files?

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
apps/
├── web/                    # Frontend (Vite + React)
│   ├── src/
│   │   ├── app/            # Setup
│   │   ├── components/     # UI Atoms
│   │   ├── features/       # Business Domains ([domain] folders)
│   │   ├── hooks/          # Global Hooks
│   │   └── services/       # Global Services
│   └── vite.config.ts
│
└── api/                    # Backend (Express)
    ├── src/
    │   ├── routes/         # Entry points
    │   └── modules/        # Domain Modules
    │       └── [domain]/   # (Controller, Service, Policy, Repository)
    ├── scripts/            # Seeds & Tools
    └── tsconfig.json

packages/
├── database/               # Prisma
│   ├── prisma/schema.prisma
│   └── src/index.ts
│
├── shared/                 # Types & Utils
│   ├── src/
│   │   ├── types/
│   │   └── validators/     # Zod schemas (Single Source of Truth)
│   └── package.json
│
└── ui/                     # Shared Components
    └── src/components/
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
