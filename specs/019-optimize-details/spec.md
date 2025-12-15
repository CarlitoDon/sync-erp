# Feature Specification: Enhanced Detail Pages & Linkage

**Feature Branch**: `019-optimize-details`  
**Created**: 2025-12-15  
**Status**: Draft  
**Input**: User description: "buat dan optimisasi halaman details untuk semua modules di frontend. lengkapi hyperlink sehingga bisa crosscheck banyak hal"

## Clarifications

### Session 2025-12-15

- **Q**: How to handle Shipments/Receipts links given no entity exists? -> **A**: Status Only (No Hyperlink).
- **Q**: Should we build Partner Detail pages to enable linking? -> **A**: Yes, build Detail pages for Customers/Suppliers.
- **Q**: Should we build Product and Journal Detail pages? -> **A**: Yes, add them to scope.

## User Scenarios & Testing

### User Story 1 - Cross-Module Navigation (Priority: P1)

As a Finance or Operations user, I want to easily navigate between related documents (Orders ↔ Invoices/Bills) so that I can audit a transaction's lifecycle.

**Acceptance Scenarios**:

1. **Given** a Sales Order linked to an Invoice, **When** clicking the Invoice Number, **Then** I navigate to the Invoice Detail page.
2. **Given** an Invoice linked to a Sales Order, **When** clicking the "Source Order" number, **Then** I navigate to the Sales Order Detail page.

### User Story 2 - Partner 360 View (Priority: P1)

As a Sales/Procurement Manager, I want to click on a Partner's name in any document to see their full details and history.

**Acceptance Scenarios**:

1. **Given** a Sales Order, **When** clicking the Customer Name, **Then** I navigate to the new Customer Detail page.
2. **Given** a Customer Detail page, **When** viewing the history, **Then** I see a list of their recent Orders and Invoices.

### User Story 3 - Product Drill-Down (Priority: P2)

As a Sales/Procurement user, I want to click on a product in an order item list to check its current stock and cost.

**Acceptance Scenarios**:

1. **Given** a Sales Order with items, **When** clicking a Product Name, **Then** I navigate to the new Product Detail page showing Stock on Hand.

### User Story 4 - Financial Audit (Priority: P2)

As an Accountant, I want to view the full details of a Journal Entry to verify the debits and credits.

**Acceptance Scenarios**:

1. **Given** the Journal Entries list, **When** clicking an Entry, **Then** I navigate to the Journal Detail view.

## Requirements

### Functional Requirements

- **FR-001**: Sales Order Detail MUST display a "Related Documents" section listing associated Invoices.
- **FR-002**: Purchase Order Detail MUST display a "Related Documents" section listing associated Bills.
- **FR-003**: Invoice/Bill Detail MUST display a link back to the source Order.
- **FR-004**: All Document links MUST be clickable (SPA navigation).
- **FR-005**: All Document lists MUST show visual Status badges (e.g. "Paid", "Draft").
- **FR-006**: Create `CustomerDetail` page displaying profile info and Sales History.
- **FR-007**: Create `SupplierDetail` page displaying profile info and Procurement History.
- **FR-008**: Create `ProductDetail` page displaying Product info and Movement History.
- **FR-009**: Create `JournalDetail` page displaying full Ledger Lines.
- **FR-010**: All Documents (Orders, Invoices, Bills) MUST hyperlink the Partner Name to the respective Detail Page.
- **FR-011**: Order Line Items (Sales/Purchase) MUST hyperlink the Product Name to the Product Detail Page.
- **FR-012**: "Shipment" status should be displayed on Orders, but NOT hyperlinked.

### Key Entities

- **Order, Invoice, Bill**: Transaction Documents.
- **Partner (Customer/Supplier)**: Master Data.
- **Product**: Inventory Master Data.
- **Journal**: Financial Ledger.

## Success Criteria

- **SC-001**: Navigation between Order ↔ Invoice is 1 click.
- **SC-002**: Navigation from Document → Partner/Product is 1 click.
- **SC-003**: All 4 new Detail Pages (Customer, Supplier, Product, Journal) are implemented and linked.

## Constitution Compliance

### Frontend Architecture Checklist

- [ ] **Feature Isolation**: Logic in `src/features`.
- [ ] **Systematic Updates**: Sales & Procurement updated symmetrically.
- [ ] **Data Fetching**: Use `include` or efficient fetching for History lists (Avoid N+1).
