# Feature Specification: Domain Contract Stabilization

**Feature Branch**: `028-domain-contract-stabilization`  
**Created**: 2025-12-17  
**Status**: Draft  
**Input**: Freeze domain state machines, write rules, and policy coverage before UI development

---

## Overview

This feature establishes **immutable domain contracts** for all core entities (Invoice, Bill, Sales Order, Purchase Order) before any UI work begins. The goal is to freeze "how domains work" so that frontend development has stable, predictable backend behavior.

**Key Principle**: _"Membekukan cara kerja domain sebelum UI masuk"_

---

## Clarifications

### Session 2025-12-17

- Q: Which state names should be canonical for Orders? → A: Option A — Use STATE_MACHINES.md names (COMPLETED, CANCELLED). COMPLETED = terminal positive (fully invoiced). CANCELLED = terminal negative (compensation triggered).
- Q: Should businessDate be added as requirement for G5 compliance? → A: Option A — Add now. All financial commands MUST accept explicit businessDate (default: today). This is guardrail, not feature.
- Q: Should invariant querying be part of Domain Contract scope? → A: Option A — Add now. G7 requires SQL-queryable invariants (balance, journal balance, stock). This is domain truth, not observability.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - State Machine Enforcement (Priority: P1)

As a **system operator**, I want each entity to follow a strict state machine so that I cannot accidentally corrupt data by performing invalid operations.

**Why this priority**: State machines are the foundation of all business logic. Without strict enforcement, all other features risk data corruption.

**Independent Test**: Can be fully tested by attempting state transitions via API and verifying only valid transitions succeed.

**Acceptance Scenarios**:

1. **Given** an Invoice in DRAFT state, **When** I attempt to post it, **Then** the system transitions it to POSTED and creates journal entries
2. **Given** an Invoice in POSTED state, **When** I attempt to edit line items, **Then** the system returns error `MUTATION_BLOCKED`
3. **Given** an Invoice in PAID state, **When** I attempt to post it again, **Then** the system returns error `INVALID_STATE_TRANSITION`
4. **Given** a Sales Order in CONFIRMED state, **When** I attempt to mark it DRAFT, **Then** the system returns error `INVALID_STATE_TRANSITION`

---

### User Story 2 - Write Rule Protection (Priority: P1)

As a **business owner**, I want posted documents to be immutable so that auditors can trust our financial records.

**Why this priority**: Financial integrity is non-negotiable. Mutations after posting would invalidate audit trails.

**Independent Test**: Can be tested by attempting field updates on POSTED entities and verifying all writes are blocked.

**Acceptance Scenarios**:

1. **Given** a POSTED Invoice, **When** I attempt to change the amount, **Then** the system returns error `MUTATION_BLOCKED`
2. **Given** a POSTED Invoice, **When** I record a payment, **Then** the system allows the operation and updates balance
3. **Given** a POSTED Bill, **When** I attempt to add items, **Then** the system returns error `MUTATION_BLOCKED`
4. **Given** a POSTED Bill, **When** I request a credit note, **Then** the system allows the operation

---

### User Story 3 - Policy Layer Validation (Priority: P2)

As a **developer**, I want all business constraints enforced in policy classes so that logic is centralized, testable, and shape-aware.

**Why this priority**: Policies prevent business rule duplication across services. Critical for maintainability but less urgent than state protection.

**Independent Test**: Can be tested by invoking Policy methods directly with various BusinessShape inputs.

**Acceptance Scenarios**:

1. **Given** a RETAIL company, **When** InventoryPolicy checks stock adjustment, **Then** it returns allowed
2. **Given** a SERVICE company, **When** InventoryPolicy checks stock adjustment, **Then** it returns blocked with clear reason
3. **Given** a MANUFACTURING company, **When** InventoryPolicy checks WIP creation, **Then** it returns allowed
4. **Given** a PENDING company, **When** any Policy checks any operation, **Then** it returns blocked with `SHAPE_PENDING`

---

### User Story 4 - Consistent Error Responses (Priority: P2)

As a **frontend developer**, I want all state/mutation errors to use consistent error codes so that I can provide unified user feedback.

**Why this priority**: UX consistency depends on predictable error shapes. Lower than P1 because backend functionality comes first.

**Independent Test**: Can be tested by triggering various error conditions and verifying response structure matches ERROR_CATALOG.

**Acceptance Scenarios**:

1. **Given** any invalid state transition, **When** API returns error, **Then** response contains `code`, `message`, and `action` fields
2. **Given** a mutation blocked error, **When** API returns error, **Then** `code` matches ERROR_CATALOG entry `MUTATION_BLOCKED`
3. **Given** a shape pending error, **When** API returns error, **Then** `code` matches ERROR_CATALOG entry `SHAPE_PENDING`

---

### Edge Cases

- What happens when concurrent requests attempt conflicting state transitions?
  → First succeeds, second returns `CONFLICT` or `MUTATION_BLOCKED`
- What happens when a VOID entity receives mutation requests?
  → All mutations blocked, entity is terminal
- How does system handle state transition during saga compensation?
  → Saga reverts to previous valid state (e.g., POSTED → DRAFT on failure)

---

## Requirements _(mandatory)_

### Functional Requirements

#### State Machine Enforcement

- **FR-001**: System MUST enforce Invoice state machine: DRAFT → POSTED → PAID → VOID
- **FR-002**: System MUST enforce Bill state machine: DRAFT → POSTED → PAID → VOID
- **FR-003**: System MUST enforce Sales Order state machine: DRAFT → CONFIRMED → COMPLETED (with CANCELLED as terminal negative from DRAFT or CONFIRMED)
- **FR-004**: System MUST enforce Purchase Order state machine: DRAFT → CONFIRMED → COMPLETED (with CANCELLED as terminal negative from DRAFT or CONFIRMED)
- **FR-005**: System MUST reject any state transition not defined in the state machine
- **FR-006**: System MUST log all state transitions with timestamp and actor

#### Transition Guards (CHK043 Fix)

- **FR-027**: Transition Invoice DRAFT → POSTED MUST require successful journal entry creation
- **FR-028**: Transition Invoice POSTED → PAID MUST require balance == 0
- **FR-029**: Transition Order DRAFT → CONFIRMED MUST validate all line items exist

#### Write Protection Rules

- **FR-007**: System MUST block all field mutations on POSTED Invoices except: receiving payments, creating credit notes
- **FR-008**: System MUST block all field mutations on POSTED Bills except: recording payments, creating credit notes
- **FR-009**: System MUST block all mutations on VOID entities (terminal state)
- **FR-010**: System MUST block all mutations on COMPLETED/CANCELLED Orders (terminal states)
- **FR-011**: System MUST return structured error with code `MUTATION_BLOCKED` when mutation is rejected

#### Business Date (G5 Compliance)

- **FR-020**: All financial commands (Invoice POST, Payment, Bill POST, Credit Note) MUST accept `businessDate: Date`
- **FR-021**: If `businessDate` is not provided, system MUST default to current date (today) at command boundary
- **FR-022**: `businessDate` MUST be persisted and used for all journal postings (not system timestamp)
- **FR-023**: System MUST reject financial commands with invalid businessDate (policy-driven, e.g., future dates blocked)

#### Invariant Queryability (G7 Compliance)

- **FR-024**: System schema MUST allow SQL query to verify `Invoice.balance >= 0` for all non-VOID invoices
- **FR-025**: System schema MUST allow SQL query to verify `SUM(journal.debit) == SUM(journal.credit)` per journal entry
- **FR-026**: System schema MUST allow SQL query to verify `StockQty >= 0` per product, respecting BusinessShape rules (SERVICE excluded)

> **Note**: DB constraints not required in Phase 1. Schema must support deterministic queries without complex joins.

#### Policy Layer

- **FR-012**: InventoryPolicy MUST check BusinessShape before allowing stock operations
- **FR-013**: SalesPolicy MUST check BusinessShape before allowing sales operations
- **FR-014**: ProcurementPolicy MUST check BusinessShape before allowing procurement operations
- **FR-015**: All Policies MUST be stateless (no DB access, no I/O)
- **FR-016**: All Policies MUST return consistent error codes from ERROR_CATALOG

#### Traceability & Source Reference (CHK011, CHK013 Fix)

- **FR-030**: All JournalEntry MUST have `sourceType` and `sourceId` referencing origin document
- **FR-031**: Side effects MUST be traceable: Policy check → Service execution → Saga log entry
- **FR-032**: System MUST maintain audit trail linking Journal → Invoice/Bill → Order

#### Error Consistency

- **FR-017**: All domain errors MUST include: `code`, `message`, `action` (optional)
- **FR-018**: All error codes MUST be documented in ERROR_CATALOG
- **FR-019**: Error codes MUST be stable (no breaking changes without versioning)

#### Recovery & Failure Handling (CHK017 Fix)

- **FR-033**: Failed saga MUST transition entity to explicit failure state (not silent)
- **FR-034**: System MUST provide recovery path for COMPENSATION_FAILED entities (manual intervention endpoint)
- **FR-035**: Recovery actions MUST be logged with actor and timestamp

#### Frontend Boundary (CHK009 Fix)

- **FR-036**: Frontend MUST NOT calculate balance, status, or stock quantities
- **FR-037**: Frontend MUST treat all backend responses as authoritative (no local overrides)
- **FR-038**: All business logic decisions MUST originate from backend Policy/Service layers

### Key Entities

- **Invoice**: Financial document with states (DRAFT, POSTED, PAID, VOID). Contains line items, amounts, and balance.
- **Bill**: Vendor invoice with identical state machine to Invoice. Represents accounts payable.
- **Sales Order**: Customer order with states (DRAFT, CONFIRMED, COMPLETED, CANCELLED). COMPLETED = fully invoiced. CANCELLED = terminal failure. Parent of invoices.
- **Purchase Order**: Vendor order with states (DRAFT, CONFIRMED, COMPLETED, CANCELLED). COMPLETED = fully received. CANCELLED = terminal failure. Parent of bills.
- **BusinessShape**: Company profile (PENDING, RETAIL, MANUFACTURING, SERVICE) that drives policy decisions.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of invalid state transitions are rejected with appropriate error code
- **SC-002**: 0 mutations succeed on POSTED entities except explicitly allowed operations (payment, credit note)
- **SC-003**: All 4 entity types (Invoice, Bill, Sales Order, Purchase Order) have documented state machines
- **SC-004**: All 3 BusinessShapes (RETAIL, MANUFACTURING, SERVICE) have policy coverage in each domain
- **SC-005**: 100% of domain errors match ERROR_CATALOG format (code + message structure)
- **SC-006**: Policy methods have 100% unit test coverage for all shape combinations
- **SC-007**: State transition tests cover happy path + at least 1 invalid transition per entity
- **SC-008**: All financial commands accept businessDate parameter with default behavior tested
- **SC-009**: SQL queries for 3 invariants (balance, journal, stock) are documented and executable
- **SC-010**: Invariant tests verify balance >= 0 and journal debit == credit after valid operations

---

## Assumptions

1. **State machines are final**: No additional states will be added in Phase 1
2. **Policies are pure**: All policy checks are synchronous and do not require database access
3. **Error codes are stable**: ERROR_CATALOG entries established here will not change during Phase 1
4. **Existing saga infrastructure**: SagaOrchestrator and compensation logic are already functional (verified in Entry Gate)
5. **No UI changes**: This feature is backend-only; frontend will consume contracts in subsequent features

---

## Out of Scope

- UI implementation (buttons, forms, state display)
- Approval workflows
- Multi-currency support
- Batch operations
- Soft delete implementation
- RBAC complex permissions

---

## Dependencies

- **Phase 0 Complete**: Entry Gate verified (Saga, Idempotency, Journal constraint)
- **ERROR_CATALOG exists**: `docs/apple-like-development/phases/phase-1/docs/ERROR_CATALOG.md`
- **Policy files exist**: Already verified in Entry Gate scan
- **State enums exist**: Prisma schema has `InvoiceStatus`, `OrderStatus` enums
