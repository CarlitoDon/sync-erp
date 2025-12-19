# Feature Specification: API Test Coverage

**Feature Branch**: `008-api-test-coverage`  
**Created**: 2025-12-11  
**Status**: Completed
**Input**: User description: "API test coverage minimum 80%"

## Clarifications

### Session 2025-12-11

- Q: Which coverage provider to use? → A: Use `@vitest/coverage-v8` (modern, fast, built-in to Node)
- Q: CI workflow scope? → A: Skip CI integration for now (local-only coverage)
- Q: Threshold enforcement behavior? → A: Hard fail (exit code 1) when below 80%
- Q: What is the deliverable? → A: Write tests to achieve 80% coverage, not just setup tooling

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Coverage Tooling Setup (Priority: P1) ✅ COMPLETE

As a developer, I want coverage tooling configured so that I can measure test coverage.

**Status**: COMPLETE - vitest.config.ts, test:coverage script, and .gitignore configured.

---

### User Story 2 - Service Layer Tests (Priority: P1) ✅ COMPLETE

As a developer, I want unit tests for all service files so that business logic is covered.

**Why this priority**: Services contain core business logic and have the most code to cover.

**Independent Test**: Run `npm run test:coverage` and verify services have ≥80% coverage.

**Acceptance Scenarios**:

1. **Given** all service tests exist, **When** coverage runs, **Then** services/ directory shows ≥80% line coverage.
2. **Given** a service method, **When** tested, **Then** all branches and error paths are covered.

**Current Status**:

- Services coverage: 99.58% ✅
- All services have >98% coverage

---

### User Story 3 - Route Layer Tests (Priority: P2) ✅ COMPLETE

As a developer, I want integration tests for all routes so that API endpoints are verified.

**Why this priority**: Routes are entry points but depend on services being tested first.

**Independent Test**: Run `npm run test:coverage` and verify routes have ≥80% coverage.

**Acceptance Scenarios**:

1. **Given** all route tests exist, **When** coverage runs, **Then** routes/ directory shows ≥80% line coverage.

**Current Status**:

- Routes coverage: 88.30% ✅
- All 13 route files are tested with mock dependencies

---

### User Story 4 - Middleware Layer Tests (Priority: P2) ✅ COMPLETE

As a developer, I want tests for all middlewares so that auth and error handling are verified.

**Why this priority**: Critical security components need test coverage.

**Independent Test**: Run `npm run test:coverage` and verify middlewares have ≥80% coverage.

**Acceptance Scenarios**:

1. **Given** middleware tests exist, **When** coverage runs, **Then** middlewares/ directory shows ≥80% line coverage.

**Current Status**:

- Middlewares coverage: 98.64% ✅
- Files: auth.ts, errorHandler.ts, rbac.ts all covered

---

### User Story 5 - CI Pipeline Enforces Coverage (Priority: P3 - DEFERRED)

> **Note**: CI integration deferred per clarification. This story is out of scope for initial implementation.

---

### Edge Cases

- What if a service has complex database interactions? → Use mocking/stubbing for unit tests.
- What if a test is flaky? → Ensure deterministic test data and isolated test runs.
- How to handle authentication in route tests? → Mock auth middleware for isolated testing.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ✅ System MUST provide a `test:coverage` script that generates coverage reports.
- **FR-002**: ✅ System MUST fail with exit code 1 if overall coverage is below 80%.
- **FR-003**: ✅ System MUST generate HTML and terminal coverage reports.
- **FR-004**: System MUST have unit tests for ALL service files achieving ≥80% coverage per file.
- **FR-005**: System MUST have integration tests for ALL route files achieving ≥80% coverage per file.
- **FR-006**: System MUST have unit tests for ALL middleware files achieving ≥80% coverage per file.
- **FR-007**: ✅ System MUST exclude non-source files from coverage calculation.

### Key Entities

- **Service Tests**: Unit tests for business logic in `apps/api/src/services/`
- **Route Tests**: Integration tests for API endpoints in `apps/api/src/routes/`
- **Middleware Tests**: Unit tests for auth/error handling in `apps/api/src/middlewares/`

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Overall coverage reaches minimum 80% for lines, branches, functions, statements. (Achieved: >96%)
- **SC-002**: Services directory has ≥80% coverage (Achieved: 99.58% ✅).
- **SC-003**: Routes directory has ≥80% coverage (Achieved: 88.30% ✅).
- **SC-004**: Middlewares directory has ≥80% coverage (Achieved: 98.64% ✅).
- **SC-005**: `npm run test:coverage` exits with code 0 (all thresholds met).

## Assumptions

- Vitest uses `@vitest/coverage-v8` for coverage reporting (✅ configured).
- Tests will use mocking for database isolation where appropriate.
- Existing tests in `apps/api/test/` are the baseline (7 test files, 22 tests).
- Priority order: Services → Routes → Middlewares.
