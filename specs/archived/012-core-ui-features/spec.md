# Feature Specification: Core UI Features

**Feature Branch**: `012-core-ui-features`
**Created**: 2025-12-12
**Status**: Draft
**Input**: User description provided in prompt.

## User Scenarios & Testing

### User Story 1 - Inventory Operations (Priority: P1)

As a Warehouse Staff or Inventory Manager, I want to receive goods from purchase orders and manually adjust stock levels so that inventory records match physical reality.

**Why this priority**: Core functionality needed to maintain accurate inventory. Without this, the system cannot track actual stock.

**Independent Test**: Can be tested by creating a PO, receiving it, and checking stock increase. Can be tested by manually adjusting stock and verifying the change.

**Acceptance Scenarios**:

1. **Given** a "Pending" Purchase Order, **When** I click "Receive Goods" and enter quantities, **Then** the stock levels increase and PO status updates to "Received".
2. **Given** a product in inventory, **When** I click "Adjust Stock" and enter a new quantity with a reason, **Then** the stock level updates and an adjustment record is created.

---

### User Story 2 - Payment History (Priority: P2)

As a Finance Officer, I want to view the history of payments for a specific invoice or bill so that I can audit transactions and see remaining balances.

**Why this priority**: Essential for financial tracking and ensuring invoices are fully paid.

**Independent Test**: Create an invoice, record multiple partial payments, and verify the history list shows all of them.

**Acceptance Scenarios**:

1. **Given** an Invoice with previous partial payments, **When** I view the Invoice details, **Then** I see a list of all past payments including date, amount, and reference.
2. **Given** an Invoice with no payments, **When** I view details, **Then** the payment history section indicates "No payments yet".

---

### User Story 3 - Team Management (Priority: P2)

As an Admin, I want to invite new users and assign them to companies so that the team can collaborate within the system.

**Why this priority**: Required for multi-user adoption. Currently, no UI exists to add team members.

**Independent Test**: Invite a new email, verify user creation. Assign user to Company A, verify they can access Company A.

**Acceptance Scenarios**:

1. **Given** I am an Admin, **When** I enter an email to invite a user, **Then** a new user account is created/invited.
2. **Given** a list of users, **When** I select a user and assign them to "Company X", **Then** that user gains access to "Company X".

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow users to receive goods for a specific Purchase Order via `POST /api/inventory/goods-receipt`.
- **FR-002**: System MUST allow users to adjust stock levels manually with a reason via `POST /api/inventory/adjust`.
- **FR-003**: System MUST display payment history (date, amount, ref) on Invoice and Bill detail pages via `GET /api/payments/invoice/:invoiceId`.
- **FR-004**: System MUST allow Admins to invite new users via `POST /api/users`.
- **FR-005**: System MUST allow Admins to assign users to specific companies via `POST /api/users/:userId/assign`.
- **FR-006**: System MUST calculate and display the remaining balance for Invoices/Bills based on history.

### Key Entities

- **Goods Receipt**: Links PO to Inventory movement.
- **Stock Adjustment**: Manual change to inventory count.
- **Payment Record**: Individual transaction against an Invoice/Bill.
- **UserAssignment**: Link between User and Company.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Warehouse staff can complete a Goods Receipt in under 1 minute.
- **SC-002**: Finance users can see payment history immediately upon opening Invoice details (no extra clicks).
- **SC-003**: 100% of stock adjustments require a "Reason" to be entered.
- **SC-004**: Newly invited users act on the "Team" list immediately after creation.

## Constitution Compliance

### Frontend Architecture Checklist

- [ ] **Feature Isolation**: Logic in `src/features/inventory`, `src/features/finance` (payments), `src/features/company` (team/users).
- [ ] **Component Abstraction**: Reuse `ConfirmModal`, `ActionButton`, and table components.
- [ ] **Hook Abstraction**: Create `useInventoryActions`, `useTeamManagement` hooks.
- [ ] **No Copy-Paste**: Ensure payment history list component is shared or similar for AR/AP.
- [ ] **Global Error Handling**: Errors handled via Axios interceptor.
- [ ] **Success Toasts**: Using `apiAction()` helper for all mutations (Receive, Adjust, Invite, Assign).
- [ ] **Confirmation Dialogs**: Using `useConfirm()` hook for critical actions (Assign, Adjust).
- [ ] **Systematic Updates**: All new pages follow existing Layout structure.
