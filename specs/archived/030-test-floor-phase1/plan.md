# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a robust "Test Floor" for Phase 1, focusing on prohibiting invalid states (Invariants) and ensuring Saga reliability.
Key components:

1. **Invariant Test Suite**: New test category in `apps/api/test/invariants` to check DB state consistency.
2. **Saga Test Standard**: Enforce Success/Failure/Idempotency coverage for all Sagas.
3. **Policy Unit Tests**: ensure 100% coverage for pure logic.

## Technical Context

**Language/Version**: TypeScript 5.x (Node 20+)
**Primary Dependencies**: Vitest, Prisma Client
**Storage**: PostgreSQL (Test DB) with Seeded Scenarios
**Testing**: Vitest (Unit, Integration, Invariant)
**Target Platform**: Backend API (apps/api)
**Project Type**: Monorepo (Turborepo)
**Performance Goals**: Invariant suite should run < 30s
**Constraints**: Must not slow down standard `npm test` significantly (should be a separate mode or fast enough)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Architecture**: Testing infrastructure respects layering.
- [x] **II. Contracts**: N/A (Internal Testing)
- [x] **III. Backend Layers**: Tests cover Service/Policy/Saga layers appropriately.
- [x] **IV. Multi-Tenant**: Tests must respect `companyId` isolation.
- [x] **V. Frontend**: N/A
- [x] **VIII. Verification**: Enhances verification capabilities.
- [x] **IX. Schema-First**: N/A
- [x] **X. Parity**: Applies to all modules equally.
- [x] **XI. Performance**: Invariant tests should be optimized (batch queries).
- [x] **XII. Apple-Standard**: Enforces "Business Shape" consistency.
- [x] **XIII. Data Flow**: Validates the flow.
- [x] **XIV-XVII. Human Experience**: N/A (Developer Experience focus)

## Project Structure

### Documentation (this feature)

```text
specs/030-test-floor-phase1/
├── plan.md              # This file
├── research.md          # N/A (Standard Vitest usage)
├── data-model.md        # N/A (No schema changes, only tests)
├── quickstart.md        # Guide to running Invariant Tests
└── tasks.md             # Execution Tasks
```

### Source Code (repository root)

```text
apps/
└── api/
    └── test/
        ├── invariants/         # [NEW] Invariant Test Suite
        │   ├── finance.test.ts
        │   ├── inventory.test.ts
        │   └── setup.ts
        ├── unit/               # Existing Unit Tests
        └── integration/        # Existing Integration Tests
```

**Structure Decision**: A dedicated `invariants` directory keeps these specific "state integrity" checks separate from flow-based integration tests.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
