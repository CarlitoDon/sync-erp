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

**Language/Version**: TypeScript 5.3+
**Primary Dependencies**: Express.js, React 18, Zod, @sync-erp/shared
**Storage**: PostgreSQL (via Prisma)
**Testing**: Vitest
**Target Platform**: Web (Vite)
**Project Type**: Monorepo (Apps + Packages)
**Performance Goals**: < 100ms API response for auth endpoints
**Constraints**: Standard security (HTTP-only cookies), stateless backend
**Scale/Scope**: Core module, impacts all users

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Boundaries**: Does Frontend strictly avoid direct DB/Logic imports?
- [x] **II. Dependencies**: Are dependencies uni-directional (Apps -> Packages)?
- [x] **III. Contracts**: Are shared types defined in `packages/shared-types`?
- [x] **IV. Layered Backend**: Is logic strictly in Services (not Routes)?
- [x] **V. Multi-Tenant**: Is ALL data isolated by `companyId`?

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
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/       # API clients
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
