# Feature Specification: Sync ERP MVP

**Feature Branch**: `001-sync-erp-mvp`  
**Created**: 2025-12-08  
**Status**: Draft  
**Input**: User description: "Sync ERP adalah erp monorepo multiple company, mvp nya adalah module sales, finance dan accounting, purchasing, inventory, warehousing."

## User Scenarios & Testing _(mandatory)_

<!--
  Prioritized user journeys for the MVP.
-->

### User Story 1 - Multi-Company Setup (Priority: P1)

As a System Administrator, I want to create and configure separate Company entities (tenants) so that multiple organizations can use the system with isolated data.

**Why this priority**: Foundational requirement ("multiple company") stated in the brief. All other modules depend on existence of a company context.

**Independent Test**: Can create a new Company, switch context to that Company, and verify no data leaks from other companies.

**Acceptance Scenarios**:

1. **Given** an administrator account, **When** I create a new Company with name "Acme Corp", **Then** the company is created and I can select it as my active context.
2. **Given** two existing companies "Acme" and "Beta", **When** I create a Customer in "Acme", **Then** that customer is NOT visible when logged into "Beta".

---

### User Story 2 - Procure to Pay (Purchasing -> Warehouse -> Finance) (Priority: P1)

As a Purchasing/Warehouse/Finance staff, I want to purchase items, receive them into stock, and pay the supplier, so that I can maintain inventory and pay my debts.

**Why this priority**: Essential functionality to bring stock into the system (Purchasing + Warehousing) and manage cash outflow (Finance).

**Independent Test**: Complete a full cycle: Create PO -> Receive Goods (verify stock increase) -> Create Vendor Bill -> Pay Bill (verify cash decrease).

**Acceptance Scenarios**:

1. **Given** a supplier and product, **When** I create and approve a Purchase Order (PO), **Then** the PO status updates to "Approved".
2. **Given** an approved PO, **When** warehouse staff creates a "Goods Receipt", **Then** the Product inventory quantity increases by the received amount.
3. **Given** a received PO, **When** finance staff creates a "Vendor Bill", **Then** an Account Payable entry is created in the General Ledger.

---

### User Story 3 - Order to Cash (Sales -> Warehouse -> Finance) (Priority: P1)

As a Sales/Warehouse/Finance staff, I want to sell items, ship them to customers, and collect payment, so that I can generate revenue and reduce inventory.

**Why this priority**: Core revenue generation flow (Sales + Warehousing + Finance).

**Independent Test**: Complete a full cycle: Create SO -> Ship Goods (verify stock decrease) -> Create Customer Invoice -> Receive Payment (verify cash increase).

**Acceptance Scenarios**:

1. **Given** a customer and product with stock, **When** I create and confirm a Sales Order (SO), **Then** inventory is reserved or soft-allocated.
2. **Given** a confirmed SO, **When** warehouse staff creates a "Delivery Note/Shipment", **Then** the Product inventory quantity decreases.
3. **Given** a shipped SO, **When** finance staff creates an "Invoice", **Then** an Account Receivable entry is created and sent to the customer.

---

### User Story 4 - Financial Reporting (Accounting) (Priority: P1)

As an Accountant, I want to view the General Ledger and Trial Balance, so that I can ensure all transactions are properly recorded and balanced.

**Why this priority**: Validates the "Finance and Accounting" requirement by ensuring transactional data properly impacts the books.

**Independent Test**: Perform a transaction (e.g., Invoice) and verify the GL entries and Trial Balance update correctly.

**Acceptance Scenarios**:

1. **Given** verified sales and purchase transactions, **When** I generate a Trial Balance report, **Then** the total Debits must equal total Credits.
2. **Given** a specific Invoice, **When** I view the General Ledger, **Then** I can see the specific Journal Entry linking Revenue and Accounts Receivable.

---

### Edge Cases

-   What happens when stock is insufficient for a Sales Order? (System should prevent confirmation or warn users).
-   What happens if a User belongs to multiple Companies? (System should enforce strict session switching or clear visual indicators of active context).
-   How does the system handle voiding/cancelling a processed Invoice? (Must generate reversing Journal Entries, not just delete data).

## Requirements _(mandatory)_

### Functional Requirements

#### Core / Multi-Company

-   **FR-CORE-001**: System MUST support creation of multiple isolated Company entities. Users MUST be able to belong to multiple companies (Many-to-Many) and switch context between them.
-   **FR-CORE-002**: Data (Products, Customers, Orders, etc.) MUST be scoped to a specific Company ID. Cross-company data access MUST be strictly prevented at the database query level.
-   **FR-CORE-003**: System MUST support **Format-driven Document Numbering** (e.g., `INV/2024/0001`) scoped by Company and Module. Sequences must reset per year/config.
-   **FR-CORE-004**: System MUST support **Granular Permissions (RBAC)**. Roles must be customizable with specific permissions (e.g., `sales.create`, `sales.view`) per module.

## Clarifications

### Session 2025-12-08

-   Q: How should Users relate to Companies? -> A: Many-to-Many. One User can access multiple Companies; One Company has multiple Users. Requires context switching.
-   Q: Inventory Valuation Calculation? -> A: Moving Average Cost (AVCO). Update cost on receipt; use avg cost for COGS on delivery.
-   Q: Transaction Document Numbering? -> A: Format-driven ({Prefix}/{Year}/{Seq}). Scoped by Company.
-   Q: Taxation Handling? -> A: Flat Rate per Transaction. Select rate on header, apply to total.
-   Q: Company Roles Granularity? -> A: Granular Permissions (Custom RBAC). Custom roles with specific permission flags.

#### Sales Module

-   **FR-SALES-001**: Users MUST be able to manage Customer profiles (Name, Address, Contact).
-   **FR-SALES-002**: Users MUST be able to create, edit, and confirm Sales Orders containing multiple line items.
-   **FR-SALES-003**: System MUST calculate totals, taxes (simple placeholder), and validate product availability.

#### Purchasing Module

-   **FR-PURCH-001**: Users MUST be able to manage Supplier profiles.
-   **FR-PURCH-002**: Users MUST be able to create and approve Purchase Orders.

#### Inventory & Warehousing Module

-   **FR-INV-001**: System MUST track quantity-on-hand for Products across different Locations/Warehouses.
-   **FR-WHSE-001**: System MUST allow "Goods Receipt" transactions to increase stock based on POs.
-   **FR-WHSE-002**: System MUST allow "Delivery/Dispatch" transactions to decrease stock based on SOs.
-   **FR-WHSE-003**: System MUST strictly prevent negative stock levels. Transactions (like Delivery Notes) that would result in negative inventory quantity MUST be blocked with an error.

#### Finance & Accounting Module

-   **FR-FIN-001**: System MUST generate Invoices from Sales Orders and Bills from Purchase Orders.
-   **FR-FIN-002**: System MUST record Payments against Invoices/Bills.
-   **FR-ACC-001**: System MUST maintain a Chart of Accounts.
-   **FR-ACC-002**: All financial transactions (Invoice, Payment, Bill) MUST automatically generate double-entry Journal Entries.
-   **FR-ACC-003**: Users MUST be able to view a basic Trial Balance report.
-   **FR-ACC-004**: System MUST calculate Inventory Valuation using **Moving Average Cost (AVCO)** method. Average cost is updated on every Goods Receipt.
-   **FR-FIN-003**: System MUST support **Flat Rate Tax** selection per transaction (Order/Invoice), applying to the document total.

### Key Entities _(include if feature involves data)_

-   **Company**: Root entity for isolation.
-   **Partner**: Generic entity for Customer/Supplier.
-   **Product**: Item details, SKU, Price.
-   **Sales Order / Purchase Order**: Transaction headers and lines.
-   **Inventory Move**: Record of stock movement (In/Out).
-   **Invoice / Bill**: Financial demand documents.
-   **Payment**: Record of money transfer.
-   **Journal Entry**: Accounting record (Debits/Credits).

## Success Criteria _(mandatory)_

### Measurable Outcomes

-   **SC-001**: Admin can create a fresh Company environment in under 5 minutes.
-   **SC-002**: A user can complete the full "Order to Cash" verification scenario (SO -> Payload -> Invoice -> Payment) without error.
-   **SC-003**: A user can complete the full "Procure to Pay" verification scenario (PO -> Receive -> Bill -> Payment) without error.
-   **SC-004**: Inventory records must match physical movement simulations with 100% accuracy (no drift).
-   **SC-005**: Accounting Trial Balance is always balanced (Sum of Debits = Sum of Credits) after any transaction.
