# Feature Specification: Prevent Journal Double-Posting

**Feature Branch**: `024-fix-journal-double-post`  
**Created**: 2025-12-16  
**Status**: Draft  
**Input**: User description: "Prevent journal double-posting via unique constraint on sourceType and sourceId (Audit C1)"

---

## Problem Statement

The current `JournalEntry` model lacks unique constraints linking entries to their source documents (Invoice, Payment, etc.). Multiple code paths can inadvertently create duplicate journal entries for the same business transaction, causing:

- **Financial statement errors** (doubled revenue/expense)
- **Audit failures** (unexplainable balances)
- **Reconciliation nightmares** (manual investigation required)

**Root Cause:** No database-level enforcement that each source document produces exactly one journal entry.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - System Prevents Duplicate Journal Entries (Priority: P1)

As an ERP system, when posting an invoice or recording a payment, I must ensure that each source document creates exactly one journal entry, so that financial statements remain accurate.

**Why this priority**: This is the core fix. Double-posting corrupts financial data and is a critical accounting integrity issue.

**Independent Test**: Can be fully tested by attempting to post the same invoice twice (via concurrent requests or retry logic) and verifying only one journal entry exists.

**Acceptance Scenarios**:

1. **Given** an invoice with ID "INV-001" has already been posted with a journal entry, **When** the system attempts to create another journal entry for "INV-001", **Then** the database rejects the duplicate with a unique constraint violation
2. **Given** a payment with ID "PAY-001" has already created a journal entry, **When** a retry or duplicate request attempts to create another journal for "PAY-001", **Then** the operation fails gracefully with the existing entry preserved

---

### User Story 2 - Journal Entry Traceability (Priority: P1)

As an accountant, I must be able to trace any journal entry back to its source document (invoice, payment, bill, etc.), so that I can audit and investigate financial records.

**Why this priority**: Traceability is essential for auditing and compliance. Without source linking, journals are orphaned data.

**Independent Test**: Can query any journal entry and retrieve its associated source document type and ID.

**Acceptance Scenarios**:

1. **Given** a journal entry was created from Invoice posting, **When** viewing the journal entry, **Then** it displays `sourceType: INVOICE` and `sourceId: [invoice ID]`
2. **Given** a journal entry was created from Payment recording, **When** viewing the journal entry, **Then** it displays `sourceType: PAYMENT` and `sourceId: [payment ID]`

---

### User Story 3 - Graceful Handling of Constraint Violations (Priority: P2)

As a developer, when a duplicate journal entry is blocked by the database constraint, the system should handle this gracefully and return the existing entry or a clear error, not crash.

**Why this priority**: Constraint violations will happen during retries. The system must handle them gracefully.

**Independent Test**: Trigger a constraint violation by forcing a duplicate and verify error handling returns appropriate response.

**Acceptance Scenarios**:

1. **Given** a journal entry already exists for Invoice "INV-001", **When** the saga or service attempts to create a duplicate, **Then** the error is caught and logged, and the operation fails with a clear message
2. **Given** idempotent retry logic triggers a duplicate attempt, **When** the constraint blocks it, **Then** the existing journal entry is returned or the caller is informed appropriately

---

### Edge Cases

- What happens when the same source document type/ID is used across different companies?
  - Keys are scoped by companyId, so distinct companies can have same sourceId
- What happens for manual adjustments with no source document?
  - sourceType and sourceId can be null for manual entries
- What happens if sourceId is reused after entity deletion?
  - sourceId references immutable historical data; constraint applies only to active records

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST add `sourceType` and `sourceId` fields to JournalEntry model
- **FR-002**: System MUST enforce unique constraint on `(companyId, sourceType, sourceId)`
- **FR-003**: System MUST populate sourceType and sourceId when creating journal entries from invoices
- **FR-004**: System MUST populate sourceType and sourceId when creating journal entries from payments
- **FR-005**: System MUST populate sourceType and sourceId when creating journal entries from bills
- **FR-006**: System MUST handle constraint violation errors gracefully with clear error messages
- **FR-007**: Existing journal entries with NULL sourceType/sourceId MUST remain valid (backward compat)

### Key Entities

- **JournalEntry**: Tracks double-entry accounting records. New attributes: `sourceType` (enum: INVOICE, PAYMENT, BILL, ADJUSTMENT), `sourceId` (String, nullable)
- **Scope Changes**: Add composite unique constraint `(companyId, sourceType, sourceId)`

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Zero duplicate journal entries for the same source document (verified by integration test)
- **SC-002**: 100% of new journal entries have sourceType and sourceId populated when created from known sources (verified by code review)
- **SC-003**: Constraint violation errors are caught and handled without crashing (verified by unit test)
- **SC-004**: All existing journal entries remain accessible after migration (verified by migration test)

---

## Assumptions

- The unique constraint uses nullable columns; PostgreSQL unique constraints treat each NULL as distinct, so multiple manual entries (null sourceId) are allowed
- sourceType is an enum to ensure consistency across the system
- Migration will add the fields with NULL defaults, then backfill is optional (manual entries without source remain valid)
- The constraint `(companyId, sourceType, sourceId)` enforces uniqueness only when all three are non-null

---

## Out of Scope

- Backfilling sourceType/sourceId for existing legacy journal entries
- Changing the JournalEntry API response format
- Adding sourceType/sourceId to the frontend UI
- Modifying the journal reversal logic (separate feature)
