# Quickstart: Document Linking (P2P + O2C)

## Prerequisites

- Node.js 18+
- PostgreSQL running with sync-erp database
- Codebase at `041-p2p-document-linking` branch

## Key Understanding

**Unified Models** (from Prisma schema):

- `Invoice` model = Both Bills (type=BILL) and Invoices (type=INVOICE)
- `Fulfillment` model = Both GRN (type=RECEIPT) and Shipment (type=SHIPMENT)
- `Order` model = Both PO (type=PURCHASE) and SO (type=SALES)

**Document Linking**:

| Flow | Order | Fulfillment | Invoice | Link Field |
|------|-------|-------------|---------|------------|
| P2P | PO | GRN (RECEIPT) | Bill (BILL) | `fulfillmentId` |
| O2C | SO | Shipment (SHIPMENT) | Invoice (INVOICE) | `fulfillmentId` |

## Implementation Steps

### 1. Database Schema (DONE ✅)

The `fulfillmentId` field has been added to the Invoice model:

```prisma
model Invoice {
  // ... existing fields ...

  // Feature 041: Fulfillment Linking (GRN for Bills, Shipment for Invoices)
  fulfillmentId String?
  fulfillment   Fulfillment? @relation("FulfillmentInvoices", fields: [fulfillmentId], references: [id])
}

model Fulfillment {
  // ... existing fields ...

  // Feature 041: Invoices/Bills linked to this Fulfillment
  invoices     Invoice[]    @relation("FulfillmentInvoices")
}
```

Schema already pushed via `npm run db:push`.

### 2. Update BillService & InvoiceService (20 min)

**P2P - BillService**: `apps/api/src/modules/accounting/services/bill.service.ts`

In `createFromPurchaseOrder()`, ensure `fulfillmentId` is saved:

```typescript
const createData = {
  // ... existing fields ...
  fulfillmentId: data.fulfillmentId || null, // Link to GRN
};
```

**O2C - InvoiceService**: Similar pattern for creating Invoice from Shipment.

### 3. Add Policy Validations (15 min)

**BillPolicy**: `apps/api/src/modules/accounting/policies/bill.policy.ts`

Add validation methods:

- `validateNotOverBilling(newAmount, existingTotal, orderTotal, dpAmount)`
- `validateFulfillmentNotInvoiced(fulfillment)` - prevents duplicate billing

**InvoicePolicy**: Similar validations for O2C flow.

### 4. Update Order Repositories (15 min)

**PurchaseOrderRepository**: `apps/api/src/modules/procurement/purchase-order.repository.ts`

Update `findById` to include fulfillments with their invoices:

```typescript
include: {
  partner: true,
  items: { include: { product: true } },
  fulfillments: {
    where: { type: 'RECEIPT' },
    include: { invoices: true }  // Bills linked to each GRN
  },
  invoices: {
    where: { type: 'BILL' }
  }
}
```

**SalesOrderRepository**: Similar update for Shipments and Invoices.

### 5. Update Frontend Pages (30 min each)

**PurchaseOrderDetail.tsx**: `apps/web/src/features/procurement/pages/`

Add two sections:
1. "Goods Receipts" - list of fulfillments (type=RECEIPT) with liability
2. "Bills" - list of invoices (type=BILL) with type indicator (DP/Regular)

**SalesOrderDetail.tsx**: `apps/web/src/features/sales/pages/`

Add two sections:
1. "Shipments" - list of fulfillments (type=SHIPMENT) with unbilled amount
2. "Invoices" - list of invoices (type=INVOICE) with type indicator

### 6. Run Tests

```bash
# Integration test
npm test -- apps/api/test/integration/document-linking.test.ts

# Type check
npx tsc --noEmit

# Build
npm run build
```

## Verification Checklist

### P2P (Purchase Order Flow)

- [ ] PO detail shows GRN list
- [ ] PO detail shows Bill list with DP/Regular indicator
- [ ] Regular Bill shows linked GRN (fulfillmentId)
- [ ] DP Bill shows no GRN link
- [ ] Cannot create Bill exceeding PO value
- [ ] Cannot bill same GRN twice

### O2C (Sales Order Flow)

- [ ] SO detail shows Shipment list
- [ ] SO detail shows Invoice list with DP/Regular indicator
- [ ] Regular Invoice shows linked Shipment (fulfillmentId)
- [ ] DP Invoice shows no Shipment link
- [ ] Cannot create Invoice exceeding SO value
- [ ] Cannot invoice same Shipment twice
