# Implementation Plan: Document Linking & Overpayment Prevention (P2P + O2C)

**Branch**: `041-p2p-document-linking` | **Date**: 2025-12-30 | **Spec**: [spec.md](./spec.md)

## Summary

Enable Order Detail pages (PO and SO) to display all related Fulfillments and Invoices with proper linking:

| Flow | Order | Fulfillment | Invoice | Link |
|------|-------|-------------|---------|------|
| **P2P** | PO | GRN (RECEIPT) | Bill (BILL) | Regular Bill → GRN |
| **O2C** | SO | Shipment (SHIPMENT) | Invoice (INVOICE) | Regular Invoice → Shipment |

DP Invoices/Bills link only to Order (no Fulfillment). Fulfillments display outstanding amounts. System prevents over-invoicing/over-billing and over-payment.

## Technical Context

**Language/Version**: TypeScript / Node.js 18+  
**Primary Dependencies**: Express, tRPC, Prisma, Zod, React  
**Storage**: PostgreSQL via Prisma  
**Testing**: Vitest (Integration Tests)  
**Target Platform**: Web (Browser + Node API)  
**Project Type**: Monorepo (apps/web, apps/api, packages/\*)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Dependency**: Frontend ↔ Backend via HTTP only? Apps → Packages? ✓
- [x] **I. Multi-Tenant**: ALL data isolated by `companyId`? ✓
- [x] **II. Type System**: Shared types in `packages/shared`? Types use `z.infer`? ✓
- [x] **III. Backend Layers**: Service checks `Policy` before Action? (Service → Policy → Repository) ✓
- [x] **III-A. Dumb Layers**: Controller only calls service? Repository has no business logic? ✓
- [x] **IV. Frontend**: Logic in `src/features`? UI is State Projection? ✓
- [x] **V. Callback-Safe**: Services export standalone functions? ✓
- [x] **VI. Build Verification**: `npx tsc --noEmit` and `npm run build` will pass? ✓
- [x] **VII. Parity**: If Feature A exists in Sales, does it exist in Procurement? ✓
- [x] **VIII. Performance**: No N+1 Client loops? Lists use Backend `include` for relations? ✓
- [x] **XV. Test Contracts**: Mocks satisfy all Policy/Service layer expectations? ✓
- [x] **XVI. Financial Precision**: `Decimal` for money? `Number()` in test assertions? ✓
- [x] **XVII. Integration State**: Sequential flows in single `it()` block? ✓
- [x] **XXI. Anti-Bloat**: Reuse existing methods? No redundant method creation? ✓

## Project Structure

### Documentation (this feature)

```text
specs/041-p2p-document-linking/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # API contracts
│   └── api.md
└── checklists/
    └── requirements.md
```

### Source Code Changes

```text
packages/database/prisma/
└── schema.prisma           # Add fulfillmentId to Invoice, invoices[] to Fulfillment (DONE ✅)

apps/api/src/modules/
├── procurement/
│   └── purchase-order.repository.ts  # Include fulfillments + invoices (P2P)
├── sales/
│   └── sales-order.repository.ts     # Include fulfillments + invoices (O2C)
├── accounting/
│   ├── policies/bill.policy.ts       # Add over-billing validation
│   ├── policies/invoice.policy.ts    # Add over-invoicing validation (O2C)
│   ├── services/bill.service.ts      # Set fulfillmentId, validate not billed
│   └── services/invoice.service.ts   # Set fulfillmentId, validate not invoiced
└── inventory/
    └── inventory.service.ts          # Add outstanding amount calculation

apps/web/src/features/
├── procurement/
│   └── pages/PurchaseOrderDetail.tsx # Add GRN + Bill lists (P2P)
├── sales/
│   └── pages/SalesOrderDetail.tsx    # Add Shipment + Invoice lists (O2C)
└── inventory/
    ├── pages/GoodsReceiptDetail.tsx  # Add liability display (P2P)
    └── pages/ShipmentDetail.tsx      # Add unbilled display (O2C)
```

## Implementation Phases

### Phase 1: Database Schema (DONE ✅)

- Add `fulfillmentId` FK to Invoice model
- Add `invoices` relation to Fulfillment model
- Schema pushed via `npm run db:push`

### Phase 2: Backend Validation

- Add `validateNotOverBilling()` to BillPolicy (P2P)
- Add `validateNotOverInvoicing()` to InvoicePolicy (O2C)
- Add `validateFulfillmentNotInvoiced()` to both policies
- Update BillService/InvoiceService to set fulfillmentId and run validations

### Phase 3: Backend Queries

- Update PurchaseOrderRepository to include fulfillments + invoices (P2P)
- Update SalesOrderRepository to include fulfillments + invoices (O2C)
- Add outstanding amount calculation to Fulfillment response

### Phase 4: Frontend Display

**P2P (Purchase Order)**:
- Add GRN list to PO detail page
- Add Bill list with type/fulfillment indicators to PO detail page
- Add liability display to GRN detail page

**O2C (Sales Order)**:
- Add Shipment list to SO detail page
- Add Invoice list with type/fulfillment indicators to SO detail page
- Add unbilled amount display to Shipment detail page

### Phase 5: Integration Tests

- Test PO detail shows related documents (GRNs + Bills)
- Test SO detail shows related documents (Shipments + Invoices)
- Test over-billing/over-invoicing prevention
- Test duplicate fulfillment invoicing prevention

## Generated Artifacts

| Artifact                               | Purpose                              |
| -------------------------------------- | ------------------------------------ |
| [research.md](./research.md)           | Technical decisions and alternatives |
| [data-model.md](./data-model.md)       | Entity changes and validation rules  |
| [contracts/api.md](./contracts/api.md) | API endpoint specifications          |
| [quickstart.md](./quickstart.md)       | Step-by-step implementation guide    |
