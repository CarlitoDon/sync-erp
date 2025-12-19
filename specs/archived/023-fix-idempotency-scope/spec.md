# Feature Specification: Fix Idempotency Key Scope

**Feature Branch**: `023-fix-idempotency-scope`  
**Created**: 2025-12-16  
**Status**: Draft  
**Input**: User description: "Fix idempotency key scope to prevent silent data corruption (Audit B1)"

---

## Problem Statement

The current idempotency implementation uses arbitrary client-provided strings as keys. This allows a malicious or buggy client to reuse the same idempotency key for **different entities**, causing the system to return a cached response from a completely unrelated operation.

**Bug Scenario:**

1. User creates payment with key `"payment-1"` for Invoice A
2. Payment succeeds, key marked COMPLETED
3. User (or retry logic) reuses `"payment-1"` for Invoice B (different!)
4. System returns cached response from Invoice A
5. **Invoice B never gets paid, but user thinks it did**

**Business Impact:** Silent data corruption. Payments recorded against wrong invoices. Accounting integrity destroyed.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - System Prevents Key Reuse Across Entities (Priority: P1)

As a backend system, when processing a retry request, I must verify that the idempotency key is scoped to the specific entity being operated on, so that cached responses only apply to the exact same operation.

**Why this priority**: This is the core fix. Without this, all other features are compromised by silent data corruption.

**Independent Test**: Can be fully tested by sending two payment requests with the same key but different invoiceIds and verifying the second request is rejected or processed independently.

**Acceptance Scenarios**:

1. **Given** a COMPLETED idempotency key exists for Invoice A, **When** a request arrives with the same key but for Invoice B, **Then** system rejects with error "Idempotency key scope mismatch" (HTTP 409)
2. **Given** a COMPLETED idempotency key exists for Invoice A, **When** a request arrives with the same key for Invoice A, **Then** system returns the cached response without re-executing

---

### User Story 2 - Key Generation is Server-Controlled (Priority: P1)

As a backend system, I must generate deterministic idempotency keys from request context (scope + entityId + companyId), so that the same logical operation always maps to the same key.

**Why this priority**: Client-controlled keys are the root cause. Server-controlled keys eliminate the attack vector entirely.

**Independent Test**: Can be tested by calling the same endpoint twice with identical payloads and verifying idempotency works, then changing the entityId and verifying a new key is generated.

**Acceptance Scenarios**:

1. **Given** a payment request for Invoice A with amount $100, **When** the same request is sent again (same invoiceId, same companyId), **Then** system uses the same computed idempotency key and returns cached response
2. **Given** a payment request for Invoice A, **When** a payment request for Invoice B arrives, **Then** system computes a different idempotency key and processes independently

---

### User Story 3 - Backward Compatibility with Existing Keys (Priority: P2)

As a system administrator, existing idempotency keys should remain valid during migration, so that ongoing operations are not disrupted.

**Why this priority**: Production may have in-flight requests with old-style keys. Migration must be graceful.

**Independent Test**: Can be tested by populating database with old-style keys and verifying they still trigger idempotency correctly.

**Acceptance Scenarios**:

1. **Given** an old-style idempotency key (arbitrary string) exists in database, **When** a matching request arrives with client-provided key header, **Then** system checks both old and new key formats
2. **Given** a new deployment is rolled out, **When** new requests arrive without client-provided key, **Then** system generates server-controlled keys automatically

---

### Edge Cases

- What happens when same idempotency key exists for different scopes (e.g., INVOICE_POST vs PAYMENT_CREATE)?
  - Keys are scoped by scope + entityId + companyId, so different scopes = different keys
- What happens when network retry sends request with stale entityId?
  - System treats as new request with new key, processes normally
- What happens when client provides explicit idempotency key AND system generates one?
  - System prefers client key during migration period, then deprecates client keys

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST compute idempotency keys as: `${scope}:${entityId}:${companyId}`
- **FR-002**: System MUST reject requests where provided key does not match computed key (HTTP 409 Conflict)
- **FR-003**: System MUST support client-provided keys during migration period (deprecated behavior)
- **FR-004**: System MUST log all idempotency key mismatches for audit purposes
- **FR-005**: System MUST add entityId column to IdempotencyKey table for scope validation
- **FR-006**: Database MUST enforce unique constraint on (scope, entityId, companyId) for IdempotencyKey

### Key Entities

- **IdempotencyKey**: Tracks operation deduplication. Key attributes: id, scope, entityId (NEW), companyId, status, response, createdAt, updatedAt
- **Scope Changes**: Add entityId as required field; add composite unique constraint

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Zero instances of idempotency key returning response for wrong entity (verified by integration test)
- **SC-002**: All payment and invoice posting operations use entity-scoped keys (verified by code review)
- **SC-003**: Existing operations continue to work during migration (verified by backward-compatibility test)
- **SC-004**: Key scope mismatch attempts are logged and alertable (verified by log inspection)

---

## Assumptions

- Client-provided idempotency keys will be deprecated in future release but supported for 2 releases
- Server-generated keys use deterministic hashing (no randomness)
- Migration does not require data backfill — old keys remain valid until they expire
- Idempotency keys have TTL and are cleaned up periodically (existing behavior)

---

## Out of Scope

- Changing idempotency key TTL or cleanup logic
- Implementing client-side key generation rules
- Changing the PROCESSING zombie lock timeout (separate audit item)
