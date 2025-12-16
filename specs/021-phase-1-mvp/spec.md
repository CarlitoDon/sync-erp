# Feature Specification: Phase 1 - MVP Core Flows

**Feature Branch**: `021-phase-1-mvp`
**Created**: 2025-12-16
**Status**: Draft
**Input**: Apple-Like Roadmap Phase 1 (`docs/apple-like-development/ROADMAP.md`)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Inventory Movements (Priority: P1)

As a **warehouse operator**, I want stock levels to update automatically when successful Purchase Receipts or Sales Invoices occur so that physical inventory matches system data without manual intervention.

**Why this priority**: Core of ERP. "Barang masuk -> Barang keluar". Without this, the system is just a database of documents.

**Independent Test**: Create a Product with 0 stock. Receive 10 units via Goods Receipt. Stock becomes 10. Sell 3 units via Invoice. Stock becomes 7.

**Acceptance Scenarios**:

1. **Given** a confirmed Purchase Order, **When** Goods Receipt is processed, **Then** Product stock increases and Average Cost recalculates.
2. **Given** a confirmed Sales Order, **When** Invoice is posted, **Then** Product stock decreases.
3. **Given** a manual adjustment request, **When** submitted, **Then** stock updates and a corresponding Journal Entry is created.

---

### User Story 2 - Sales Cycle (Priority: P1)

As a **sales representative**, I want to convert a Sales Order into an Invoice and record Payment so that the revenue cycle is closed and cash is tracked.

**Why this priority**: "Uang tercatat". Revenue generation flow.

**Independent Test**: Create SO -> Convert to Invoice -> Register Payment. Verify "Status" flows from DRAFT -> CONFIRMED -> COMPLETED/PAID.

**Acceptance Scenarios**:

1. **Given** a draft Sales Order, **When** confirmed, **Then** status becomes CONFIRMED (no stock change yet per MVP rules).
2. **Given** a confirmed Sales Order, **When** Invoiced, **Then** Invoice is created and Stock is reduced (per MVP rule: Invoice drives stock out).
3. **Given** an open Invoice, **When** Payment is fully recorded, **Then** Invoice status becomes PAID.

---

### User Story 3 - Procurement Cycle (Priority: P1)

As a **purchasing officer**, I want to process Purchase Orders and verify Supplier Invoices so that we pay for what we actually received.

**Why this priority**: Supply chain foundation.

**Independent Test**: Create PO -> Receive Goods -> Create Bill. Verify stock increase and Accounts Payable increase.

**Acceptance Scenarios**:

1. **Given** a draft Purchase Order, **When** confirmed, **Then** status becomes CONFIRMED.
2. **Given** a confirmed PO, **When** Goods are received, **Then** inventory increases.
3. **Given** a confirmed PO, **When** Supplier Invoice (Bill) is recorded, **Then** Accounts Payable increases.

---

### User Story 4 - Auto-Accounting (Priority: P1)

As an **accountant**, I want Journal Entries to be generated automatically in the background so that I don't have to manually book Sales, COGS, or Inventory movements.

**Why this priority**: "Automagical" experience. Financial integrity without manual toil.

**Independent Test**: Perform a Sales Invoice. Check General Ledger. Should see Debit AR, Credit Revenue, Debit COGS, Credit Inventory.

**Acceptance Scenarios**:

1. **Given** a Goods Receipt, **When** saved, **Then** Journal created (Dr Inventory, Cr GRNI/AP).
2. **Given** a Sales Invoice, **When** posted, **Then** Journal created (Dr AR, Cr Revenue) AND (Dr COGS, Cr Inventory).
3. **Given** a Payment, **When** recorded, **Then** Journal created (Dr Cash, Cr AR).

---

### User Story 5 - Master Data Foundation (Priority: P2)

As a **system admin**, I want strict validation on Products and Warehouses so that transaction data integrity is maintained.

**Why this priority**: Prerequisite for transactions.

**Independent Test**: Try to create a Product without costing method (should default to AVG). Try to transact without a warehouse (should default to Primary).

**Acceptance Scenarios**:

1. **Given** new Product creation, **When** costing method empty, **Then** defaults to AVG (Phase 1 constraint).
2. **Given** existing system, **When** Multi-warehouse features accessed, **Then** blocked/hidden (Phase 1 constraint).

---

## Requirements _(mandatory)_

### Functional Requirements

**Inventory**

- **FR-001**: System MUST support Goods Receipt (Stock IN) linked to Purchase Order.
- **FR-002**: System MUST support Shipment/Invoice (Stock OUT) linked to Sales Order.
- **FR-003**: System MUST recalculate Moving Average Cost on every Stock IN event.
- **FR-004**: System MUST allow manual Stock Adjustment (Quantity + Value correction).
- **FR-005**: System MUST NOT allow negative stock for RETAIL/MANUFACTURING shapes (enforced by Policy).

**Sales**

- **FR-006**: System MUST support Sales Order lifecycle: DRAFT -> CONFIRMED -> CANCELLED / COMPLETED.
- **FR-007**: Sales Order confirmation MUST NOT reserve stock (Deferred to v1).
- **FR-008**: Invoice posting MUST reduce physical stock quantity.

**Procurement**

- **FR-009**: System MUST support Purchase Order lifecycle: DRAFT -> CONFIRMED -> CANCELLED / COMPLETED.
- **FR-010**: Goods Receipt MUST increase physical stock quantity.

**Accounting**

- **FR-011**: System MUST generate specific Journal Entries for: Invoice (Revenue+COGS), Bill (Expense/Asset), Payment (Asset/Liability), Stock Adjustment (Asset/Expense).
- **FR-012**: System MUST use "AVG" cost for all COGS calculations (FIFO deferred).
- **FR-013**: System MUST NOT calculate HPP (COGS) in the Frontend or Controller layer.

**General**

- **FR-014**: All transactions MUST validate against `Company.businessShape` policy.

### Key Entities

- **InventoryMovement**: Tracks type (IN/OUT), qty, product, warehouse, reference.
- **Order**: Header for Sales/Purchase. Status management.
- **Invoice**: Financial document. Requests payment (AR) or records obligation (AP).
- **Payment**: Cash settlement.
- **Journal**: Double-entry ledger record.
- **Product**: Master data with `averageCost` and `stockQty`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can complete a full "Quote to Cash" flow (SO -> Inv -> Pay) without error.
- **SC-002**: Stock `On Hand` matches physical movement calculations exactly (100% accuracy).
- **SC-003**: General Ledger balances (Debits = Credits) for every auto-generated transaction.
- **SC-004**: HPP (Cost of Goods Sold) is calculated automatically on Invoice posting with 0 manual input.
- **SC-005**: `npx tsc` passes with no errors.
- **SC-006**: Zero business logic in Controllers (logic in Service/Rules).

## Constitution Compliance _(mandatory for frontend features)_

### Technical Architecture Checklist (Part A)

- [ ] **Feature Isolation**: N/A (Backend focus, but Frontend screens must follow if touched).
- [ ] **Global Error Handling**: Backend throws `DomainError`, Front end displays toast.
- [ ] **Success Toasts**: `apiAction()` used for all mutations.

### Human Experience Checklist (Part B - Principles XIV-XVII)

- [ ] **Simplicity & Clarity**: Inventory UI only shows `On Hand` (hide complex ledger from simple users).
- [ ] **Zero-Lag**: Auto-posting happens asynchronously or within < 500ms transaction.
