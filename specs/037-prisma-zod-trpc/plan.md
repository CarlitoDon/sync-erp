# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [MANDATORY: Integration Tests (Business Flow), unit tests optional]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [ ] **I. Dependency**: Frontend ↔ Backend via HTTP only? Apps → Packages?
- [ ] **I. Multi-Tenant**: ALL data isolated by `companyId`?
- [ ] **II. Type System**: Shared types in `packages/shared`? Types use `z.infer`?
- [ ] **III. Backend Layers**: Service checks `Policy` before Action? (Service → Policy → Repository)
- [ ] **III-A. Dumb Layers**: Controller only calls service? Repository has no business logic?
- [ ] **IV. Frontend**: Logic in `src/features`? UI is State Projection?
- [ ] **V. Callback-Safe**: Services export standalone functions?
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
- [ ] **XXI. Anti-Bloat**: Reuse existing methods? No redundant method creation?

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

## Governance Update (Constitution v3.2.0)

| Principle | Change | Rationale                                    |
| --------- | ------ | -------------------------------------------- |
| XXI       | ADDED  | Anti-Method Bloat Rule - Enforce code reuse. |

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
