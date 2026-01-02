# API Contracts: Document Linking (P2P + O2C)

**Note**: This document uses accurate model names from schema.

| Flow | Order | Fulfillment | Invoice | Field |
|------|-------|-------------|---------|-------|
| P2P | PO (type=PURCHASE) | GRN (type=RECEIPT) | Bill (type=BILL) | `fulfillmentId` |
| O2C | SO (type=SALES) | Shipment (type=SHIPMENT) | Invoice (type=INVOICE) | `fulfillmentId` |

---

## GET /trpc/purchaseOrder.getById

**Response** (enhanced with fulfillments and bills):

```typescript
interface PurchaseOrderDetail {
  id: string;
  orderNumber: string;
  partnerId: string;
  partner: { id: string; name: string };
  status: OrderStatus;
  totalAmount: number;
  dpAmount: number | null;
  dpPercent: number | null;
  taxRate: number;
  items: OrderItem[];

  // Related documents
  fulfillments: FulfillmentSummary[]; // GRNs (type=RECEIPT)
  invoices: BillSummary[]; // Bills (type=BILL)
}

interface FulfillmentSummary {
  id: string;
  number: string;
  date: string;
  status: DocumentStatus; // DRAFT | POSTED | VOIDED
  type: FulfillmentType; // RECEIPT for GRN
  totalValue: number; // Sum of items * price
  outstandingAmount: number; // totalValue - invoicedAmount (computed)
  isInvoiced: boolean; // outstandingAmount === 0
  invoiceId: string | null; // Linked invoice ID (if invoiced)
}

interface BillSummary {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  amount: number;
  balance: number;
  isDownPayment: boolean;
  fulfillmentId: string | null; // Linked GRN
  fulfillmentNumber: string | null; // For display
}
```

---

## GET /trpc/salesOrder.getById

**Response** (enhanced with fulfillments and invoices):

```typescript
interface SalesOrderDetail {
  id: string;
  orderNumber: string;
  partnerId: string;
  partner: { id: string; name: string };
  status: OrderStatus;
  totalAmount: number;
  dpAmount: number | null;
  dpPercent: number | null;
  taxRate: number;
  items: OrderItem[];

  // Related documents
  fulfillments: FulfillmentSummary[]; // Shipments (type=SHIPMENT)
  invoices: InvoiceSummary[]; // Invoices (type=INVOICE)
}

interface FulfillmentSummary {
  id: string;
  number: string;
  date: string;
  status: DocumentStatus;
  type: FulfillmentType; // SHIPMENT
  totalValue: number;
  unbilledAmount: number; // totalValue - invoicedAmount
  isInvoiced: boolean;
  invoiceId: string | null;
}

interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  amount: number;
  balance: number;
  isDownPayment: boolean;
  fulfillmentId: string | null; // Linked Shipment
  fulfillmentNumber: string | null;
}
```

---

## POST /trpc/bill.createFromPO

**Request** (fulfillmentId for linking):

```typescript
interface CreateBillFromPOInput {
  orderId: string;
  fulfillmentId?: string; // Required for regular bills (GRN), null for DP
  supplierInvoiceNumber?: string;
  dueDate?: Date;
  taxRate?: number;
  businessDate?: Date;
  paymentTermsString?: string;
}
```

**New Validation Errors**:

- `FULFILLMENT_ALREADY_INVOICED`: Fulfillment already has a linked Invoice/Bill
- `EXCEEDS_ORDER_VALUE`: Total invoiced/billed would exceed Order value minus DP
- `FULFILLMENT_NOT_FOUND`: fulfillmentId does not exist or wrong type
- `FULFILLMENT_NOT_FOR_ORDER`: Fulfillment does not belong to this Order

---

## POST /trpc/invoice.createFromSO

**Request** (fulfillmentId for linking):

```typescript
interface CreateInvoiceFromSOInput {
  orderId: string;
  fulfillmentId?: string; // Required for regular invoices (Shipment), null for DP
  dueDate?: Date;
  taxRate?: number;
  businessDate?: Date;
  paymentTermsString?: string;
}
```

**Validation Errors**: Same as above

---

## GET /trpc/grn.getById

**Response** (enhanced with liability):

```typescript
interface FulfillmentDetail {
  id: string;
  number: string;
  orderId: string;
  order: { orderNumber: string; partner: { name: string } };
  type: FulfillmentType; // RECEIPT
  status: DocumentStatus;
  date: string;
  items: FulfillmentItem[];

  // Financial tracking (P2P)
  totalValue: number;
  liability: number; // totalValue - billedAmount (what we owe supplier)
  linkedInvoice: {
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    amount: number;
  } | null;
}
```

---

## GET /trpc/shipment.getById

**Response** (enhanced with unbilled amount):

```typescript
interface ShipmentDetail {
  id: string;
  number: string;
  orderId: string;
  order: { orderNumber: string; partner: { name: string } };
  type: FulfillmentType; // SHIPMENT
  status: DocumentStatus;
  date: string;
  items: FulfillmentItem[];

  // Financial tracking (O2C)
  totalValue: number;
  unbilledAmount: number; // totalValue - invoicedAmount (what customer owes us)
  linkedInvoice: {
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    amount: number;
  } | null;
}
```

---

## Validation Policies

### BillPolicy (apps/api/src/modules/accounting/policies/bill.policy.ts)

```typescript
// FR-014: Prevent over-billing
static validateNotOverBilling(
  newBillSubtotal: Decimal,
  existingBilledTotal: Decimal,
  orderTotal: Decimal,
  dpAmount: Decimal
): void {
  const maxBillable = orderTotal.minus(dpAmount).minus(existingBilledTotal);
  if (newBillSubtotal.greaterThan(maxBillable.plus(1))) { // 1 IDR tolerance
    throw new DomainError(
      `Bill subtotal exceeds remaining order value. Max billable: ${maxBillable}`,
      400,
      DomainErrorCodes.EXCEEDS_ORDER_VALUE
    );
  }
}

// FR-017: Prevent duplicate fulfillment billing
static validateFulfillmentNotInvoiced(fulfillment: { invoices?: Invoice[] }): void {
  if (fulfillment.invoices && fulfillment.invoices.length > 0) {
    throw new DomainError(
      `Fulfillment already has an invoice/bill`,
      400,
      DomainErrorCodes.FULFILLMENT_ALREADY_INVOICED
    );
  }
}
```

### InvoicePolicy (apps/api/src/modules/accounting/policies/invoice.policy.ts)

```typescript
// FR-014b: Prevent over-invoicing (O2C)
static validateNotOverInvoicing(
  newInvoiceSubtotal: Decimal,
  existingInvoicedTotal: Decimal,
  orderTotal: Decimal,
  dpAmount: Decimal
): void {
  const maxInvoiceable = orderTotal.minus(dpAmount).minus(existingInvoicedTotal);
  if (newInvoiceSubtotal.greaterThan(maxInvoiceable.plus(1))) {
    throw new DomainError(
      `Invoice subtotal exceeds remaining order value. Max invoiceable: ${maxInvoiceable}`,
      400,
      DomainErrorCodes.EXCEEDS_ORDER_VALUE
    );
  }
}

// FR-017: Prevent duplicate fulfillment invoicing
static validateFulfillmentNotInvoiced(fulfillment: { invoices?: Invoice[] }): void {
  // Same as BillPolicy
}
```

### PaymentService (already exists)

```typescript
// Payment amount <= invoice.balance is already enforced
```
