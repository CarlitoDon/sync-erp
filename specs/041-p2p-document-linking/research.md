# Research: Document Linking (P2P + O2C)

**Feature**: 041-p2p-document-linking
**Date**: 2025-12-30 (Updated for unified P2P + O2C)

## Codebase Analysis

### Unified Models (Important!)

1. **Invoice model** = Both customer invoices AND supplier bills
   - Distinguished by `type` field: `INVOICE` (O2C) vs `BILL` (P2P)
   - NOT separate tables

2. **Fulfillment model** = Both GRN AND Shipment
   - Distinguished by `type` field: `RECEIPT` (GRN) vs `SHIPMENT`
   - NOT separate tables

3. **Order model** = Both SO AND PO
   - Distinguished by `type` field: `SALES` vs `PURCHASE`

### Existing Infrastructure

- **`orderId` on Invoice**: Already links Bills/Invoices to PO/SO ✓
- **`orderId` on Fulfillment**: Already links GRN/Shipment to PO/SO ✓
- **`isDownPayment` on Invoice**: Already identifies DP Bills/Invoices ✓
- **`dpBillId` on Invoice**: Already links final to DP ✓
- **`fulfillmentId` on Invoice**: **IMPLEMENTED ✓** - links to GRN or Shipment

### Relevant Services

| Service              | Location                                                             | Purpose                  |
| -------------------- | -------------------------------------------------------------------- | ------------------------ |
| BillService          | `apps/api/src/modules/accounting/services/bill.service.ts`           | Bill CRUD + posting      |
| InvoiceService       | `apps/api/src/modules/accounting/services/invoice.service.ts`        | Invoice CRUD + posting   |
| InventoryService     | `apps/api/src/modules/inventory/inventory.service.ts`                | GRN/Shipment operations  |
| PurchaseOrderService | `apps/api/src/modules/procurement/purchase-order.service.ts`         | PO management            |
| SalesOrderService    | `apps/api/src/modules/sales/sales-order.service.ts`                  | SO management            |
| InvoiceRepository    | `apps/api/src/modules/accounting/repositories/invoice.repository.ts` | Invoice/Bill data access |

---

## Decision: Unified Fulfillment Linking

**Decision**: Add `fulfillmentId` FK on Invoice model + `invoices` relation on Fulfillment model.

**Rationale**:

- Single field works for both P2P (Bill→GRN) and O2C (Invoice→Shipment)
- Clean FK relationship (Invoice → Fulfillment)
- Allows querying Invoices by Fulfillment and vice versa
- Type safety via Fulfillment.type and Invoice.type validation

---

## Decision: Outstanding Amount Calculation

**Decision**: Calculate outstanding amount as derived field, not stored column.

**Formula**: `outstandingAmount = fulfillmentValue - sum(linkedInvoices.amount)`

**Terminology**:
- For GRN (P2P): Called "liability" (what we owe supplier)
- For Shipment (O2C): Called "unbilled" (what customer owes us)

**Rationale**:

- Avoids data synchronization issues
- Always current (no stale data)
- Simple aggregation query

---

## Decision: Over-Invoicing/Over-Billing Prevention

**Decision**: Validation in Policy layer for both flows.

**Validation Points**:

1. `BillPolicy.validateNotOverBilling()` - total billed ≤ PO total - DP
2. `InvoicePolicy.validateNotOverInvoicing()` - total invoiced ≤ SO total - DP
3. `*Policy.validateFulfillmentNotInvoiced()` - Fulfillment cannot have multiple Invoices
4. `PaymentService` already prevents overpayment (payment ≤ balance)

---

## Implementation Status

| Component                           | Status     | Notes                                |
| ----------------------------------- | ---------- | ------------------------------------ |
| Prisma schema (fulfillmentId)       | ✅ DONE    | Schema pushed                        |
| BillService.createFromPurchaseOrder | ⏳ TODO    | Save fulfillmentId to DB             |
| InvoiceService (O2C)                | ⏳ TODO    | Save fulfillmentId for Shipment link |
| BillPolicy validation               | ⏳ TODO    | Over-billing checks                  |
| InvoicePolicy validation            | ⏳ TODO    | Over-invoicing checks                |
| PO detail include GRNs              | ⏳ TODO    | Update repository                    |
| SO detail include Shipments         | ⏳ TODO    | Update repository                    |
| Frontend PO detail                  | ⏳ TODO    | Add GRN/Bill lists                   |
| Frontend SO detail                  | ⏳ TODO    | Add Shipment/Invoice lists           |
