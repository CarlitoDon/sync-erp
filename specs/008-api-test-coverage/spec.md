# Feature Specification: API Test Coverage

**Feature Branch**: `008-api-test-coverage`  
**Created**: 2025-12-11  
**Status**: Draft  
**Input**: User description: "API test coverage minimum 80%"

## Clarifications

### Session 2025-12-11

- Q: Which coverage provider to use? → A: Use `@vitest/coverage-v8` (modern, fast, built-in to Node)
- Q: CI workflow scope? → A: Skip CI integration for now (local-only coverage)
- Q: Threshold enforcement behavior? → A: Hard fail (exit code 1) when below 80%

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Developer Runs Coverage Report (Priority: P1)

As a developer, I want to run a test coverage report on the API codebase so that I can identify untested code and ensure quality standards are met.

**Why this priority**: This is the foundation - without coverage reporting, developers cannot measure progress toward the 80% goal.

**Independent Test**: Can be tested by running `npm run test:coverage` command and verifying HTML/terminal coverage report is generated.

**Acceptance Scenarios**:

1. **Given** developer is in the `apps/api` directory, **When** they run `npm run test:coverage`, **Then** a coverage report is generated showing line, branch, function, and statement coverage percentages.
2. **Given** developer runs coverage, **When** coverage is below 80%, **Then** the command exits with a non-zero status code (CI failure).
3. **Given** developer runs coverage, **When** coverage meets or exceeds 80%, **Then** the command exits successfully.

---

### User Story 2 - CI Pipeline Enforces Coverage (Priority: P3 - DEFERRED)

> **Note**: CI integration deferred per clarification. This story is out of scope for initial implementation.

As a team lead, I want the CI pipeline to fail if test coverage drops below 80% so that code quality is enforced automatically.

**Why deferred**: Local coverage tooling must be established first before CI integration.

---

### User Story 3 - Developer Identifies Uncovered Code (Priority: P2)

As a developer, I want to see which specific lines and functions are not covered so that I can write targeted tests.

**Why this priority**: Useful for improving coverage but not strictly required for enforcement.

**Independent Test**: Can be tested by opening the HTML coverage report and verifying it highlights uncovered code sections.

**Acceptance Scenarios**:

1. **Given** coverage report is generated, **When** developer opens `coverage/index.html`, **Then** they see a navigable list of all source files with coverage percentages.
2. **Given** developer clicks on a file in the report, **When** file detail opens, **Then** uncovered lines are highlighted in red, covered lines in green.

---

### Edge Cases

- What happens when a test file has syntax errors? → Coverage command should fail with clear error message.
- What happens when there are no test files? → Coverage should report 0% and fail threshold check.
- How are generated files (dist/) handled? → Generated files should be excluded from coverage calculation.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a `test:coverage` script in `apps/api/package.json` that generates coverage reports.
- **FR-002**: System MUST fail with exit code 1 if overall coverage is below 80% for lines, branches, functions, or statements.
- **FR-003**: System MUST generate an HTML coverage report in `apps/api/coverage/` directory for visual inspection.
- **FR-004**: System MUST generate a terminal summary showing coverage percentages after test run.
- **FR-005**: System MUST exclude non-source files from coverage (node_modules, dist, test files, config files).
- **FR-006**: System MUST integrate with existing Vitest test runner configuration.
- **FR-007**: System SHOULD provide per-file coverage breakdown in the report.

### Key Entities

- **Coverage Report**: Contains line/branch/function/statement metrics per file and aggregate totals.
- **Coverage Threshold**: Configuration defining minimum acceptable coverage percentages (80% for all metrics).
- **Source Files**: TypeScript files in `apps/api/src/` to be measured (services, routes, middlewares).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Developers can generate a coverage report in under 2 minutes.
- **SC-002**: Coverage report accurately reflects which lines of code are executed during tests.
- **SC-003**: Coverage command fails (exit code 1) when any metric drops below 80%.
- **SC-004**: 100% of API source files are included in coverage measurement.
- **SC-005**: After implementation, team achieves and maintains minimum 80% test coverage.

## Assumptions

- Vitest uses `@vitest/coverage-v8` for coverage reporting (chosen for speed and modern Node integration).
- The 80% threshold applies to all four metrics: lines, branches, functions, statements.
- CI integration is deferred; coverage is enforced locally for now.
- Existing tests in `apps/api/test/` are the baseline; gaps will be identified for future test writing.
