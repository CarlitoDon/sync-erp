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
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [ ] **I. Architecture**: Frontend ↔ Backend via HTTP only? Dependencies uni-directional?
- [ ] **II. Contracts**: Shared types in `packages/shared`? Validators exported?
- [ ] **III. Backend Layers**: Controller → Service → Repository pattern?
- [ ] **IV. Multi-Tenant**: ALL data isolated by `companyId`?
- [ ] **V. Frontend**: Business logic in `src/features/`? Global patterns followed?
- [ ] **VIII. Verification**: `npx tsc --noEmit` and `npm run build` will pass?
- [ ] **IX. Schema-First**: New API fields added to Zod schema FIRST? Types use `z.infer`?
- [ ] **X. Parity**: If Feature A exists in Sales, does it exist in Procurement? (and vice versa)
- [ ] **XI. Performance**: No N+1 Client loops? Lists use Backend `include` for relations?

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
│   │   ├── features/       # Business Domains
│   │   ├── hooks/          # Global Hooks
│   │   └── services/       # Global Services
│   └── vite.config.ts
│
└── api/                    # Backend (Express)
    ├── src/
    │   ├── routes/         # Entry points
    │   ├── services/       # Business logic
    │   └── middlewares/
    └── tsconfig.json

packages/
├── database/               # Prisma
│   ├── prisma/schema.prisma
│   └── src/index.ts
│
├── shared/                 # Types & Utils
│   ├── src/
│   │   ├── types/
│   │   └── validators/     # Zod schemas
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
