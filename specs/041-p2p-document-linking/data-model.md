# Data Model: Document Linking (P2P + O2C)

**Feature**: 041-p2p-document-linking
**Date**: 2025-12-30 (Updated for unified P2P + O2C)

## Overview

This feature adds a unified `fulfillmentId` field to the Invoice model to support document linking for both flows:

| Flow | Order Type | Fulfillment Type | Invoice Type | Link |
|------|------------|------------------|--------------|------|
| **P2P** | PURCHASE (PO) | RECEIPT (GRN) | BILL | Bill → GRN |
| **O2C** | SALES (SO) | SHIPMENT | INVOICE | Invoice → Shipment |

## Current Schema Analysis

### Invoice Model (Unified Bill/Invoice)

The `Invoice` model handles **both** customer invoices (O2C) and supplier bills (P2P) via the `type` field.

**Existing Fields**:

```prisma
model Invoice {
  id                    String
  companyId             String
  orderId               String?       # Link to Order (SO or PO)
  partnerId             String
  type                  InvoiceType   # INVOICE | BILL | EXPENSE | CREDIT_NOTE | DEBIT_NOTE
  status                InvoiceStatus
  invoiceNumber         String?
  dueDate               DateTime
  amount                Decimal       # Total after DP deduction
  subtotal              Decimal       # Original subtotal before DP
  taxAmount             Decimal
  taxRate               Decimal
  balance               Decimal
  supplierInvoiceNumber String?       # External Bill Reference
  paymentTermsString    String?
  notes                 String?
  isDownPayment         Boolean       # True = DP Bill
  dpBillId              String?       # Links final bill to DP bill
  // ... relations
}
```

**Types**:

- `INVOICE` = Customer Invoice (O2C)
- `BILL` = Supplier Bill (P2P)
- `EXPENSE` = Direct expense
- `CREDIT_NOTE` = O2C credit
- `DEBIT_NOTE` = P2P credit

### Fulfillment Model (Unified GRN/Shipment)

The `Fulfillment` model handles GRN (P2P) and Shipment (O2C) via the `type` field.

**Existing Fields**:

```prisma
model Fulfillment {
  id         String
  companyId  String
  orderId    String          # Link to Order (SO or PO)
  type       FulfillmentType # RECEIPT | SHIPMENT | RETURN | PURCHASE_RETURN
  number     String
  date       DateTime
  status     DocumentStatus  # DRAFT | POSTED | VOIDED
  notes      String?
  receivedBy String?         # Only for RECEIPT type
  // ... items relation
}
```

**Types**:

- `RECEIPT` = Goods Receipt Note (P2P)
- `SHIPMENT` = Shipment (O2C)
- `RETURN` = Sales Return
- `PURCHASE_RETURN` = Purchase Return

---

## Required Schema Changes (IMPLEMENTED ✅)

### Add `fulfillmentId` to Invoice Model

Link regular Invoices/Bills to their source Fulfillment (GRN or Shipment).

```prisma
model Invoice {
  // ... existing fields ...

  // Feature 041: Fulfillment Linking (GRN for Bills, Shipment for Invoices)
  fulfillmentId String?
  fulfillment   Fulfillment? @relation("FulfillmentInvoices", fields: [fulfillmentId], references: [id])
}
```

### Add `invoices` Relation to Fulfillment Model

```prisma
model Fulfillment {
  // ... existing fields ...

  // Feature 041: Invoices/Bills linked to this Fulfillment
  // - For RECEIPT (GRN): Bills (Invoice type=BILL)
  // - For SHIPMENT: Invoices (Invoice type=INVOICE)
  invoices     Invoice[]    @relation("FulfillmentInvoices")
}
```

---

## Validation Rules

### Invoice/Bill Creation

| Rule                                     | Validation                                                       |
| ---------------------------------------- | ---------------------------------------------------------------- |
| FR-010: All Bills linked to PO           | `orderId` required, Order.type = PURCHASE                        |
| FR-010b: All Invoices linked to SO       | `orderId` required, Order.type = SALES                           |
| FR-008: Regular Bills linked to GRN      | `fulfillmentId` required if `!isDownPayment`, Fulfillment.type = RECEIPT |
| FR-008b: Regular Invoices linked to Ship | `fulfillmentId` required if `!isDownPayment`, Fulfillment.type = SHIPMENT |
| FR-009: DP has no Fulfillment link       | `fulfillmentId` must be null if `isDownPayment`                  |
| FR-014: No over-billing (P2P)            | totalBilled + newBill ≤ Order.totalAmount - Order.dpAmount       |
| FR-014b: No over-invoicing (O2C)         | totalInvoiced + newInvoice ≤ Order.totalAmount - Order.dpAmount  |
| FR-017: No duplicate fulfillment billing | Fulfillment with existing Invoice cannot be billed/invoiced again |
### Payment Creation

| Rule                    | Validation                       |
| ----------------------- | -------------------------------- |
| FR-015: No over-payment | payment.amount ≤ invoice.balance |

---

## Key Entity Relationships

```
Order (PO or SO)
├── type: PURCHASE | SALES
├── items: OrderItem[]
├── fulfillments: Fulfillment[] (GRNs for PO, Shipments for SO)
├── invoices: Invoice[] (Bills for PO, Invoices for SO)
└── dpAmount: Decimal (DP amount)

Fulfillment (GRN or Shipment)
├── type: RECEIPT | SHIPMENT
├── orderId → Order
├── items: FulfillmentItem[]
├── invoices: Invoice[] (linked Invoices/Bills)
└── outstandingAmount = totalValue - sum(invoices.amount) (COMPUTED)

Invoice (Bill or Invoice)
├── type: BILL | INVOICE
├── orderId → Order (required for all)
├── fulfillmentId → Fulfillment (required for regular, null for DP)
├── isDownPayment: Boolean
├── dpBillId → Invoice (links final to DP)
└── balance: Decimal
```

---

## Query Patterns

### Order Detail with Related Documents (P2P)

```typescript
// Purchase Order with all related GRNs and Bills
const po = await prisma.order.findUnique({
  where: { id: orderId, companyId, type: 'PURCHASE' },
  include: {
    partner: true,
    items: { include: { product: true } },
    fulfillments: {
      where: { type: 'RECEIPT' },
      include: { invoices: true },  // Bills linked to each GRN
    },
    invoices: {
      where: { type: 'BILL' },
    },
  },
});
```

### Order Detail with Related Documents (O2C)

```typescript
// Sales Order with all related Shipments and Invoices
const so = await prisma.order.findUnique({
  where: { id: orderId, companyId, type: 'SALES' },
  include: {
    partner: true,
    items: { include: { product: true } },
    fulfillments: {
      where: { type: 'SHIPMENT' },
      include: { invoices: true },  // Invoices linked to each Shipment
    },
    invoices: {
      where: { type: 'INVOICE' },
    },
  },
});
```

### Fulfillment Outstanding Amount Calculation

```typescript
// Calculate outstanding amount for a Fulfillment (GRN liability or Shipment unbilled)
const fulfillmentValue = fulfillment.items.reduce(
  (sum, item) =>
    sum.plus(new Decimal(item.quantity).times(item.orderItem.price)),
  new Decimal(0)
);

const invoicedAmount = fulfillment.invoices.reduce(
  (sum, inv) => sum.plus(inv.amount),
  new Decimal(0)
);

const outstandingAmount = fulfillmentValue.minus(invoicedAmount);
// For GRN: this is "liability" (what we owe supplier)
// For Shipment: this is "unbilled" (what customer owes us)
```
