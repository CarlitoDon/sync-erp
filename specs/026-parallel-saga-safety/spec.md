# Feature Specification: Parallel Saga Safety (D2)

**Feature Branch**: `026-parallel-saga-safety`
**Created**: 2025-12-17
**Status**: Draft
**Input**: D2 (Parallel saga) — Concurrency safety

---

## Problem Statement

The current Saga implementation lacks mechanisms to prevent parallel execution for the same entity. Use case:

1. User sends Request A (Key A) to Post Invoice #101.
2. Simultaneously, User sends Request B (Key B) to Post Invoice #101.
3. Both requests pass Idempotency check (keys are different).
4. Both Sagas execute in parallel.
5. **Result**: Double stock deduction, double journal entry, corrupted state.

**Root Cause**: Lack of entity-level locking during Saga initialization.

---

## User Scenarios & Testing

### User Story 1 - Prevent Double Execution (Priority: P1)

As a system, I must prevent parallel processing of critical business transactions for the same entity to ensure financial and inventory data integrity.

**Why this priority**: Prevents critical data corruption (Audit Finding D2).

**Independent Test**: Simulate two concurrent API calls to "Post Invoice" for the same invoice with different idempotency keys.

- **Expected**: One succeeds, the other fails (or waits). Logic is serialized.

**Acceptance Scenarios**:

1. **Given** Invoice #101 is DRAFT, **When** two concurrent "Post" requests are received, **Then** only ONE executes the posting logic (stock/journal)
2. **Given** the first request is processing, **When** the second request attempts to start, **Then** it waits for the lock or fails if the entity state changes (e.g. becomes POSTED)
3. **Given** processing completes, **When** the second request obtains the lock, **Then** it sees the updated state (POSTED) and fails validation (idempotent failure)

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST acquire a strict database-level row lock (e.g., `FOR UPDATE`) on the target entity before executing critical Saga steps.
- **FR-002**: The lock MUST be held for the duration of the critical section or transaction.
- **FR-003**: The locking mechanism MUST support standard timeout behavior (fail or wait) to prevent indefinite deadlocks.
- **FR-004**: This protection MUST apply to `InvoicePostingSaga`, `BillPostingSaga`, `PaymentPostingSaga`, and `CreditNoteSaga` (entities: Invoice, Bill, Payment, CreditNote).
- **FR-005**: Idempotency checks or State Validation checks MUST be performed _after_ acquiring the lock to ensure freshness.

### Key Entities

- **Invoice / Bill / Payment**: The critical business entities requiring concurrency protection.
- **Transaction Lock**: A temporary exclusive lock held on the entity during critical processing steps to serialize access.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: **Zero** double-postings in concurrent load tests (simulated race conditions).
- **SC-002**: System handles 10 concurrent requests for same entity without data corruption.
- **SC-003**: No regression in single-request performance (latency impact < 100ms).

---

## Assumptions

- The underlying database (Postgres) supports `SELECT ... FOR UPDATE` via Prisma `executeRaw` or equivalent.
- Sagas are short-lived enough that holding a row lock is acceptable performance-wise.

---

## Out of Scope

- Distributed locking (Redis) - we use DB locking for simplicity and strong consistency (Acid).
- Locking for read-only operations.
