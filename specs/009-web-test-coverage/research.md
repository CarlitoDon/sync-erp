# Research: Improve Frontend Test Coverage

**Feature**: 009-web-test-coverage
**Date**: 2025-12-11

## Decisions

### Test Framework

- **Decision**: Vitest
- **Rationale**: Native Vite support, fast execution, Jest-compatible API, built-in v8 coverage.
- **Alternatives**: Jest (slower, requires config for ESM/TS), Mocha (too manual).

### Coverage Provider

- **Decision**: v8
- **Rationale**: Built-in to Node/Vitest, faster than Istanbul (instrumentation-based).
- **Configuration**:
  - `provider: 'v8'`
  - `reporter: ['text', 'json', 'html']`
  - `all: true` (include untested files)
  - `exclude`: `['src/test/**', 'src/**/*.d.ts', '**/*.config.ts']`

### Component Testing Pattern

- **Decision**: React Testing Library + User Event
- **Rationale**: Tests behavior, not implementation details.
- **Structure**:
  - Use `renderWithContext` helper for providers (Auth, Sidebar, Router).
  - Mock `apiAction` and `useConfirm` hooks globally or per test.

### Page Testing Strategy

- **Decision**: Integration Tests with Mocked Services
- **Rationale**: Pages are integration points. Test that they fetch data (mocked service), render states (loading, error, success), and handle user input.
- **Mocking**: Mock the `service` layer (e.g., `mock(partnerService)`), not `axios` directly, to decouple tests from HTTP implementation details.

### Test Location

- **Decision**: `apps/web/test/**` (Mirroring `src`)
- **Rationale**: Keeps `src` clean for production code. Matches `apps/api` pattern.
- **Structure**:
  - `test/components/`: Component unit tests
  - `test/pages/`: Page integration tests
  - `test/hooks/`: Hook unit tests
  - `test/services/`: Service unit tests (logic only)

## Unknowns Resolved

- **Scope**: Full 80% coverage required (User Clarification).
- **Structure**: Use `test/` directory to separate test code from source.
