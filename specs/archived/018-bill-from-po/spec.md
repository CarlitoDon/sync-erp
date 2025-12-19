# Feature Specification: Create Bill from Purchase Order

**Feature Branch**: `018-bill-from-po`  
**Created**: 2025-12-15  
**Status**: Draft  
**Input**: User description: "Create Bill from Purchase Order - Add ability to create bills directly from completed Purchase Orders"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create Bill from Completed PO (Priority: P1)

As a finance/accounting user, I want to create a supplier bill directly from a completed Purchase Order, so that I can track what I owe to suppliers based on received goods.

**Why this priority**: This is the core feature that connects the procurement flow to the accounts payable flow. Without this, users must manually re-enter PO details when creating bills, leading to errors and duplicated work.

**Independent Test**: Can be fully tested by completing a Purchase Order, then creating a bill from it, and verifying the bill amount matches the PO total.

**Acceptance Scenarios**:

1. **Given** a Purchase Order with status COMPLETED, **When** user clicks "Create Bill", **Then** a new bill is created in DRAFT status with amount matching the PO total (including tax)
2. **Given** a Purchase Order with status COMPLETED, **When** user creates a bill from it, **Then** the bill is linked to the PO and shows the supplier name from the PO
3. **Given** a Purchase Order with status DRAFT or CONFIRMED (not COMPLETED), **When** user views the PO, **Then** the "Create Bill" action is not available

---

### User Story 2 - View PO Details in Bill (Priority: P2)

As a finance user, I want to see which Purchase Order a bill is linked to, so that I can trace the bill back to the original order for auditing.

**Why this priority**: Provides traceability between procurement and accounting, essential for audits and reconciliation but secondary to actually creating the bill.

**Independent Test**: Can be tested by creating a bill from a PO and verifying the bill detail view shows PO reference.

**Acceptance Scenarios**:

1. **Given** a bill created from a Purchase Order, **When** user views the bill details, **Then** the linked PO number is displayed
2. **Given** a bill created manually (without PO), **When** user views the bill details, **Then** no PO reference is shown (or shows "Manual Bill")

---

### User Story 3 - Prevent Duplicate Bills from Same PO (Priority: P2)

As a finance user, I want the system to warn me if I try to create a bill from a PO that already has a bill, so that I don't accidentally create duplicate bills for the same purchase.

**Why this priority**: Prevents data integrity issues and double-payment risks. Important for accuracy but not blocking the core flow.

**Independent Test**: Can be tested by creating a bill from a PO, then attempting to create another bill from the same PO.

**Acceptance Scenarios**:

1. **Given** a Purchase Order that already has a bill, **When** user attempts to create another bill, **Then** a warning is shown asking for confirmation
2. **Given** user confirms they want to create a second bill, **When** confirmed, **Then** the second bill is created (for scenarios like partial billing or corrections)

---

### Edge Cases

- What happens if the PO has zero total amount? → System should prevent bill creation with validation error
- What happens if the PO's supplier is deleted? → Bill should still be creatable (supplier linked via partnerId)
- What happens if user tries to void a bill linked to a PO? → Standard void behavior applies, PO remains unchanged

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow creating a bill from a Purchase Order with status COMPLETED
- **FR-002**: System MUST copy PO amount (including tax) to the new bill's amount
- **FR-003**: System MUST link the bill to the source PO via orderId field
- **FR-004**: System MUST use the PO's supplier (partnerId) for the bill
- **FR-005**: System MUST show "Create Bill" button on completed Purchase Orders
- **FR-006**: System MUST NOT show "Create Bill" button on non-completed Purchase Orders
- **FR-007**: System MUST display a warning if the PO already has an existing bill
- **FR-008**: System MUST show the linked PO number in bill detail/list views
- **FR-009**: System MUST auto-generate bill number using existing document number service

### Key Entities

- **Bill (Invoice)**: Represents supplier invoice, linked to PO via optional orderId field (already exists in schema)
- **Purchase Order**: Source document for the bill (type=PURCHASE, already exists)
- **Partner (Supplier)**: The supplier to whom the bill is owed (already exists)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can create a bill from a completed PO in under 30 seconds (2 clicks: "Create Bill" → confirm)
- **SC-002**: 100% of bills created from POs have matching amounts (no manual entry errors)
- **SC-003**: Users can trace any bill back to its source PO if one exists
- **SC-004**: System prevents duplicate bill creation with clear warning (user must explicitly confirm to proceed)

## Constitution Compliance _(mandatory for frontend features)_

### Frontend Architecture Checklist

- [x] **Feature Isolation**: Logic in `src/features/procurement` (extends existing PO page)
- [x] **Component Abstraction**: Uses existing ActionButton, FormModal components
- [x] **Hook Abstraction**: Uses existing useCompanyData, useConfirm hooks
- [x] **No Copy-Paste**: Reuses bill creation service already in billService.ts
- [x] **Global Error Handling**: Uses Axios interceptor pattern
- [x] **Success Toasts**: Using `apiAction()` helper
- [x] **Confirmation Dialogs**: Using `useConfirm()` hook for duplicate warning
- [x] **Systematic Updates**: Minimal changes needed, extends existing patterns

## Assumptions

- The `orderId` field already exists on the Invoice/Bill model (confirmed from schema)
- Backend `createFromPurchaseOrder` service method already exists (confirmed from code review)
- Only COMPLETED Purchase Orders can have bills created from them
- Default due date is 30 days from bill creation (existing behavior)
- Tax rate from PO is carried over to the bill
