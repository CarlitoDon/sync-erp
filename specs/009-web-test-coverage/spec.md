# Feature Specification: Improve Frontend Test Coverage

**Feature Branch**: `009-web-test-coverage`
**Created**: 2025-12-11
**Status**: Draft
**Input**: User description: "reach 80% coverage test apps/web vitest"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Verify Code Coverage (Priority: P1)

As a developer, I want to run a command to generate a code coverage report for the frontend application so that I can identify untested areas and verify I meet the quality standards.

**Why this priority**: Essential to know the current state and track progress towards the 80% goal.

**Independent Test**: Can be tested by running the coverage script and inspecting the output table and HTML report.

**Acceptance Scenarios**:

1. **Given** the repository is checked out, **When** I run `npm run test:coverage` in `apps/web`, **Then** a coverage report is displayed in the terminal showing percentages for Statements, Branches, Functions, and Lines.
2. **Given** the coverage report is generated, **When** I open the HTML report, **Then** I can see detailed line-by-line coverage for each file.

---

### User Story 2 - Enforce Quality Gate (Priority: P1)

As a team lead, I want the test runner to fail if the code coverage drops below 80% so that we maintain a high standard of code quality and prevent regression.

**Why this priority**: Automates the enforcement of the requirement, preventing technically debt accumulation.

**Independent Test**: Can be tested by temporarily removing tests to drop coverage and verifying the command fails.

**Acceptance Scenarios**:

1. **Given** the current coverage is below 80%, **When** I run the test command, **Then** the process exits with a non-zero error code indicating threshold failure.
2. **Given** the current coverage meets or exceeds 80%, **When** I run the test command, **Then** the process exits successfully.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST be configured to use `v8` provider for Vitest coverage collection in `apps/web`.
- **FR-002**: The test configuration MUST enforce a minimum threshold of 80% for Statements, Branches, Functions, and Lines globally.
- **FR-003**: The project MUST include unit and component tests for existing React components, hooks, utilities, and **Pages** in `apps/web/src` to satisfy the coverage requirement.
- **FR-004**: The coverage report MUST exclude test files, configuration files, and type definitions.

## Clarifications

### Session 2025-12-11

- Q: Coverage Scope & Phasing?
- A: **Full Coverage** - Target 80% coverage for ALL files including Pages, Components, Services, Hooks, and Utils.

### Key Entities _(include if feature involves data)_

N/A - This feature focuses on code quality instrumentation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `apps/web` test suite achieves >= 80% coverage across all four metrics (Statements, Branches, Functions, Lines).
- **SC-002**: All 100% of unit tests pass successfully.
- **SC-003**: Coverage report generation completes without memory errors.

## Constitution Compliance _(mandatory for frontend features)_

### Frontend Architecture Checklist

- [ ] **Component Abstraction**: Tests should verify reusable components are isolated.
- [ ] **Hook Abstraction**: Tests should verify custom hooks behave correctly in isolation.
- [ ] **No Copy-Paste**: Test logic should use shared helpers (e.g., `renderWithContext`).
- [ ] **Global Error Handling**: Tests should verify error boundaries or global handlers where appropriate.
- [ ] **Success Toasts**: Verify apiAction helper usage mocks correctly.
- [ ] **Confirmation Dialogs**: Verify useConfirm hook mocks correctly.
- [ ] **Systematic Updates**: N/A
