# Feature Specification: Document Linking & Overpayment Prevention (P2P + O2C)

**Feature Branch**: `041-p2p-document-linking`  
**Created**: 2025-12-30  
**Status**: Draft  
**Input**: User description: "Enable document linking for both P2P and O2C flows. PO/SO Detail shows Fulfillments and Invoices/Bills with proper linking. Prevent overpayment."

## Overview

This feature provides unified document linking for both procurement (P2P) and sales (O2C) flows:

| Flow | Order | Fulfillment | Invoice | Linking |
|------|-------|-------------|---------|--------|
| **P2P** | Purchase Order (PO) | GRN (RECEIPT) | Bill (BILL) | Regular Bill → GRN → PO |
| **O2C** | Sales Order (SO) | Shipment (SHIPMENT) | Invoice (INVOICE) | Invoice → Shipment → SO |

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View Related Documents in Order Detail (Priority: P1)

As a user, I want to see all Fulfillments and Invoices/Bills related to an Order (PO or SO) in a single view, so I can track the full document chain without navigating away.

**Why this priority**: Core visibility feature that enables all other workflows. Without this, users cannot understand document relationships.

**Integration Scenario**:
- **P2P**: PO creation → GRN creation → Bill creation, verifying all documents appear in PO detail.
- **O2C**: SO creation → Shipment creation → Invoice creation, verifying all documents appear in SO detail.

**Acceptance Scenarios (P2P)**:

1. **Given** a PO with 2 GRNs, **When** I view PO detail, **Then** I see a "Goods Receipts" section listing both GRNs with their numbers, dates, and amounts.
2. **Given** a PO with 1 DP Bill and 2 regular Bills, **When** I view PO detail, **Then** I see a "Bills" section showing all 3 bills with type indicators (DP/Regular).
3. **Given** a regular Bill linked to a GRN, **When** I view the Bills list in PO detail, **Then** the Bill shows which GRN it's linked to.

**Acceptance Scenarios (O2C)**:

4. **Given** an SO with 2 Shipments, **When** I view SO detail, **Then** I see a "Shipments" section listing both with numbers, dates, and amounts.
5. **Given** an SO with 1 DP Invoice and 2 regular Invoices, **When** I view SO detail, **Then** I see an "Invoices" section showing all 3 with type indicators.
6. **Given** a regular Invoice linked to a Shipment, **When** I view the Invoices list in SO detail, **Then** the Invoice shows which Shipment it's linked to.

---

### User Story 2 - Create Invoice/Bill from Fulfillment (Priority: P1)

As a user, I want to create an Invoice/Bill directly from a specific Fulfillment (GRN or Shipment), so the amount reflects only the items in that fulfillment.

**Why this priority**: Critical for accurate billing. Invoices/Bills must match what was fulfilled, not the full order amount.

**Integration Scenario**:
- **P2P**: Create GRN for 50 units → Create Bill from GRN → Verify Bill amount = GRN items value.
- **O2C**: Create Shipment for 30 units → Create Invoice from Shipment → Verify Invoice amount = Shipment items value.

**Acceptance Scenarios (P2P)**:

1. **Given** a GRN with 5 items worth Rp 50,000,000, **When** I create a Bill from this GRN, **Then** the Bill subtotal is Rp 50,000,000 (not the full PO amount).
2. **Given** I'm on GRN detail page, **When** I click "Create Bill", **Then** the Bill is automatically linked to this GRN and the parent PO.
3. **Given** a GRN already has a Bill, **When** I try to create another Bill from this GRN, **Then** I see a warning or the option is disabled.

**Acceptance Scenarios (O2C)**:

4. **Given** a Shipment with 3 items worth Rp 30,000,000, **When** I create an Invoice from this Shipment, **Then** the Invoice subtotal is Rp 30,000,000.
5. **Given** I'm on Shipment detail page, **When** I click "Create Invoice", **Then** the Invoice is automatically linked to this Shipment and the parent SO.
6. **Given** a Shipment already has an Invoice, **When** I try to create another Invoice from this Shipment, **Then** I see a warning or the option is disabled.

---

### User Story 3 - DP Bill Relationship Display (Priority: P2)

As a procurement officer, I want DP Bills to show they are linked to the PO only (not to any GRN), so I understand that DP bills are pre-receipt payments.

**Why this priority**: Clarity on different bill types helps avoid confusion about payment obligations.

**Integration Scenario**: Create PO with DP → Create and pay DP Bill → Verify DP Bill shows PO link but no GRN link.

**Acceptance Scenarios**:

1. **Given** a DP Bill, **When** I view it in PO detail Bills list, **Then** it shows "Down Payment" type and "-" or blank for GRN reference.
2. **Given** a regular Bill linked to GRN-001, **When** I view it in PO detail Bills list, **Then** it shows "Regular" type and "GRN-001" reference.

---

### User Story 4 - Fulfillment Shows Outstanding Amount (Priority: P2)

As a finance manager, I want each Fulfillment to display the outstanding amount, so I can track liabilities (P2P) and receivables (O2C).

**Why this priority**: Fulfillments create accounting entries. Users need to see this for cash flow planning.

**Integration Scenario**:
- **P2P**: Post GRN → Verify liability shows → Create Bill → Verify liability reduces.
- **O2C**: Post Shipment → Verify receivable shows → Create Invoice → Verify receivable reduces.

**Acceptance Scenarios (P2P - Liability)**:

1. **Given** a posted GRN worth Rp 100,000,000, **When** I view GRN detail, **Then** I see "Liability: Rp 100,000,000".
2. **Given** a GRN with a posted Bill, **When** I view GRN detail, **Then** the liability shows Rp 0 (cleared by Bill posting).

**Acceptance Scenarios (O2C - Receivable)**:

3. **Given** a posted Shipment worth Rp 80,000,000, **When** I view Shipment detail, **Then** I see "Unbilled: Rp 80,000,000".
4. **Given** a Shipment with a posted Invoice, **When** I view Shipment detail, **Then** the unbilled amount shows Rp 0.

---

### User Story 5 - Prevent Over-Invoicing/Over-Billing (Priority: P1)

As a system, I must prevent users from creating Invoices/Bills or payments that exceed the total Order value.

**Why this priority**: Financial control is critical. Over-invoicing/over-billing causes cash flow problems and reconciliation issues.

**Integration Scenario (P2P)**: Create PO for Rp 100M → Create DP Bill Rp 50M → Create GRN → Create Bill from GRN → Attempt to pay more than remaining balance → Fail.

**Integration Scenario (O2C)**: Create SO for Rp 100M → Create DP Invoice Rp 30M → Create Shipment → Create Invoice from Shipment → Attempt to invoice more than remaining → Fail.

**Acceptance Scenarios (P2P)**:

1. **Given** a PO worth Rp 100,000,000 with DP Rp 50,000,000 already paid, **When** I try to create a Bill for Rp 60,000,000, **Then** the system rejects with "Bill amount exceeds remaining PO value".
2. **Given** a Bill with balance Rp 30,000,000, **When** I try to record a payment of Rp 40,000,000, **Then** the system rejects with "Payment exceeds bill balance".
3. **Given** all GRNs for a PO are fully billed, **When** I try to create another Bill, **Then** the system prevents creation with "All received goods already billed".

**Acceptance Scenarios (O2C)**:

4. **Given** an SO worth Rp 100,000,000 with DP Rp 30,000,000 already invoiced, **When** I try to create an Invoice for Rp 80,000,000, **Then** the system rejects with "Invoice amount exceeds remaining SO value".
5. **Given** an Invoice with balance Rp 50,000,000, **When** I try to record a payment of Rp 60,000,000, **Then** the system rejects with "Payment exceeds invoice balance".
6. **Given** all Shipments for an SO are fully invoiced, **When** I try to create another Invoice, **Then** the system prevents creation.

---

### Edge Cases (Future Scope)

> These edge cases are documented for future consideration but are OUT OF SCOPE for this feature.

- What happens when a PO is cancelled but has partial GRNs? Bills can only be created for received goods.
- How does system handle returns after billing? Debit Notes should reduce the effective billed amount.
- What if a GRN is voided after a Bill was created from it? Bill should remain but be marked for review.

## Requirements _(mandatory)_

### Functional Requirements

#### Document Relationships (P2P)

- **FR-001**: System MUST display a "Goods Receipts" section in PO detail page showing all related GRNs.
- **FR-002**: System MUST display a "Bills" section in PO detail page showing all related Bills.
- **FR-003**: Each Bill in the list MUST show its type: "Down Payment" or "Regular".
- **FR-004**: Regular Bills MUST display which GRN they are linked to.
- **FR-005**: DP Bills MUST show "N/A" or "-" for GRN reference (no GRN link).

#### Document Relationships (O2C)

- **FR-001b**: System MUST display a "Shipments" section in SO detail page showing all related Shipments.
- **FR-002b**: System MUST display an "Invoices" section in SO detail page showing all related Invoices.
- **FR-003b**: Each Invoice in the list MUST show its type: "Down Payment" or "Regular".
- **FR-004b**: Regular Invoices MUST display which Shipment they are linked to.
- **FR-005b**: DP Invoices MUST show "N/A" or "-" for Shipment reference (no Shipment link).

#### Invoice/Bill Creation & Linking

- **FR-006**: System MUST allow creating a Bill from a specific GRN (GRN → Bill).
- **FR-006b**: System MUST allow creating an Invoice from a specific Shipment (Shipment → Invoice).
- **FR-007**: When creating Bill/Invoice from Fulfillment, subtotal MUST equal the Fulfillment items value.
- **FR-008**: Regular Bills MUST be linked to exactly one GRN (fulfillmentId required).
- **FR-008b**: Regular Invoices MUST be linked to exactly one Shipment (fulfillmentId required).
- **FR-009**: DP Bills/Invoices MUST be linked to the Order only (no fulfillmentId).
- **FR-010**: All Bills MUST be linked to a PO; All Invoices MUST be linked to an SO.

#### Outstanding Amount Tracking

- **FR-011**: Each GRN MUST display its liability amount (value of received goods not yet billed).
- **FR-011b**: Each Shipment MUST display its unbilled amount (value of shipped goods not yet invoiced).
- **FR-012**: Liability/Unbilled = Fulfillment total value - linked Invoice(s) total value.
- **FR-013**: Posted Fulfillment with no Invoice shows full amount; posted Invoice reduces to zero.

#### Over-Invoicing/Over-Billing Prevention

- **FR-014**: System MUST prevent Bill creation if total billed would exceed PO total value minus DP.
- **FR-014b**: System MUST prevent Invoice creation if total invoiced would exceed SO total value minus DP.
- **FR-015**: System MUST prevent payment recording if payment amount exceeds Invoice/Bill balance.
- **FR-016**: System MUST track total invoiced/billed amount per Order across all Invoices/Bills.
- **FR-017**: System MUST prevent creating Invoice/Bill for Fulfillments that are already fully invoiced/billed.

### Key Entities

- **Order**: Parent document (PO for P2P, SO for O2C). Contains items, DP amount, total value. Has many Fulfillments and Invoices.
- **Fulfillment**: GRN (type=RECEIPT) for P2P, Shipment (type=SHIPMENT) for O2C. Links to Order. Has outstanding amount.
- **Invoice**: Bill (type=BILL) for P2P, Invoice (type=INVOICE) for O2C. Links to Order. Regular ones also link to Fulfillment via `fulfillmentId`.
- **Payment**: Records money paid against an Invoice/Bill. Amount cannot exceed balance.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can view all Fulfillments and Invoices for an Order in under 3 seconds.
- **SC-002**: 100% of regular Invoices/Bills created via Fulfillment have correct subtotal.
- **SC-003**: 0% of Invoices/Bills can be created that would cause over-billing beyond Order total.
- **SC-004**: 0% of Payments can be recorded that exceed Invoice/Bill balance.
- **SC-005**: Users can distinguish DP from Regular Invoices/Bills at a glance.
- **SC-006**: Outstanding amount is visible for 100% of posted Fulfillments.

## Constitution & Architecture Compliance _(mandatory)_

### Backend Architecture (Apps/API) - Principles I, II, III, XXI

- [ ] **Layered Architecture**: Logic follows Route → Service → Policy → Repository (Controller merged into Route via tRPC).
- [ ] **Schema-First**: All new fields defined in `packages/shared` Zod schemas first.
- [ ] **Multi-Tenant**: All DB queries scoped by `companyId`.
- [ ] **Service Purity**: Service layer DOES NOT import `prisma` (uses Repository only).
- [ ] **Policy & Rules**: Business constraints in Policy, pure logic in `rules/`.
- [ ] **Repository Purity**: No business logic in Repository (Data access only).
- [ ] **Anti-Bloat**: No redundant business logic methods added; existing ones updated (XXI).

### Frontend Architecture (Apps/Web) - Principles IV, XI

- [ ] **Feature Isolation**: Logic in `src/features/[domain]` (not global).
- [ ] **No Business Logic**: Components do not calculate state (render `backendState` only).
- [ ] **API Patterns**: Using `apiAction()` helper (never direct toast/try-catch).
- [ ] **User Safety**: Using `useConfirm()` hook (never `window.confirm`).
- [ ] **State Projection**: UI reflects exact backend state without optimistic guessing (unless specific policy).

### Testing & Quality - Principles XV, XVII

- [ ] **Integration Tests**: Full business flow covered in single `it()` block.
- [ ] **Mock Compliance**: Mocks satisfy all Policy/Service contract expectations.
- [ ] **Financial Precision**: All assertions use `Number()` or `Decimal` aware checks.
- [ ] **Zero-Lag**: No interaction freezes the main thread.

## Assumptions

- Fulfillment value is calculated from Order item prices × fulfilled quantities.
- DP amount is already tracked on Order (`dpAmount` field).
- Existing `isDownPayment` flag on Invoice model correctly identifies DP Invoices/Bills.
- Invoice-to-Fulfillment relationship is stored via `fulfillmentId` field on Invoice model (unified for both P2P and O2C).
