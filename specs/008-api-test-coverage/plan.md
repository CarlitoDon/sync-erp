# Implementation Plan: API Test Coverage

**Branch**: `008-api-test-coverage` | **Date**: 2025-12-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-api-test-coverage/spec.md`

## Summary

Configure Vitest coverage reporting with `@vitest/coverage-v8` to enforce minimum 80% test coverage across all API source files. The implementation adds a `test:coverage` script that generates HTML and terminal reports, with hard failure (exit code 1) when thresholds are not met.

## Technical Context

**Language/Version**: TypeScript 5.3.3, Node.js 18+  
**Primary Dependencies**: Vitest 1.2.0, @vitest/coverage-v8  
**Storage**: N/A (tooling configuration only)  
**Testing**: Vitest (existing test runner)  
**Target Platform**: Local development (CI deferred)  
**Project Type**: Monorepo (apps/api workspace)  
**Performance Goals**: Coverage report generation < 2 minutes  
**Constraints**: 80% minimum threshold for lines, branches, functions, statements  
**Scale/Scope**: 18 service files, 5 route files, 3 middleware files in apps/api/src

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Boundaries**: N/A - This feature is tooling only, no frontend/backend changes
- [x] **II. Dependencies**: N/A - No new cross-package dependencies
- [x] **III. Contracts**: N/A - No shared types modified
- [x] **IV. Layered Backend**: N/A - No business logic changes
- [x] **IV. Repository Pattern**: N/A - No DB access changes
- [x] **V. Multi-Tenant**: N/A - No data queries

✅ **All gates pass** - This is a tooling/configuration feature with no architectural impact.

## Project Structure

### Documentation (this feature)

```text
specs/008-api-test-coverage/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
apps/api/
├── package.json          # [MODIFY] Add test:coverage script, add @vitest/coverage-v8
├── vitest.config.ts      # [NEW/MODIFY] Add coverage configuration
├── coverage/             # [GENERATED] HTML coverage reports (gitignored)
└── test/
    ├── e2e/              # Existing E2E tests
    └── integration/      # Existing integration tests
```

**Structure Decision**: Minimal footprint - only configuration files modified. No source code changes required.

## Proposed Changes

### [MODIFY] apps/api/package.json

- Add `"test:coverage": "vitest run --coverage"` script
- Add `@vitest/coverage-v8` to devDependencies

### [NEW] apps/api/vitest.config.ts (or modify if exists)

- Configure coverage provider: `v8`
- Set thresholds: `{ lines: 80, branches: 80, functions: 80, statements: 80 }`
- Set reporter: `['text', 'html']`
- Exclude patterns: `['**/node_modules/**', '**/dist/**', '**/*.test.ts']`
- Include patterns: `['src/**/*.ts']`

### [MODIFY] apps/api/.gitignore

- Add `coverage/` directory to gitignore

## Verification Plan

### Automated Tests

- Run `npm run test:coverage` and verify HTML report generates
- Verify command fails with exit code 1 when coverage is below 80%
- Verify command succeeds when coverage meets 80%

### Manual Verification

- Open `apps/api/coverage/index.html` and verify per-file breakdown
- Confirm uncovered lines are highlighted in red
