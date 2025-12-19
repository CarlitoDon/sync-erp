# Feature Specification: Phase 1 Flow Completeness (Golden Paths Only)

**Feature Branch**: `029-flow-completeness`
**Created**: 2025-12-17
**Status**: Draft
**Input**: Validation of critical Phase 1 flows and disabling of non-golden paths.

---

## Overview

This feature focuses on verifying and hardening the "Golden Paths" for Phase 1 operations: **Receiving Goods**, **Posting Bills**, **Processing Payments**, and **Creating Credit Notes**. It also explicitly disables complex features (Partial Shipment, Multi-Currency, Backdated Posting) to ensure the system is "Better missing than wrong" (Apple Rule).

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Receive Goods (GRN) (Priority: P1)

As a **Warehouse Staff**, I want to receive goods from a Confirmed Purchase Order so that inventory is updated and the order is marked as Received/Completed.

**Why this priority**: Essential P2P flow. Without this, stock cannot be replenished legally.

**Independent Test**: Perform full GRN flow via API.

**Acceptance Scenarios**:

1. **Given** a CONFIRMED Purchase Order with 10 units, **When** I receive 10 units, **Then** Stock increases by 10, Journal stores value, PO status becomes COMPLETED.
2. **Given** a CONFIRMED Purchase Order, **When** I attempt to receive more than ordered, **Then** System rejects with `OVER_RECEIPT` error.
3. **Given** a DRAFT Purchase Order, **When** I attempt to receive, **Then** System rejects with `ORDER_INVALID_STATE`.

### User Story 2 - Post Vendor Bill (Priority: P1)

As a **Finance Staff**, I want to post a Vendor Bill linked to a PO so that our accounts payable is recorded.

**Why this priority**: Essential P2P flow. Records liability.

**Independent Test**: Post Bill via API.

**Acceptance Scenarios**:

1. **Given** a COMPLETED Purchase Order, **When** I post a matching Bill, **Then** AP Journal is created, Bill status becomes POSTED.
2. **Given** a Bill with amount differing from PO, **When** I attempt to post, **Then** System rejects with `AMOUNT_MISMATCH` (if strict matching enabled) or warrants warning.
3. **Given** a POSTED Bill, **When** I attempt to edit it, **Then** System rejects with `MUTATION_BLOCKED`.

### User Story 3 - Create Payment (Priority: P1)

As a **Finance Staff**, I want to record a payment for an Invoice or Bill so that the balance is reduced and status updated to PAID.

**Why this priority**: Completes the Cash cycle (O2C/P2P).

**Independent Test**: Create Payment via API.

**Acceptance Scenarios**:

1. **Given** a POSTED Invoice with balance $100, **When** I record full payment $100, **Then** Balance becomes $0, Invoice status becomes PAID, Cash Journal created.
2. **Given** a POSTED Invoice with balance $100, **When** I record partial payment $50, **Then** Balance becomes $50, Invoice status remains POSTED.
3. **Given** a POSTED Invoice, **When** I attempt to pay more than balance, **Then** System rejects with `PAYMENT_OVERPAYMENT`.

### User Story 4 - Create Credit Note (Priority: P1)

As a **Finance Staff**, I want to issue a Credit Note for an Invoice so that I can correct errors or process returns comfortably.

**Why this priority**: Required for "Forgiving Parsing" UX principle – allowing correction without hard deletes.

**Independent Test**: Create Credit Note via API.

**Acceptance Scenarios**:

1. **Given** a POSTED Invoice, **When** I create a full Credit Note, **Then** Invoice balance resets, reversal Journal created, Credit Note document generated.
2. **Given** a VOID Invoice, **When** I attempt to credit it, **Then** System rejects with `INVOICE_INVALID_STATE`.

---

## Requirements _(mandatory)_

### Functional Requirements

#### Flow Validation (Golden Paths)

- **FR-001**: **Receive Goods (GRN)** flow MUST be implemented using `SagaOrchestrator` with steps: Validate PO -> Lock PO -> Update Stock -> Create Journal -> Update PO Status.
- **FR-002**: **Post Vendor Bill** flow MUST be implemented using `SagaOrchestrator`.
- **FR-003**: **Create Payment** flow MUST be implemented using `SagaOrchestrator` (already validated in Roadmap Check, re-verify coverage).
- **FR-004**: **Create Credit Note** flow MUST be implemented using `SagaOrchestrator`.
- **FR-005**: All flows MUST have explicit `Compensation` steps defined for every Saga step.
- **FR-006**: All flows MUST use `idempotencyKey` scoped to entity (e.g., `[poId, 'receive']`).

#### Feature Disabling (Non-Golden Paths)

- **FR-007**: System MUST reject **Partial Shipments/Receipts** (only full receipt allowed in Phase 1) with error `FEATURE_DISABLED_PHASE_1`.
- **FR-008**: System MUST reject **Multi-Currency** transactions (all must be base currency) with error `FEATURE_DISABLED_PHASE_1`.
- **FR-009**: System MUST reject **Backdated Posting** (businessDate < determined closed period or explicit limit) or warn. For Phase 1, strictly block if logic exists, otherwise ensure `businessDate` defaults to TODAY/NOW.

#### Traceability & Safety

- **FR-010**: All created Journal Entries MUST have `sourceType` and `sourceId` populated.
- **FR-011**: All Saga executions MUST log start, steps, and result to `SagaLog`.

### Key Entities

- **PurchaseOrder**: Source for GRN.
- **StockMovement**: Result of GRN.
- **Bill**: Vendor Invoice.
- **Payment**: Cash transaction.
- **CreditNote**: Reversal document.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 4/4 Golden Flows (GRN, Bill, Payment, Credit Note) have passing "Happy Path" Integration Tests.
- **SC-002**: 4/4 Golden Flows have passing "Saga Failure/Compensation" Integration Tests.
- **SC-003**: 100% of defined "Non-Golden" inputs (partial, multi-currency) are rejected by API.
- **SC-004**: `FLOW.md` documentation exists for all 4 flows, listing preconditions and steps.

---

## Constitution Compliance

### Technical Architecture Checklist

- [ ] **Saga Pattern**: All complex writes use Saga.
- [ ] **Idempotency**: All commands accept idempotency keys.
- [ ] **Layering**: Controllers delegate to Services/Sagas, no logic in Controller.

### Human Experience Checklist

- [ ] **Error Clarity**: Rejection of non-golden paths gives clear "Not available in Phase 1" or similar friendly message, not generic 500.
