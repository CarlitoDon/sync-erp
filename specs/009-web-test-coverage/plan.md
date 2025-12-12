# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement automated test infrastructure for `apps/web` using Vitest to achieve >= 80% code coverage. This includes configuring the test runner, coverage reporting (v8), and writing unit/component tests for components, hooks, utilities, and page integration points.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18)
**Primary Dependencies**: Vitest, @testing-library/react, @testing-library/jest-dom, jsdom
**Storage**: N/A
**Testing**: Vitest (v8 provider)
**Target Platform**: Browser (simulated via JSDOM)
**Project Type**: Web (Frontend)
**Performance Goals**: Fast test execution (watch mode support)
**Constraints**: 80% global coverage threshold
**Scale/Scope**: ~45 files in `apps/web/src`

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Boundaries**: N/A (Testing feature, no new imports)
- [x] **II. Dependencies**: Uni-directional (Web -> Packages preserved)
- [x] **III. Contracts**: N/A (No new shared types)
- [x] **IV. Layered Backend**: N/A (Frontend only)
- [x] **IV. Repository Pattern**: N/A (Frontend only)
- [x] **V. Multi-Tenant**: Tests must respect tenant isolation in mocks

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

```text
apps/
├── web/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── services/
│   ├── test/
│   │   ├── components/     # Component tests
│   │   ├── hooks/          # Hook tests
│   │   ├── pages/          # Page integration tests
│   │   ├── services/       # Service unit tests
│   │   ├── setup.ts        # Global setup
│   │   └── utils/          # Test helpers
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts    # Config file
```

**Structure Decision**: Mirror `src` structure in `test` directory (or co-locate `__tests__` or `*.test.tsx`).
_Decision_: Co-location is standard in modern React (Vite) but `apps/web/test` might be cleaner if strict separation desired.
_Refined_: The `test` directory pattern is shown above, but standard Vite often places tests next to files. Given the size, I will default to **Co-location** (next to file) for components/hooks, and `test/` for setup/utils to match `apps/api` pattern?
Actually, `apps/api` has `test/unit` etc.
But for frontend, `Component.test.tsx` next to `Component.tsx` is very common.
However, implementation plan structure above shows `apps/web/src/...`.
I will stick to **Co-location** `src/**/*.test.tsx` for components to make coverage visibility easier, unless constitution forbids. Constitution is silent.
Wait, `apps/web` has `test/components/SidebarToggle.test.tsx` from previous work. I should follow that pattern (`test/` folder mirroring `src`).

**Updated Structure**:

```text
apps/
├── web/
│   ├── test/               # Mirroring src structure
│   │   ├── components/
│   │   ├── pages/
│   │   ├── ...
│   │   └── setup.ts
```

## Complexity Tracking

N/A - No architectural complexity violations.
