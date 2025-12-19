# Feature Specification: Phase 1 Test Floor

**Feature Branch**: `030-test-floor-phase1`
**Created**: 2025-12-17
**Status**: Draft
**Input**: User description: "Implement Phase 1 Test Floor: Mandatory Test Types and Invariant Tests"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Maintain System Integrity via Invariants (Priority: P1)

As a Developer/System Architect, I want the test suite to rigidly enforce domain invariants (e.g., non-negative balances), so that data corruption acts as a loud failure rather than a silent bug.

**Why this priority**: Preventing data corruption is the primary goal of Phase 1. Invariants are the last line of defense.

**Independent Test**: Can be tested by running the "Invariant Suite" against a seeding of valid and invalid data states.

**Acceptance Scenarios**:

1. **Given** an Invoice with a negative balance, **When** the Invariant Test Suite runs, **Then** it must fail with a descriptive error.
2. **Given** a Product with negative stock quantity, **When** the Invariant Test Suite runs, **Then** it must fail.
3. **Given** a Journal Entry where total Debit does not equal total Credit, **When** the Invariant Test Suite runs, **Then** it must fail.

---

### User Story 2 - verify Saga Resilience (Priority: P2)

As a Developer, I want a standard set of tests for every Saga (Success, Failure/Compensation, Idempotency, Concurrency), so that I can trust complex flows.

**Why this priority**: Sagas are the backbone of write operations. Trust in them is non-negotiable definition of done for Phase 1.

**Independent Test**: Can be tested by running the "Saga Compliance Suite" or checking specific Saga tests (e.g., `t025`, `t026`) against the new standard.

**Acceptance Scenarios**:

1. **Given** a Saga flow, **When** a step fails, **Then** all previous effects must be reversed (Compensated).
2. **Given** a Saga request, **When** sent twice with same Idempotency Key, **Then** the second request must return the cached response without side effects.
3. **Given** two concurrent requests for the same entity lock, **When** executed, **Then** they must serialize execution (no race conditions).

---

### User Story 3 - Validate Pure Domain Logic (Priority: P3)

As a Developer, I want unit tests for pure domain rules (Policies) without database dependencies, so that business logic is verified quickly and reliably.

**Why this priority**: Policy logic (e.g., "Can I post this invoice?") is complex and needs high coverage without slow DB tests.

**Independent Test**: Can be verified by running the policy validation suite which executes purely in memory without external dependencies.

**Acceptance Scenarios**:

1. **Given** a Policy rule (e.g., "Cannot edit Posted Invoice"), **When** tested with various states, **Then** it returns correct boolean/error without external dependencies.

## Requirements _(mandatory)_

### Functional Requirements

#### Mandatory Test Types

- **FR-001**: The project MUST have pure Unit Tests for all Policy/Rule definitions.
- **FR-002**: Every Saga implementation MUST have a "Happy Path" success test.
- **FR-003**: Every Saga implementation MUST have a "Failure & Compensation" test that verifies rollback.
- **FR-004**: Every Saga implementation MUST have an Idempotency test (retry with same key).
- **FR-005**: Every Saga implementation MUST have a Concurrent Request test (validating locking mechanism).

#### Invariant Tests

- **FR-006**: The test suite MUST include a check that `Invoice.balance` is never negative.
- **FR-007**: The test suite MUST include a check that `Product.stockQty` is never negative.
- **FR-008**: The test suite MUST include a check that `Sum(JournalLine.debit) == Sum(JournalLine.credit)` for every `JournalEntry`.

### Edge Cases

- **EC-001**: **Conflicting Invariants** - If a Saga satisfies business rules but violates a core invariant (e.g., Stock > 0), the Invariant check MUST fail the test run/deployment.
- **EC-002**: **Coverage Gaps** - If a new entity type is added without corresponding invariant tests, the suite should ideally flag this (or at least documentation should mandate it).

### Key Entities

- **Test Suite**: The collection of automated tests.
- **Saga**: The orchestration unit for complex writes.
- **Policy**: Pure function business rules.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of existing Sagas (Invoice, Bill, Payment, GRN, Credit Note) have Success, Failure, and Idempotency tests.
- **SC-002**: Invariant Test Suite runs as part of validation pipeline and completes within reasonable time limits (e.g. < 30s).
- **SC-003**: 100% of Policy definitions have corresponding Unit Tests.
- **SC-004**: "Concurrent Request" test proves serialization (e.g., stock doesn't go negative on double-submit).

## Constitution Compliance _(mandatory for frontend features)_

_Not applicable as this is a backend testing infrastructure feature._
