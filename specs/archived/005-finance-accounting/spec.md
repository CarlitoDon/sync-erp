# Feature Specification: Complete Finance and Accounting Module

**Feature Branch**: `005-finance-accounting`  
**Created**: 2025-12-10  
**Status**: Draft  
**Input**: User description: "Complete finance and accounting module"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Record Manual Journal Entries (Priority: P1)

As an accountant, I need to record manual journal entries so that I can adjust accounts for non-automated transactions like corrections, accruals, and provisions.

**Why this priority**: Core accounting functionality - without journal entries, no proper accounting records can be maintained.

**Independent Test**: Can be fully tested by creating a journal entry with debit/credit lines and verifying it appears in trial balance with correct amounts.

**Acceptance Scenarios**:

1. **Given** a user on the Finance page, **When** they click "New Journal Entry", **Then** they see a form with date, reference, memo, and line items.
2. **Given** a journal entry form, **When** user adds lines with account + debit OR credit amounts, **Then** the form validates debit = credit before saving.
3. **Given** a valid journal entry, **When** user saves it, **Then** the entry is persisted and trial balance updates immediately.

---

### User Story 2 - Accounts Payable Management (Priority: P2)

As a finance user, I need to view and manage bills (supplier invoices) and their payments so that I can track what the company owes to suppliers.

**Why this priority**: Essential for cash flow management - must know what to pay and when.

**Independent Test**: Can be tested by viewing list of bills, filtering by status, and recording a payment against a bill.

**Acceptance Scenarios**:

1. **Given** purchase orders have been received, **When** user navigates to Accounts Payable, **Then** they see a list of all bills with status and balance.
2. **Given** a posted bill, **When** user clicks "Record Payment", **Then** they can enter amount, method, and date.
3. **Given** a payment is recorded, **When** the full amount is paid, **Then** the bill status changes to PAID.

---

### User Story 3 - Accounts Receivable Management (Priority: P2)

As a finance user, I need to view and manage customer invoices and their payments so that I can track what customers owe us and follow up on overdue payments.

**Why this priority**: Critical for revenue collection - must monitor incoming cash.

**Independent Test**: Can be tested by viewing list of invoices, filtering by status/overdue, and recording a customer payment.

**Acceptance Scenarios**:

1. **Given** sales orders have been invoiced, **When** user navigates to Accounts Receivable, **Then** they see all invoices with customer, amount, due date, and status.
2. **Given** a posted invoice, **When** user records a payment, **Then** the invoice balance decreases by the payment amount.
3. **Given** an invoice is past due date, **When** viewing the AR list, **Then** it is visually highlighted as overdue.

---

### User Story 4 - Financial Reports (Priority: P3)

As a business owner, I need to generate standard financial reports (Income Statement, Balance Sheet) so that I can understand the financial health of my company.

**Why this priority**: Important but depends on other data being in place first.

**Independent Test**: Can be tested by generating an Income Statement and Balance Sheet after journal entries exist.

**Acceptance Scenarios**:

1. **Given** journal entries exist, **When** user selects "Income Statement", **Then** they see Revenue minus Expenses equals Net Income.
2. **Given** journal entries exist, **When** user selects "Balance Sheet", **Then** they see Assets = Liabilities + Equity.
3. **Given** viewing a report, **When** user selects a date range, **Then** the report filters to that period.

---

### User Story 5 - Automatic Journal Entry Generation (Priority: P3)

As an accountant, I need the system to automatically generate journal entries when invoices are posted and payments are recorded so that I don't have to manually double-entry every transaction.

**Why this priority**: Automation feature - helpful but manual entry works as fallback.

**Independent Test**: Can be tested by posting an invoice and verifying a journal entry is auto-created with correct accounts.

**Acceptance Scenarios**:

1. **Given** an AR invoice is posted, **When** the posting completes, **Then** a journal entry debits Accounts Receivable and credits Revenue.
2. **Given** a customer payment is recorded, **When** the payment is saved, **Then** a journal entry debits Cash and credits Accounts Receivable.
3. **Given** an AP bill is posted, **When** posting completes, **Then** a journal entry debits Expense/Inventory and credits Accounts Payable.

---

### Edge Cases

- What happens when a journal entry is unbalanced (debit ≠ credit)?
  - System MUST reject with clear validation error
- What happens when payment amount exceeds invoice balance?
  - System MUST reject with "Payment exceeds balance" error
- What happens when trying to void a paid invoice?
  - System MUST show warning and require all payments to be reversed first
- How to handle partial payments?
  - Invoice remains POSTED with reduced balance until fully paid

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow manual journal entry creation with date, reference, memo, and multiple line items
- **FR-002**: System MUST validate journal entries balance (total debits = total credits) before saving
- **FR-003**: System MUST display Accounts Payable list with filter by status (Draft, Posted, Paid, Void)
- **FR-004**: System MUST display Accounts Receivable list with filter by status and overdue indicator
- **FR-005**: System MUST allow recording payments against posted invoices/bills
- **FR-006**: System MUST update invoice balance when payments are applied
- **FR-007**: System MUST automatically change invoice status to PAID when balance reaches zero
- **FR-008**: System MUST generate Income Statement showing Revenue - Expenses = Net Income
- **FR-009**: System MUST generate Balance Sheet showing Assets = Liabilities + Equity
- **FR-010**: System MUST provide date range filtering for all financial reports
- **FR-011**: System MUST auto-generate journal entries when invoices are posted
- **FR-012**: System MUST auto-generate journal entries when payments are recorded
- **FR-013**: System MUST follow standard Chart of Accounts numbering: Assets (1xxx), Liabilities (2xxx), Equity (3xxx), Revenue (4xxx), Expenses (5xxx)

### Key Entities

- **Account**: Chart of Accounts entry with code, name, type. Already exists in schema.
- **JournalEntry**: Double-entry accounting record with date, reference, memo. Already exists in schema.
- **JournalLine**: Individual debit or credit line within a journal entry. Already exists in schema.
- **Invoice**: Existing entity - represents AR (customer invoices) and AP (supplier bills).
- **Payment**: Existing entity - records payments against invoices.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can create and save a balanced journal entry in under 2 minutes
- **SC-002**: Trial Balance always shows balanced totals (debit = credit) within 1 second of data change
- **SC-003**: Accounts Payable/Receivable lists load within 2 seconds for up to 1000 records
- **SC-004**: Financial reports (P&L, Balance Sheet) generate within 3 seconds for 12 months of data
- **SC-005**: Auto-generated journal entries for invoice posting complete within 500ms of the posting action
- **SC-006**: Overdue invoice highlighting displays accurately with 100% correctness based on current date vs due date

## Constitution Compliance _(mandatory for frontend features)_

### Frontend Architecture Checklist

- [ ] **Component Abstraction**: Any repeated UI pattern extracted to reusable component
- [ ] **Hook Abstraction**: Any repeated logic extracted to custom hook
- [ ] **No Copy-Paste**: No duplicate button styles, error handling, or API patterns
- [ ] **Global Error Handling**: Errors handled via Axios interceptor, not per-page try-catch
- [ ] **Success Toasts**: Using `apiAction()` helper, not direct toast imports
- [ ] **Confirmation Dialogs**: Using `useConfirm()` hook, not native `window.confirm()`
- [ ] **Systematic Updates**: All instances updated when changing patterns (grep verified)
