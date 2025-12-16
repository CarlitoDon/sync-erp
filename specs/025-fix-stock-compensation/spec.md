# Feature Specification: Implement Stock Compensation for Saga Rollback

**Feature Branch**: `025-fix-stock-compensation`  
**Created**: 2025-12-16  
**Status**: Draft  
**Input**: User description: "Fix B2 (Stock compensation) - Implement actual stock reversal in InvoicePostingSaga compensation instead of console.warn()"

---

## Problem Statement

The current `InvoicePostingSaga` compensation is incomplete. When invoice posting fails after stock has been deducted (shipped), the stock remains deducted with only a `console.warn()` logged. This results in:

- **Inventory discrepancy** (stock count doesn't match physical inventory)
- **Lost goods** (system thinks items shipped, but transaction rolled back)
- **Audit failures** (unexplainable stock movements)

**Root Cause:** The saga compensation for stock movements uses `console.warn()` instead of actual reversal logic.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Automatic Stock Restoration on Saga Failure (Priority: P1)

As an ERP system, when an invoice posting fails after stock has been deducted, the system must automatically restore the deducted stock to maintain inventory integrity.

**Why this priority**: This is the core fix. Incomplete compensation causes inventory discrepancy which cascades into procurement, fulfillment, and accounting issues.

**Independent Test**: Trigger a saga failure after stock OUT step → verify stock is restored to original quantity.

**Acceptance Scenarios**:

1. **Given** stock has been deducted for Invoice A during posting, **When** the saga fails at the journal creation step, **Then** the deducted stock is automatically restored
2. **Given** a saga failure occurs after stock OUT, **When** compensation executes, **Then** the stock movement is reversed with a corresponding IN movement
3. **Given** compensation has completed, **When** viewing the product's stock, **Then** the quantity matches the pre-saga state

---

### User Story 2 - Stock Compensation Traceability (Priority: P1)

As an accountant, I must be able to trace any compensating stock movement back to its original failed transaction, so that I can audit and investigate inventory discrepancies.

**Why this priority**: Without traceability, stock adjustments appear as unexplained changes in audit logs.

**Independent Test**: Query compensating stock movement → see reference to original saga/movement.

**Acceptance Scenarios**:

1. **Given** a stock compensation has occurred, **When** viewing the compensating movement, **Then** it displays a reference to the original movement being reversed
2. **Given** a saga failed and was compensated, **When** reviewing the saga log, **Then** the compensation step is marked as completed (not just logged)

---

### User Story 3 - Journal Compensation Completeness (Priority: P2)

As an ERP system, when an invoice posting fails, any journal entries that were created before the failure must also be reversed to maintain accounting integrity.

**Why this priority**: Journal entries without stock/invoice are orphaned accounting records that corrupt financial statements.

**Independent Test**: Fail saga after journal creation → verify reversing journal entry exists.

**Acceptance Scenarios**:

1. **Given** a journal entry was created during invoice posting, **When** the saga fails at a later step, **Then** a reversing journal entry is created
2. **Given** compensation includes journal reversal, **When** viewing the general ledger, **Then** the net effect is zero (original + reversal cancel out)

---

### Edge Cases

- What happens if the compensation itself fails?
  - Mark saga as `COMPENSATION_FAILED` and log the error for manual review
- What happens if stock has already been adjusted by another process?
  - Record the compensation attempt; use available quantity if original restored quantity exceeds current
- What happens if the original product has been deleted?
  - Skip product-level stock adjustment but log the discrepancy

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST create an IN movement to reverse any OUT movement created during a failed saga
- **FR-002**: System MUST link compensating movements to the original movement via reference field
- **FR-003**: System MUST call `InventoryService.processReturn()` or equivalent reversal method during compensation
- **FR-004**: System MUST reverse any journal entries created before the saga failure point
- **FR-005**: System MUST update saga step tracking to reflect compensation actions taken
- **FR-006**: System MUST NOT use console.warn() as the sole compensation mechanism
- **FR-007**: Existing compensation logic for CreditNote and Payment sagas MUST remain unchanged (already correct)

### Key Entities

- **InventoryMovement**: Tracks stock IN/OUT. Compensation creates new IN movement referencing original OUT.
- **SagaLog**: Tracks saga steps. Compensation must mark stock reversal as completed.
- **PostingContext**: Stores stepData including stockMovementId used for compensation.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Zero orphaned stock movements after saga failures (verified by compensation test)
- **SC-002**: 100% of saga failures with stock OUT step have corresponding compensating IN movement (verified by integration test)
- **SC-003**: Net inventory change is zero after failed saga + compensation (verified by unit test)
- **SC-004**: All existing saga unit tests continue to pass after changes

---

## Assumptions

- The `InventoryService` has or can have a `processReturn()` or stock reversal method
- Stock movements are tracked with sufficient detail to reconstruct reversal
- The saga compensation is executed synchronously (not queued for later)
- Products are not deleted during the compensation window

---

## Out of Scope

- Implementing manual repair queue for `COMPENSATION_FAILED` cases (future enhancement)
- Adding domain events for alerting on compensation failures
- Freezing entities during compensation
- Parallel saga execution prevention (separate audit item D2)
