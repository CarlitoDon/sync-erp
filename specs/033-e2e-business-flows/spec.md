# Feature Specification: Correct E2E Business Flows (O2C & P2P)

**Feature Branch**: `033-e2e-business-flows`  
**Created**: 2025-12-18  
**Status**: Draft  
**Input**: User description: "Kita susun urutan E2E yang benar, tanpa UI, dari sudut pandang domain dan ledger... [O2C and P2P flows with invariants]"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Standard O2C (Order to Cash) Flow (Priority: P1)

As a business, I want to process a customer order through shipment, invoicing, and payment while ensuring ledger and inventory integrity.

**Why this priority**: Core revenue-generating flow of the ERP. Must be correct for financial stability.

**Integration Scenario**: Full flow from SalesOrder confirmation to Stock OUT movement, Invoice Posting (Journal creation), and Payment Receipt application (Journal creation).

**Acceptance Scenarios**:

1. **Given** a confirmed SalesOrder, **When** fulfilled, **Then** a Stock OUT movement is created and StockQty decreases correctly.
2. **Given** a fulfilled order, **When** an Invoice is created and POSTED, **Then** Journal entries (AR, Revenue, VAT) are created and the Invoice becomes immutable.
3. **Given** a POSTED Invoice, **When** a Payment is received, **Then** the Invoice balance decreases and a Payment Journal is created.

---

### User Story 2 - Standard P2P (Procure to Pay) Flow (Priority: P1)

As a business, I want to process a supplier purchase from order to goods receipt, billing, and payment while ensuring ledger and inventory integrity.

**Why this priority**: Core expense and inventory acquisition flow. Critical for supply chain and cash flow management.

**Integration Scenario**: Full flow from PurchaseOrder confirmation to Goods Receipt (Stock IN), Bill Posting (Journal creation), and Payment to Supplier (Journal creation).

**Acceptance Scenarios**:

1. **Given** a confirmed PurchaseOrder, **When** goods are received, **Then** a Stock IN movement is created and StockQty increases correctly.
2. **Given** a received order, **When** a Bill is created and POSTED, **Then** Journal entries (Inventory/Expense, AP, VAT) are created and the Bill becomes immutable.
3. **Given** a POSTED Bill, **When** a Payment is applied, **Then** the Bill balance decreases and a Payment Journal is created.

---

### Edge Cases

- **Stock Depletion**: System handles scenarios where Fulfillment is attempted but StockQty < 0 after movement (InventoryPolicy prevents movement).
- **Out-of-Order Posting**: System prevents Payment Receipt/Application before the associated Invoice/Bill is POSTED.
- **Partial Payments**: Invoice/Bill balance must decrement correctly by the payment amount, and state only transitions to PAID when balance reaches zero.
- **Saga Mid-Flight Failure**: System MUST handle failures at any step of the Posting/Payment Saga, ensuring either full completion or full compensation.

---

### User Story 3 - Full Rental Asset Lifecycle (Priority: P2)

As a business owner, I want to manage the complete lifecycle of a rental asset: acquiring stock, converting it to rental units, renting it out, processing returns, and retiring/selling suboptimal units.

**Why this priority**: Validates the interaction between Inventory, Rental, and Sales modules, ensuring assets are tracked correctly across their lifespan.

**Integration Scenario**:

1. **Acquisition (P2P)**: Buy Mattresses (Product). Stock IN.
2. **Asset Activation**: Convert Inventory Stock to Rental Units. Stock OUT, Rental Unit CREATED.
3. **Rental Cycle**: Rent out units -> Return units with condition check.
4. **Disposal (O2C)**: Retire "Suboptimal" units -> Convert back to Inventory (Used Product) -> Sell.

**Acceptance Scenarios**:

1. **Given** purchased inventory, **When** mapped to rental units, **Then** Inventory decreases and Rental Units increase.
2. **Given** an active rental, **When** returned with "Needs Repair" condition, **Then** unit status reflects condition.
3. **Given** a retired rental unit, **When** sold as used stock, **Then** unit is archived and Sales Revenue is recorded.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST enforce state transitions: `DRAFT → CONFIRMED → COMPLETED` (Sales) and `DRAFT → CONFIRMED → RECEIVED` (Procurement).
- **FR-002**: System MUST move inventory ONLY during fulfillment (OUT) or receipt (IN).
- **FR-003**: System MUST NOT create Journal entries before an Invoice or Bill is POSTED.
- **FR-004**: System MUST lock Invoice/Bill entities (Immutability) immediately upon POSTING.
- **FR-005**: System MUST require an explicit `businessDate` for all financial and inventory transactions.
- **FR-006**: System MUST use Sagas to orchestrate all cross-module side effects (Journal creation, Inventory updates).
- **FR-007**: System MUST define **Compensating Actions** for every Saga step (e.g., if Stock OUT fails, no Journal entry is created; if Journal fails, Stock OUT is reversed).
- **FR-008**: System MUST implement **Idempotency** for all state-changing commands, scoped to `(companyId, entityId, action)`.
- **FR-010**: System MUST record the outcome of every Saga step as a **Saga Log** (Technical Execution Trace), containing `sagaType`, `stepName`, `status` (`PENDING`, `STARTED`, `COMPLETED`, `FAILED`, `COMPENSATING`, `COMPENSATED`), `stepData`, and `error`.
- **FR-010.1**: System MUST emit an **Audit Log** (Business Accountability) for every POSTING or PAYMENT action, containing `actorId`, `action`, `businessDate`, `entityId`, and `correlationId`. Audit logs MUST NOT depend on saga completion.
- **FR-010.2**: Saga logs MUST NOT be treated as business records; they are control-plane data for technical recovery.
- **FR-011**: System MUST ensure Journal entries are always balanced (Debit == Credit).
- **FR-012**: System MUST prevent Invoice/Bill balance from becoming negative (enforced via `InvoicePolicy`/`BillPolicy` and Database constraints).

### Key Entities

- **SalesOrder**: Represents customer demand. Transitions through draft, confirmed, and completed states.
- **PurchaseOrder**: Represents supplier demand. Transitions through draft, confirmed, and received states.
- **StockMovement**: Append-only record of inventory changes (IN/OUT).
- **Invoice**: Financial document for sales. Generates AR journals upon posting.
- **Bill**: Financial document for procurement. Generates AP journals upon posting.
- **Payment**: Represents cash flow. Linked to Invoices (Receipts) or Bills (Disbursements).
- **Journal**: Double-entry ledger record.
- **SagaLog**: Technical execution trace for recovery. Step-based and retry-safe.
- **AuditLog**: Immutable business record for compliance. Append-only and human-readable.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: E2E flows can be verified entirely via automated integration tests without UI dependencies.
- **SC-002**: 100% of financial transactions (Post/Payment) result in balanced Journal entries.
- **SC-003**: 100% of inventory movements are linked to a source document (SO/PO) and a valid `businessDate`.
- **SC-004**: Zero Journal entries exist for documents while they are in DRAFT state.
- **SC-005**: Database invariants (StockQty >= 0, Invoice.balance >= 0) are enforceable at the system level and verifiable via SQL.
- **SC-006**: 100% of state-changing commands include a `correlationId` traceable in Audit Logs and SagaLogs.
- **SC-006**: 100% of state-changing commands include a `correlationId` traceable in Audit Logs and SagaLogs.
- **SC-007**: Retrying an identical command (same `correlationId`) results in zero additional side effects (Idempotency).
- **SC-008**: Rental Units track distinct lifecycle states (Available -> Rented -> Returned -> Retired).

## Constitution Compliance _(mandatory for frontend features)_

_N/A - This feature focuses on backend domain and ledger logic (headless E2E)._
