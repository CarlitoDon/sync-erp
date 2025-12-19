# Feature Specification: Create Bill (Manual Entry)

**Feature Branch**: `14-create-bill`  
**Created**: 2025-12-13  
**Status**: Draft  
**Input**: User description: "tambahkan create bill"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create Bill via Form (Priority: P1)

User wants to manually create a bill to record a supplier expense without going through the Purchase Order process. This is useful for:

- One-time expenses (utilities, services)
- Small purchases without formal PO
- Recording historical bills during system migration

**Why this priority**: Core functionality - without this, the feature has no value.

**Independent Test**: Can be fully tested by opening Bills page, clicking "Create Bill", filling form, submitting, and verifying the bill appears in the list.

**Acceptance Scenarios**:

1. **Given** user is on the Bills page, **When** user clicks "Create Bill" button, **Then** a form/modal opens with fields for supplier, amount, due date, and optional notes
2. **Given** user has filled required fields (supplier, amount), **When** user submits the form, **Then** a new bill is created with status DRAFT and appears in the bills list
3. **Given** user submits form, **When** the bill is created successfully, **Then** user sees a success notification and the form closes

---

### User Story 2 - Form Validation (Priority: P1)

User must be prevented from creating invalid bills to maintain data integrity.

**Why this priority**: Critical for data quality - invalid bills would corrupt accounting data.

**Independent Test**: Can be tested by submitting form with missing required fields and verifying appropriate error messages.

**Acceptance Scenarios**:

1. **Given** user opens Create Bill form, **When** user tries to submit without selecting a supplier, **Then** form shows validation error "Supplier is required"
2. **Given** user opens Create Bill form, **When** user enters amount as 0 or negative, **Then** form shows validation error "Amount must be greater than 0"
3. **Given** user enters invalid data, **When** validation fails, **Then** form highlights the invalid fields and shows specific error messages

---

### User Story 3 - Tax Calculation (Priority: P2)

User can optionally specify tax rate and the system calculates tax amount automatically.

**Why this priority**: Important for accurate accounting but has reasonable default (0% if not specified).

**Independent Test**: Can be tested by entering subtotal and tax rate, verifying calculated amounts.

**Acceptance Scenarios**:

1. **Given** user enters subtotal of 1,000,000; **When** user enters tax rate of 11%, **Then** system displays tax amount as 110,000 and total as 1,110,000
2. **Given** user does not enter tax rate, **When** form is submitted, **Then** bill is created with tax rate 0 and tax amount 0

---

### Edge Cases

- What happens when user tries to create bill with duplicate invoice number? → Show validation error
- What happens when selected supplier is deactivated after form opens? → Allow creation (supplier may still be valid for historical records)
- How does system handle very large amounts? → Accept up to standard decimal precision (2 decimal places)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a "Create Bill" button on the Bills (Accounts Payable) page
- **FR-002**: System MUST display a form/modal with fields: Supplier (required), Subtotal Amount (required), Tax Rate (optional), Due Date (optional), Notes (optional)
- **FR-003**: System MUST auto-generate a unique bill number using existing document number pattern (BILL-XXXXXX)
- **FR-004**: System MUST calculate total amount as: subtotal + (subtotal × tax rate)
- **FR-005**: System MUST validate that supplier is selected and amount is positive before submission
- **FR-006**: System MUST create the bill with status DRAFT (consistent with existing PO-based flow)
- **FR-007**: System MUST set balance equal to total amount on creation (no payments yet)
- **FR-008**: System MUST default due date to 30 days from creation if not specified
- **FR-009**: System MUST show success notification after bill creation
- **FR-010**: System MUST refresh the bills list after successful creation

### Key Entities

- **Bill**: Existing Invoice entity with type=BILL. Key attributes: invoiceNumber, partnerId (supplier), amount, subtotal, taxAmount, taxRate, balance, dueDate, status, notes
- **Partner**: Supplier/vendor who issued the bill. Must be of type SUPPLIER

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can create a manual bill in under 1 minute
- **SC-002**: 100% of bills created have valid supplier and positive amount
- **SC-003**: Calculated tax amount matches expected formula (subtotal × tax rate)
- **SC-004**: New bills appear in bills list immediately after creation

## Constitution Compliance _(mandatory for frontend features)_

### Frontend Architecture Checklist

- [ ] **Feature Isolation**: Logic in `src/features` (not global pages/components)
- [ ] **Component Abstraction**: Reuse existing form components and ActionButton
- [ ] **Hook Abstraction**: Use existing `apiAction()` and `useCompanyData()` hooks
- [ ] **No Copy-Paste**: No duplicate patterns from Invoice page
- [ ] **Global Error Handling**: Errors handled via Axios interceptor
- [ ] **Success Toasts**: Using `apiAction()` helper
- [ ] **Confirmation Dialogs**: Using `useConfirm()` hook if needed
- [ ] **Systematic Updates**: Follow existing AccountsPayable.tsx patterns
