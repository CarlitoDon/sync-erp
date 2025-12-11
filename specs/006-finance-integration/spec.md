# Feature Specification: Integrasi Finance Accounting

**Feature Branch**: `006-finance-integration`  
**Created**: 2025-12-11  
**Status**: Draft  
**Input**: User description: "oke kita kerjakan di spek baru yaitu integrasi finance accounting"

## Clarifications

### Session 2025-12-11

- Q: COGS scope → A: Include Sales Returns.
- Q: Missing Account Codes → A: Block & Error (Prevent transaction).
- Q: Zero Cost Item → A: Allow Zero Journal (Maintain audit trail).
- Q: Negative Stock → A: Strict Stock (Block transaction if insufficient stock).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Sales Shipment COGS Automation (Priority: P1)

As a Business Owner, I want the Cost of Goods Sold (COGS) to be automatically recorded when goods are shipped, so that my Profit & Loss statement accurately reflects the cost of sales in the same period as the revenue (or close to it), and my Inventory Asset value decreases.

**Why this priority**: Critical for accurate financial reporting. Currently, inventory quantity decreases, but the financial value of inventory remains high until manual adjustment, leading to inflated profit reports.

**Independent Test**: Identify a product with known Average Cost. Create a Sales Order and fulfill it (Shipment). Verify that a Journal Entry is created with Dr COGS and Cr Inventory for (Quantity \* Average Cost).

**Acceptance Scenarios**:

1.  **Given** a product with Quantity 10 and Average Cost 100,000, **When** I confirm a shipment of 1 unit, **Then** a Journal Entry is created: Dr COGS (5000) 100,000 / Cr Inventory (1400) 100,000.
2.  **Given** a shipment is cancelled/returned (Sales Return), **When** processed, **Then** a reversing Journal Entry is created: Dr Inventory (1400), Cr COGS (5000).

---

### User Story 2 - Inventory Adjustment Financials (Priority: P2)

As a Warehouse Manager, when I manually adjust stock (due to damage, loss, or found items), I want the financial value to be updated automatically, so that the Balance Sheet matches physical stock reality.

**Why this priority**: Ensures inventory discrepancies don't cause permanent mismatch between Ledger and Stock Reports.

**Independent Test**: Perform a Stock Adjustment (In or Out). Verify Journal Entry: Dr/Cr Inventory Adjustment (Expense) and Cr/Dr Inventory (Asset).

**Acceptance Scenarios**:

1.  **Given** a stock loss of 1 unit @ 50,000, **When** I create a negative stock adjustment, **Then** Journal Entry: Dr Inventory Shrinkage/Adjustment (Expense) 50,000 / Cr Inventory (Asset) 50,000.
2.  **Given** a stock found (positive adjustment) @ 50,000, **When** I create positive adjustment, **Then** Journal Entry: Dr Inventory (Asset) 50,000 / Cr Inventory Adjustment (Revenue/Expense Contra) 50,000.

---

### User Story 3 - Full Cycle Verification (Priority: P3)

As a Finance Manager, I want to ensure that the entire P2P (Procure to Pay) and O2C (Order to Cash) cycles generate consistent and balanced journals, so that I can trust the system generated reports without manual reconciliation.

**Why this priority**: Validation of existing Invoice/Bill integration to ensure no regressions and consistency with new COGS logic.

**Independent Test**: Run a full cycle: PO -> Bill -> Payment and SO -> Shipment -> Invoice -> Payment. Check all Ledger impacts.

**Acceptance Scenarios**:

1.  **Given** valid PO and Bill, **When** Bill is posted, **Then** Inventory Asset increases and AP increases.
2.  **Given** valid SO and Invoice, **When** Invoice is posted, **Then** AR increases and Sales Revenue increases.
3.  **Given** Payments, **When** recorded, **Then** Cash changes and AR/AP decreases.

## Edge Cases

- **Zero Cost Item**: If a shipment involves an item with 0 Average Cost, the system MUST still create a Journal Entry with 0 amount to preserve the audit trail.
- **Negative Stock**: The system MUST Block any shipment that would result in negative stock. Insufficient stock error must be returned.
- **Missing Account Codes**: What if the system accounts (1400, 5000, etc.) are missing in the database? (Block transaction).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST automatically create a Journal Entry upon confirming an Outbound Inventory Movement (Shipment) for Sales.
  - Debit: Cost of Goods Sold (Account Code e.g., 5000)
  - Credit: Inventory Asset (Account Code e.g., 1400)
  - Amount: Quantity \* Product Average Cost at time of shipment.
- **FR-002**: System MUST automatically create a Journal Entry upon confirming a Stock Adjustment.
  - For Loss (Negative): Dr Inventory Adjustment (5200), Cr Inventory Asset (1400).
  - For Gain (Positive): Dr Inventory Asset (1400), Cr Inventory Adjustment (5200).
- **FR-003**: System MUST validation that "System Accounts" exist before processing these transactions. If missing, the transaction MUST be blocked and return an error.
- **FR-004**: System MUST ensure `BillService` and `InvoiceService` integrations remain intact and correct (Dr Inventory/Cr AP for Bill; Dr AR/Cr Revenue for Invoice).
- **FR-005**: All auto-generated journals MUST have clear references linking back to the source Document (Shipment ID, Adjustment ID).
- **FR-006**: System MUST automatically create a reversing Journal Entry upon processing a Sales Return (Inbound Shipment from Customer).
  - Debit: Inventory Asset (1400)
  - Credit: Cost of Goods Sold (5000)
  - Amount: Quantity \* Product Average Cost.
- **FR-007**: System MUST Enforce Strict Stock control. Any transaction resulting in negative stock MUST be rejected.

### Key Entities

- **InventoryMovement**: Triggers the COGS/Adjustment journal. Needs to know Cost at movement time.
- **JournalEntry**: The resulting financial record.
- **Product**: Source of Average Cost.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: **100% of Sales Shipments** generate a corresponding COGS Journal Entry immediately.
- **SC-002**: **100% of Stock Adjustments** generate a corresponding Financial Journal Entry immediately.
- **SC-003**: Accounting Equation (Assets = Liabilities + Equity) remains balanced after every automated transaction.
- **SC-004**: Profit & Loss report includes COGS from shipments, providing accurate Gross Profit.

## Constitution Compliance _(mandatory for frontend features)_

### Frontend Architecture Checklist

- [ ] **N/A**: This feature is primarily Backend (Journal Automation). Frontend changes likely limited to UI reporting/viewing journals if needed, or just verifying standard tables.
