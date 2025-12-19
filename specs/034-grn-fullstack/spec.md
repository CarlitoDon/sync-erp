# Feature Specification: Fullstack GRN & Shipment (P2P & O2C Symmetry)

**Feature Branch**: `034-grn-fullstack`  
**Created**: 2025-12-18  
**Status**: Draft  
**Input**: Integrated GRN (Goods Receipt Note) and Shipment (Delivery Note/Goods Issue) as symmetric physical inventory events.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - P2P Flow: Goods Receipt Note (GRN) (Priority: P1)

As a warehouse clerk, I want to record a Goods Receipt from a confirmed Purchase Order so that physical inventory is increased (Stock IN) _before_ the bill is processed.

**Integration Scenario**: PO (Confirmed) -> Create GRN -> Stock IN -> GRN Posted -> PO Status Update.

**Acceptance Scenarios**:

1. **Given** a confirmed PO, **When** creating a GRN for 10 units, **Then** stock levels increase by 10.
2. **Given** a posted GRN, **When** creating a Bill, **Then** the Bill references the GRN (3-way match).
3. **Given** a GRN is posted, **Then** the inventory Average Cost is updated based on the PO price.

### User Story 2 - O2C Flow: Shipment / Goods Issue (Priority: P1)

As a warehouse clerk, I want to create a Shipment (Delivery Note) from a confirmed Sales Order so that physical inventory is deducted (Stock OUT) _before_ the invoice is finalized.

**Integration Scenario**: SO (Confirmed) -> Create Shipment -> Stock OUT -> Shipment Posted -> SO Status Update.

**Acceptance Scenarios**:

1. **Given** a confirmed SO, **When** creating a Shipment for 5 units, **Then** stock levels decrease by 5.
2. **Given** a posted Shipment, **When** creating an Invoice, **Then** the Invoice references the Shipment (Proof of Delivery).
3. **Given** a Shipment is posted, **Then** a "Cost Snapshot" is recorded for COGS calculation.

### User Story 3 - Document Lists & Details (Priority: P2)

As a manager, I want dedicated views for "Receipts" (Inbound) and "Shipments" (Outbound) to audit physical movement.

**Integration Scenario**: Navigate to `/inventory/receipts` and `/inventory/shipments`.

**Acceptance Scenarios**:

1. **Given** the Inventory module, **When** I view "Receipts", **Then** I see all GRNs with PO references.
2. **Given** the Inventory module, **When** I view "Shipments", **Then** I see all Delivery Notes with SO references.

---

### Edge Cases

- **Partial Delivery/Receipt**:
  - **P2P**: Receiving 5/10 items -> PO remains `PARTIALLY_RECEIVED`.
  - **O2C**: Shipping 5/10 items -> SO status `PARTIALLY_SHIPPED`.
  - **Constraint**: Invoice/Bill should only correspond to the _actually_ shipped/received quantity (or link to specific shipments).
- **Over-Delivery/Receipt**: Block or warn if Qty > Order Qty.
- **Stock Floor**: Shipment cannot be posted if insufficient stock (unless negative stock allowed by policy).
- **Service Items**: Services do not require GRN/Shipment (Policy Exception).

## Requirements _(mandatory)_

### Functional Requirements

#### P2P (Goods Receipt)

- **FR-001**: System MUST allow creating a `GoodsReceipt` from a `CONFIRMED` PurchaseOrder.
- **FR-002**: Posting a `GoodsReceipt` MUST execute a Stock Journal (Stock IN) and update Item Average Cost.
- **FR-003**: A Purchase Bill SHOULD require a posted `GoodsReceipt` (Policy: 3-way match).

#### O2C (Shipment / Delivery Note)

- **FR-004**: System MUST allow creating a `Shipment` from a `CONFIRMED` SalesOrder.
- **FR-005**: Posting a `Shipment` MUST execute a Stock Journal (Stock OUT) capturing the Cost Snapshot at that moment.
- **FR-006**: A Sales Invoice SHOULD require a posted `Shipment` (Policy: Proof of Delivery).

#### General

- **FR-007**: Frontend MUST provide symmetrical List/Detail pages for `Receipts` and `Shipments`.
- **FR-008**: Inventory transactions MUST occur on GRN/Shipment, NOT on Bill/Invoice.

### Key Entities

- **GoodsReceipt (GRN)**: `id`, `poId`, `date`, `status`, `items: [{ productId, qtyReceived }]`
- **Shipment (DN)**: `id`, `soId`, `date`, `status`, `items: [{ productId, qtyShipped, costSnapshot }]`
- **StockJournal**: The unified ledger for Stock IN/OUT.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Inventory stock changes coincide exactly with GRN/Shipment posting timestamps.
- **SC-002**: COGS accuracy increases (Cost captured at Shipment time, not Invoice time).
- **SC-003**: 100% of physical goods invoices can be traced to a Shipment/GRN.

## Constitution Compliance _(mandatory for frontend features)_

### Technical Architecture Checklist (Part A)

- [ ] **Symmetry**: `features/inventory/receipts` mirrors `features/inventory/shipments`.
- [ ] **Component Reuse**: Shared table logic for document lists.
- [ ] **API Consistency**: `POST /api/inventory/receipts` and `POST /api/inventory/shipments` follow same patterns.

### Human Experience Checklist (Part B - Principles XIV-XVII)

- [ ] **Terminology**: Clear distinction between "Order" (Intent), "Shipment" (Physical), and "Invoice" (Financial).
- [ ] **Flow Guidance**: UI prompts "Create Shipment" when SO is confirmed.
