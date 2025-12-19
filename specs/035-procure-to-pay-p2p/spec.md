# Feature Specification: Procure-to-Pay (P2P) Flow

**Feature Branch**: `035-procure-to-pay-p2p`  
**Created**: 2025-12-19  
**Status**: Draft  
**Input**: User description: "Implement Procure-to-Pay P2P business flow with PO creation, GRN receiving, Bill creation, and Payment processing"

## Clarifications

### Session 2025-12-19

- Q: Is spec aligned with P2P flow document (`docs/flows/procure-to-pay-p2p.md`)? → A: Yes, with gaps filled (Void Bill and Void Payment stories added)
- Added: User Story 7 (Void Bill) and User Story 8 (Void Payment) to match Cancellation & Rollback Flows section
- Added: FR-018 (Void Bill) and FR-019 (Void Payment) functional requirements

**Gap Fixes Round 1 (Critical Gaps):**

- Added: FR-020 (3-way matching exact match tolerance)
- Added: FR-021 to FR-024 (Audit trail requirements)
- Added: User Roles & Permissions matrix (5 roles, 10 operations)
- Added: FR-025, FR-026 (Role-based access control)
- Added: FR-027 to FR-029 (Concurrency & data integrity with optimistic locking)
- Added: Audit Log entity

**Gap Fixes Round 2 (100% Checklist Pass):**

- Added: FR-030 to FR-034 (Document numbering formats)
- Added: FR-035 to FR-038 (Invalid state transitions)
- Added: FR-039 to FR-042 (Calculation formulas)
- Added: FR-043 to FR-045 (Journal entry configuration)
- Added: FR-046 to FR-048 (Shortcut flows)
- Added: FR-049 to FR-051 (Price discrepancy handling)
- Added: FR-052 to FR-054 (Network failure handling)
- Added: Error Messages table (16 codes: E001-E304)
- Added: Detailed Key Entities with required/optional fields
- Added: CoA Structure table
- Added: Payment Terms table
- Added: SC-007 Measurement Methodology

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create and Confirm Purchase Order (Priority: P1)

Purchasing staff creates a purchase order to order goods from a supplier. They select the supplier, add line items with products, quantities, and unit prices, then confirm the PO to make it ready for goods receipt.

**Why this priority**: This is the entry point of the P2P flow. Without a confirmed PO, no subsequent steps (GRN, Bill, Payment) can proceed.

**Integration Scenario**: Full flow from PO creation via UI/API → database record with status DRAFT → confirm action → status changes to CONFIRMED → PO appears in "ready for receiving" list.

**Acceptance Scenarios**:

1. **Given** user is on Purchase Orders page, **When** user clicks "+ New Purchase Order", fills supplier, adds items, and saves, **Then** PO is created with status `DRAFT` and unique PO number.
2. **Given** PO with status `DRAFT`, **When** user clicks "Confirm PO", **Then** PO status changes to `CONFIRMED` and appears in GRN pending list.
3. **Given** PO with status `CONFIRMED`, **When** user attempts to edit PO, **Then** system prevents editing and shows appropriate message.

---

### User Story 2 - Receive Goods (GRN) (Priority: P1)

Warehouse staff receives goods from supplier against a confirmed PO. They verify received quantities, input actual received amounts (which may be partial), and post the GRN to update inventory.

**Why this priority**: Stock cannot increase without GRN posting. This is required before Bills can be created (3-way matching).

**Integration Scenario**: Full flow from confirmed PO → create GRN → input received quantities → post GRN → inventory stock increases → PO status updates to PARTIALLY_RECEIVED or RECEIVED.

**Acceptance Scenarios**:

1. **Given** PO with status `CONFIRMED`, **When** warehouse user creates GRN from PO, **Then** GRN is created with status `DRAFT` containing PO line items.
2. **Given** GRN with status `DRAFT`, **When** user inputs received quantities and posts, **Then** inventory stock increases by received quantity and GRN status becomes `POSTED`.
3. **Given** PO ordered 100 units, GRN receives 40 units, **When** GRN is posted, **Then** PO status changes to `PARTIALLY_RECEIVED` and remaining 60 units can still be received.
4. **Given** GRN receiving quantity 50 for a PO line with remaining qty 30, **When** user attempts to save, **Then** validation error is shown: "Cannot receive more than remaining PO quantity".

---

### User Story 3 - Create and Post Bill (Priority: P1)

Finance staff creates a bill (supplier invoice) from a posted GRN. They verify the invoice details match the GRN and PO, then post to create Accounts Payable entry.

**Why this priority**: Bills create the legal liability (AP). Required for payment processing and financial reporting.

**Integration Scenario**: Full flow from posted GRN → create Bill → enter supplier invoice number → post Bill → AP increases → journal entry created (Dr: Inventory, Cr: AP).

**Acceptance Scenarios**:

1. **Given** GRN with status `POSTED` that hasn't been billed, **When** finance user creates Bill from GRN, **Then** Bill is created with status `DRAFT` containing GRN line items and amounts.
2. **Given** Bill with status `DRAFT`, **When** user enters supplier invoice number and posts, **Then** Bill status becomes `POSTED` and AP account balance increases.
3. **Given** no GRN exists for a PO, **When** user attempts to create Bill directly from PO, **Then** system prevents creation with message: "Goods must be received before creating Bill".
4. **Given** 3-way matching enabled, bill qty/price doesn't match GRN/PO, **When** user attempts to post, **Then** validation error shows mismatch details.

---

### User Story 4 - Record Payment (Priority: P2)

Finance staff records payment against a posted Bill. They select the bank/cash account and enter payment amount (full or partial).

**Why this priority**: Completes the P2P cycle. Lower priority than Bill because Bills can exist unpaid for a period (payment terms).

**Integration Scenario**: Full flow from posted Bill → record payment → select bank account → enter amount → AP decreases → bank balance decreases → journal entry created (Dr: AP, Cr: Bank).

**Acceptance Scenarios**:

1. **Given** Bill with status `POSTED` and outstanding amount 1,000,000, **When** user records full payment, **Then** Bill status becomes `PAID`, AP decreases by 1,000,000, bank decreases by 1,000,000.
2. **Given** Bill with outstanding 1,000,000, **When** user records partial payment of 400,000, **Then** Bill status becomes `PARTIALLY_PAID`, remaining outstanding is 600,000.
3. **Given** Bill with status `DRAFT`, **When** user attempts to record payment, **Then** system prevents with message: "Cannot pay unposted Bill".
4. **Given** Bill with outstanding 500,000, **When** user attempts to pay 600,000, **Then** validation error: "Payment amount cannot exceed outstanding amount".

---

### User Story 5 - Cancel Purchase Order (Priority: P3)

Purchasing staff cancels a confirmed PO that is no longer needed, before any goods are received.

**Why this priority**: Edge case handling. Not part of normal happy path.

**Integration Scenario**: Confirmed PO → cancel → status CANCELLED → PO no longer appears in receivable list.

**Acceptance Scenarios**:

1. **Given** PO with status `CONFIRMED` and no GRN created, **When** user clicks "Cancel PO", **Then** PO status becomes `CANCELLED`.
2. **Given** PO with status `CONFIRMED` and has partial GRN, **When** user attempts to cancel, **Then** system prevents with message: "Cannot cancel PO with existing receipts".

---

### User Story 6 - Void GRN (Priority: P3)

Warehouse manager voids a posted GRN (e.g., goods returned or data entry error) before Bill is created.

**Why this priority**: Error correction flow. Less common than normal processing.

**Integration Scenario**: Posted GRN → void → inventory stock decreases (rollback) → PO status recalculated.

**Acceptance Scenarios**:

1. **Given** GRN with status `POSTED` and no linked Bill, **When** manager voids GRN, **Then** inventory stock decreases by GRN quantity, GRN status becomes `VOIDED`, PO status recalculated.
2. **Given** GRN with status `POSTED` and has linked Bill, **When** user attempts to void, **Then** system prevents with message: "Cannot void GRN with linked Bill".

---

### User Story 7 - Void Bill (Priority: P3)

Finance manager voids a posted Bill (e.g., incorrect invoice data or reversed GRN) before any payment is made.

**Why this priority**: Error correction flow for finance. Less common than normal processing.

**Integration Scenario**: Posted Bill → void → AP reversed (contra journal) → GRN can be billed again.

**Acceptance Scenarios**:

1. **Given** Bill with status `POSTED` and no linked Payment, **When** finance manager voids Bill, **Then** AP journal is reversed, Bill status becomes `VOIDED`, GRN can be billed again.
2. **Given** Bill with status `POSTED` and has linked Payment, **When** user attempts to void, **Then** system prevents with message: "Cannot void Bill with existing payments. Void payments first."

---

### User Story 8 - Void Payment (Priority: P3)

Finance manager voids a completed payment (e.g., payment error or chargeback).

**Why this priority**: Error correction flow. Least common operation in P2P cycle.

**Integration Scenario**: Completed Payment → void → AP restored → Bank balance restored → Bill status recalculated.

**Acceptance Scenarios**:

1. **Given** Payment with status `COMPLETED` linked to fully paid Bill, **When** finance manager voids payment, **Then** Bill status changes back to `POSTED`, AP balance increases, Bank balance increases.
2. **Given** multiple partial payments on Bill, **When** one payment is voided, **Then** Bill status changes to `PARTIALLY_PAID` with updated outstanding amount.

---

### Edge Cases

- What happens when user tries to receive goods for a cancelled PO?
  - System should prevent GRN creation with clear error message.
- What happens when supplier invoice has different price than PO?
  - 3-way matching validation fails, user must resolve discrepancy before posting.
- What happens when partial payment is made and Bill is voided?
  - Payment must be voided first before Bill can be voided.
- What happens when PO is partially received and needs to be closed?
  - System should allow "Close PO" action to change status to RECEIVED even with remaining quantities.

### Error Messages

| Code | Context         | Message                                                                         |
| ---- | --------------- | ------------------------------------------------------------------------------- |
| E001 | Create GRN      | "Cannot create GRN: PO is not yet confirmed."                                   |
| E002 | Create GRN      | "Cannot receive more than remaining PO quantity ({remaining} available)."       |
| E003 | Create GRN      | "Cannot create GRN: PO has been cancelled."                                     |
| E004 | Create GRN      | "Product {product} is not in this PO."                                          |
| E101 | Create Bill     | "Cannot create Bill: No goods have been received for this PO."                  |
| E102 | Create Bill     | "Cannot create Bill: GRN has already been billed."                              |
| E103 | Post Bill       | "3-way matching failed: {field} mismatch (PO: {po_value}, Bill: {bill_value})." |
| E104 | Save Bill       | "Supplier invoice number {number} already exists for this supplier."            |
| E201 | Record Payment  | "Cannot record payment: Bill has not been posted."                              |
| E202 | Record Payment  | "Payment amount ({amount}) exceeds outstanding balance ({outstanding})."        |
| E203 | Record Payment  | "Insufficient balance in selected account."                                     |
| E204 | Record Payment  | "Cannot record payment: Bill is already fully paid."                            |
| E301 | Cancel PO       | "Cannot cancel PO: Goods have already been received."                           |
| E302 | Void GRN        | "Cannot void GRN: Bill has already been created from this GRN."                 |
| E303 | Void Bill       | "Cannot void Bill: Payments exist. Void payments first."                        |
| E304 | Concurrent Edit | "Document has been modified by another user. Please refresh and try again."     |

## Requirements _(mandatory)_

### Functional Requirements

**Purchase Order:**

- **FR-001**: System MUST allow users to create Purchase Orders with supplier, date, payment terms, and line items.
- **FR-002**: System MUST generate unique, sequential PO numbers automatically.
- **FR-003**: System MUST enforce status transitions: DRAFT → CONFIRMED → PARTIALLY_RECEIVED → RECEIVED, with CANCELLED branch from CONFIRMED.
- **FR-004**: System MUST prevent editing of confirmed POs.

**Document Numbering:**

- **FR-030**: PO numbers MUST follow format: `PO-YYYYMM-NNNNN` (e.g., PO-202412-00001).
- **FR-031**: GRN numbers MUST follow format: `GRN-YYYYMM-NNNNN` (e.g., GRN-202412-00001).
- **FR-032**: Bill numbers MUST follow format: `BILL-YYYYMM-NNNNN` (e.g., BILL-202412-00001).
- **FR-033**: Payment numbers MUST follow format: `PAY-YYYYMM-NNNNN` (e.g., PAY-202412-00001).
- **FR-034**: Sequence numbers MUST reset to 00001 at the start of each month.

**Invalid State Transitions (MUST be rejected):**

- **FR-035**: System MUST reject these PO transitions: DRAFT→RECEIVED, DRAFT→PARTIALLY_RECEIVED, CONFIRMED→DRAFT, CANCELLED→any.
- **FR-036**: System MUST reject these GRN transitions: DRAFT→VOIDED, POSTED→DRAFT, VOIDED→any.
- **FR-037**: System MUST reject these Bill transitions: DRAFT→PAID, DRAFT→PARTIALLY_PAID, POSTED→DRAFT, VOIDED→any.
- **FR-038**: System MUST reject these Payment transitions: PENDING→VOIDED (must complete first), COMPLETED→PENDING, VOIDED→any.

**Goods Receipt (GRN):**

- **FR-005**: System MUST only allow GRN creation from CONFIRMED POs.
- **FR-006**: System MUST validate that received quantity does not exceed remaining PO quantity.
- **FR-007**: System MUST update inventory stock when GRN is posted.
- **FR-008**: System MUST update PO status based on received quantities (PARTIALLY_RECEIVED or RECEIVED).
- **FR-009**: System MUST support voiding of GRN before Bill is created, with stock rollback.

**Bill:**

- **FR-010**: System MUST only allow Bill creation from posted GRN (not directly from PO).
- **FR-011**: System MUST validate 3-way matching (PO qty/price, GRN qty, Bill qty/price) before posting.
- **FR-012**: System MUST create AP journal entry when Bill is posted (Dr: Inventory/Expense, Cr: Accounts Payable).
- **FR-013**: System MUST track supplier invoice number and prevent duplicates per supplier.

**Payment:**

- **FR-014**: System MUST only allow payment for POSTED Bills.
- **FR-015**: System MUST support partial payments with remaining balance tracking.
- **FR-016**: System MUST update Bill status based on payment (PARTIALLY_PAID or PAID).
- **FR-017**: System MUST create payment journal entry (Dr: Accounts Payable, Cr: Bank/Cash).
- **FR-018**: System MUST support voiding of Bill before Payment is made, with AP reversal journal.
- **FR-019**: System MUST support voiding of Payment with proper Bill status recalculation and balance restoration.

**3-Way Matching:**

- **FR-020**: System MUST enforce exact match (zero tolerance) for 3-way matching:
  - Bill quantity MUST equal GRN received quantity
  - Bill unit price MUST equal PO unit price
  - Any discrepancy MUST be resolved before Bill can be posted

**Audit Trail:**

- **FR-021**: System MUST log all void/cancel operations with user, timestamp, and reason.
- **FR-022**: System MUST maintain complete history of status changes for all documents (PO, GRN, Bill, Payment).
- **FR-023**: Audit logs MUST be immutable and not deletable by any user.
- **FR-024**: Void operations MUST require a mandatory reason field.

### User Roles & Permissions

| Role                  | Create PO | Confirm PO | Create GRN | Post GRN | Void GRN | Create Bill | Post Bill | Void Bill | Record Payment | Void Payment |
| --------------------- | --------- | ---------- | ---------- | -------- | -------- | ----------- | --------- | --------- | -------------- | ------------ |
| **Purchasing Staff**  | ✅        | ✅         | ❌         | ❌       | ❌       | ❌          | ❌        | ❌        | ❌             | ❌           |
| **Warehouse Staff**   | ❌        | ❌         | ✅         | ✅       | ❌       | ❌          | ❌        | ❌        | ❌             | ❌           |
| **Warehouse Manager** | ❌        | ❌         | ✅         | ✅       | ✅       | ❌          | ❌        | ❌        | ❌             | ❌           |
| **Finance Staff**     | ❌        | ❌         | ❌         | ❌       | ❌       | ✅          | ✅        | ❌        | ✅             | ❌           |
| **Finance Manager**   | ❌        | ❌         | ❌         | ❌       | ❌       | ✅          | ✅        | ✅        | ✅             | ✅           |

- **FR-025**: System MUST enforce role-based access control as defined in the permission matrix above.
- **FR-026**: Void operations (GRN, Bill, Payment) MUST require Manager-level permission.

### Concurrency & Data Integrity

- **FR-027**: System MUST use optimistic locking to prevent concurrent edits to the same document.
- **FR-028**: When concurrent edit is detected, system MUST reject the later save with message: "Document has been modified. Please refresh and try again."
- **FR-029**: Status-changing operations (confirm, post, void) MUST be atomic and use database transactions.

**Calculation Formulas:**

- **FR-039**: Remaining PO Quantity = PO Line Qty - SUM(all posted GRN Line Qty for that PO Line).
- **FR-040**: Outstanding Bill Amount = Bill Total - SUM(all completed Payment amounts for that Bill).
- **FR-041**: PO status becomes RECEIVED when Remaining PO Quantity = 0 for ALL lines.
- **FR-042**: Bill status becomes PAID when Outstanding Bill Amount = 0.

**Journal Entry Configuration:**

- **FR-043**: Bill posting journal: Debit Account = Inventory Asset (configurable per product category), Credit Account = Accounts Payable (default: 2100).
- **FR-044**: Payment journal: Debit Account = Accounts Payable (2100), Credit Account = selected Bank/Cash account.
- **FR-045**: Journal entries MUST be created synchronously within the same database transaction as the post operation.

**Shortcut Flows:**

- **FR-046**: From PO detail page, user MUST be able to directly access: Confirm, Receive Goods (create GRN), Cancel.
- **FR-047**: From GRN detail page, user MUST be able to directly access: Post, Create Bill.
- **FR-048**: From Bill detail page, user MUST be able to directly access: Post, Record Payment.

**Price Discrepancy Handling:**

- **FR-049**: When Bill price differs from PO price, system MUST display side-by-side comparison.
- **FR-050**: User MUST explicitly acknowledge discrepancy before Bill can be saved (checkbox: "I confirm this price variance is intentional").
- **FR-051**: Acknowledged variances MUST be logged in audit trail with reason.

**Network Failure Handling:**

- **FR-052**: All post operations MUST use database transactions; on failure, entire operation rolls back.
- **FR-053**: System MUST display clear error message on transaction failure: "Operation failed. Please try again."
- **FR-054**: Failed operations MUST NOT leave documents in inconsistent state.

### Key Entities

**Purchase Order (PO):**

- Required fields: PO Number (auto), Supplier, PO Date, Payment Terms, Status
- Optional fields: Notes, Expected Delivery Date
- Statuses: DRAFT, CONFIRMED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED

**PO Line Item:**

- Required fields: Product, Quantity, Unit Price
- Calculated: Line Total = Quantity × Unit Price

**Goods Receipt Note (GRN):**

- Required fields: GRN Number (auto), PO Reference, Received Date, Received By (user), Status
- Optional fields: Notes, Delivery Reference
- Statuses: DRAFT, POSTED, VOIDED

**GRN Line Item:**

- Required fields: PO Line Reference, Received Quantity
- Validation: Received Quantity ≤ Remaining PO Quantity

**Bill:**

- Required fields: Bill Number (auto), Supplier Invoice Number, Bill Date, Due Date, Status
- Optional fields: Notes
- Statuses: DRAFT, POSTED, PARTIALLY_PAID, PAID, VOIDED

**Bill Line Item:**

- Required fields: GRN Line Reference, Quantity, Unit Price
- Calculated: Line Total = Quantity × Unit Price

**Payment:**

- Required fields: Payment Number (auto), Bill Reference, Bank/Cash Account, Payment Date, Amount, Status
- Optional fields: Reference Number, Notes
- Statuses: PENDING, COMPLETED, VOIDED

**Audit Log:**

- Required fields: Timestamp, User, Document Type, Document ID, Action, Previous Status, New Status, Reason (for voids)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can complete full P2P cycle (PO → GRN → Bill → Payment) in under 10 minutes for a typical 5-line order.
- **SC-002**: System prevents 100% of out-of-sequence transactions (e.g., Bill without GRN).
- **SC-003**: 3-way matching catches all discrepancies between PO, GRN, and Bill.
- **SC-004**: Inventory stock accurately reflects all posted GRNs within 1 second of posting.
- **SC-005**: AP balance accurately reflects all posted Bills and Payments.
- **SC-006**: All void/cancel operations correctly reverse their effects (stock, AP, balances).
- **SC-007**: 95% of users can complete P2P flow without external help on first attempt.

### SC-007 Measurement Methodology

- **Sample**: New users onboarded to P2P module (minimum 20 users per measurement period)
- **Task**: Complete one full P2P cycle (create PO → receive goods → create bill → record payment)
- **Success Criteria**: User completes task without asking for help from support, documentation, or colleagues
- **Measurement**: Post-task survey + system analytics (help button clicks, error rates)
- **Threshold**: ≥19 out of 20 users (95%) complete successfully

## Assumptions

- Suppliers, Products, and Chart of Accounts (CoA) are already set up in the system.
- Single currency is assumed (no multi-currency handling in this feature).
- No approval workflow required for PO confirmation (single-user approval assumed).
- Tax calculation is out of scope (assumed handled by separate tax module).
- Standard payment terms (Net 30, Net 60, etc.) are predefined in system.

### Chart of Accounts (CoA) Structure

| Account Code | Account Name     | Type      | Usage                                 |
| ------------ | ---------------- | --------- | ------------------------------------- |
| 1200         | Inventory Asset  | Asset     | Debit on Bill post (goods received)   |
| 2100         | Accounts Payable | Liability | Credit on Bill post, Debit on Payment |
| 1000-1099    | Bank Accounts    | Asset     | Credit on Payment                     |
| 1100-1199    | Cash Accounts    | Asset     | Credit on Payment                     |

### Payment Terms

| Code  | Name             | Days   | Description                   |
| ----- | ---------------- | ------ | ----------------------------- |
| NET30 | Net 30           | 30     | Due 30 days from invoice date |
| NET60 | Net 60           | 60     | Due 60 days from invoice date |
| NET90 | Net 90           | 90     | Due 90 days from invoice date |
| COD   | Cash on Delivery | 0      | Due immediately upon delivery |
| EOM   | End of Month     | varies | Due at end of invoice month   |

## Out of Scope

- Multi-currency transactions
- PO approval workflow with multiple approvers
- Automated reorder points / suggested POs
- Vendor rating / evaluation
- Purchase returns (return to vendor)
- Landed cost calculation
