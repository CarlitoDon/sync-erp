# Feature Specification: Finance Tax, Returns & Accruals

**Feature Branch**: `007-finance-tax-returns`
**Created**: 2025-12-11
**Status**: Draft
**Input**: User description: "Implement VAT accounting, Sales Return reversal, and Goods Receipt Accrual"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Flexible Tax Selection (Priority: P1)

As a Sales/Finance User, I want to be able to select the applicable Tax Rate (e.g., No Tax, 11%, 12%) when creating a Sales Order or Invoice, so that I can handle different transaction types (Export, Regular, Exempt) accurately.

**Why this priority**:
Business reality. Not all transactions are 11%; upcoming 12% changes and non-taxable exports need to be supported.

**Independent Test**:
Can be tested by creating three different Invoices with 0%, 11%, and 12% rates and verifying the Journal Entries reflect the specific calculation for each.

**Acceptance Scenarios**:

1. **Given** a Sales Order creation form,
   **When** I view the "Tax" field,
   **Then** I should see options: "No Tax (0%)", "PPN 11%", "PPN 12%".

2. **Given** I select "PPN 11%" for an item of 1,000,000,
   **When** I Post the Invoice,
   **Then** Tax Payable is 110,000.

3. **Given** I select "No Tax (0%)",
   **When** I Post the Invoice,
   **Then** Tax Payable is 0.

4. **Given** I select "No Tax (0%)",
   **When** I Post the Invoice,
   **Then** Tax Payable is 0.

---

### User Story 2 - Purchase Tax Selection (Input VAT) (Priority: P1)

As a Procurement Manager, I want to record VAT paid to suppliers (Input VAT) separately when creating Purchase Orders or Bills, so that I can claim tax credits and ensure my Cost of Goods Sold is accurate (excluding recoverable tax).

**Why this priority**:
Matches Sales Tax priority. Input VAT (Pajak Masukan) is an asset (receivable from state), not an expense. Recording it as cost overstates inventory value.

**Independent Test**:
Create a Bill with 11% Tax. Verify Journal Entry Debits `VAT Receivable` (or Input VAT account) instead of Inventory for the tax portion.

**Acceptance Scenarios**:

1. **Given** a Purchase Order with items 1,000,000 and Tax "PPN 11%",
   **When** I Post the Bill,
   **Then** Journal Entry:
   - Credit Accounts Payable (2100): 1,110,000
   - Debit GRN Suspense/Inventory (2105/1400): 1,000,000
   - Debit VAT Receivable (1500): 110,000.

2. **Given** a supplier verification without tax (0%),
   **When** I Post the Bill,
   **Then** No VAT entry is recorded; AP equals Inventory Cost.

As a Warehouse Manager, when I process a Sales Return, I want the system to automatically reverse the Cost of Goods Sold (COGS) and increase Inventory Asset value, so that my financial reports match the physical stock levels.

**Why this priority**:
High financial impact. Currently, returns increase physical stock but leaves the cost expensed (COGS), understating profit and inventory value.

**Independent Test**:
Can be tested by processing a return for a shipped order and verifying the Journal Entry reverses the original Shipment COGS entry.

**Acceptance Scenarios**:

1. **Given** a Sales Order for 10 units @ Cost 50,000 was shipped,
   **When** I process a "Return" for 2 units,
   **Then** a Journal Entry receives: Debit Inventory Asset (100,000), Credit COGS (100,000).

2. **Given** a return is processed,
   **When** I check the Product Stock,
   **Then** the quantity should increase by the returned amount.

---

### User Story 3 - Goods Receipt Accrual (GRNI) (Priority: P3)

As an Accountant, I want liability to be accrued as soon as goods are received (even before the Bill arrives), so that my liability reports are accurate month-to-month.

**Why this priority**:
Solves timing differences. Prevents "free stock" appearing in asset reports during the gap between Receipt and Bill.

**Independent Test**:
Can be tested by receiving a PO and verifying an Accrual Journal is created immediately, then Posting the Bill and verifying the Accrual is cleared.

**Acceptance Scenarios**:

1. **Given** a Purchase Order for 100 items @ 10,000,
   **When** the Goods Receipt is processed,
   **Then** a Journal Entry is created: Debit Inventory Asset (1,000,000), Credit GRN Suspense (1,000,000).

2. **Given** a Goods Receipt was accrued,
   **When** the Bill is Posted,
   **Then** the Journal Entry should be: Debit GRN Suspense (1,000,000), Credit Accounts Payable (1,000,000).

---

### Edge Cases

- **Tax Rate Change**: What happens when the Tax Rate changes between Order Confirmation and Invoice Posting? (System should likely lock rate at Invoice creation).
- **Over-Return**: What happens if a user tries to return more items than were originally shipped? (System MUST prevent this).
- **Partial Receipt/Bill**: How does Accrual handle partial receipts or partial billing? (Accrual should match the specific receipt quantity; Bill clears matched amount).
- **Rounding Differences**: How does the system handle small rounding differences between Calculated Tax and Official Tax Invoice? (Needs a customized rounding adjustment or tolerance).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow users to select a Tax Rate from a predefined list (0%, 11%, 12%) on Sales Orders/Invoices AND Purchase Orders/Bills.
- **FR-002**: System MUST calculate Subtotal and Tax Amount separately and persist them on the Invoice/Bill.
- **FR-003**: System MUST post Invoices with split Revenue and Tax Payable journal lines.
- **FR-004**: System MUST allow processing a "Return" action on a Confirmed/Completed Sales Order.
- **FR-005**: Processing a Return MUST automatically increase physical stock AND create a COGS Reversal Journal.
- **FR-006**: System MUST trigger an Accrual Journal (Liability) immediately upon processing a Goods Receipt.
- **FR-007**: Posting a Bill MUST offset the Accrual Liability account instead of debiting Inventory directly.
- **FR-008**: Posting a Bill with Tax MUST record the Tax Amount to a VAT Receivable (Asset) account, not Inventory Cost.

### Key Entities

- **Invoice**: Updated to include `subtotal`, `taxAmount`.
- **JournalEntry**: Usage expanded for tax splits and accruals.
- **InventoryMovement**: Tracks Returns (Type: IN).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of Invoices and Bills record Tax Liability/Receivable strictly according to the user-selected rate (0 variance).
- **SC-002**: Sales Returns automatically trigger both Stock Update and Journal Entry within 2 seconds of confirmation.
- **SC-003**: Goods Receipt Accrual Journal is created for 100% of received Purchase Orders.
- **SC-004**: Month-end reconciliation between Physical Value (Stock \* Cost) and General Ledger Inventory Asset Value matches exactly (0 variance) for tested items.

## Constitution Compliance _(mandatory for frontend features)_

### Frontend Architecture Checklist

- [ ] **Component Abstraction**: N/A (Backend Focus)
- [ ] **Hook Abstraction**: N/A
- [ ] **No Copy-Paste**: N/A
- [ ] **Global Error Handling**: Standard API error handling applies.
- [ ] **Success Toasts**: N/A
- [ ] **Confirmation Dialogs**: N/A
- [ ] **Systematic Updates**: N/A
