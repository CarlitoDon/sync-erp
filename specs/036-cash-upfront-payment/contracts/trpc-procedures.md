# tRPC API Contracts: Cash Upfront Payment

**Feature**: 036-cash-upfront-payment  
**Date**: 2025-12-23

---

## Overview

This document defines the tRPC procedures for the Cash Upfront Payment feature.

---

## Purchase Order Router Extensions

### `purchaseOrder.registerUpfrontPayment`

**Type**: Mutation  
**Auth**: `protectedProcedure`

**Input Schema**:

```typescript
z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['CASH', 'BANK', 'TRANSFER']),
  bankAccountId: z.string().uuid().optional(), // Required if method != CASH
  reference: z.string().max(100).optional(),
  businessDate: z.date().optional(), // Defaults to today
});
```

**Output Schema**:

```typescript
{
  id: string;
  companyId: string;
  orderId: string;
  amount: Decimal;
  method: string;
  reference: string | null;
  paymentType: 'UPFRONT';
  createdAt: Date;
}
```

**Errors**:
| Code | Message |
|------|---------|
| `NOT_FOUND` | "Purchase order not found" |
| `BAD_REQUEST` | "Cannot register payment for non-upfront order" |
| `BAD_REQUEST` | "Order must be posted before payment" |
| `BAD_REQUEST` | "Payment amount exceeds remaining balance" |
| `BAD_REQUEST` | "Order is already fully paid" |

**Example**:

```typescript
const payment =
  await trpc.purchaseOrder.registerUpfrontPayment.mutate({
    orderId: 'po-uuid-123',
    amount: 5000000,
    method: 'BANK',
    bankAccountId: 'account-1200',
    reference: 'TRF-001',
  });
```

---

### `purchaseOrder.getUpfrontPayments`

**Type**: Query  
**Auth**: `protectedProcedure`

**Input Schema**:

```typescript
z.object({
  orderId: z.string().uuid(),
});
```

**Output Schema**:

```typescript
Array<{
  id: string;
  amount: Decimal;
  method: string;
  reference: string | null;
  settledAt: Date | null;
  createdAt: Date;
}>;
```

**Example**:

```typescript
const payments = await trpc.purchaseOrder.getUpfrontPayments.query({
  orderId: 'po-uuid-123',
});
```

---

### `purchaseOrder.getPaymentSummary`

**Type**: Query  
**Auth**: `protectedProcedure`

**Input Schema**:

```typescript
z.object({
  orderId: z.string().uuid(),
});
```

**Output Schema**:

```typescript
{
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'PENDING' |
    'PARTIAL' |
    'PAID_UPFRONT' |
    'SETTLED' |
    null;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    createdAt: Date;
  }>;
}
```

**Usage**: Display payment info card on PO Detail page.

---

## Bill Router Extensions

### `bill.getPrepaidInfo`

**Type**: Query  
**Auth**: `protectedProcedure`

**Input Schema**:

```typescript
z.object({
  billId: z.string().uuid(),
});
```

**Output Schema**:

```typescript
{
  billId: string;
  billAmount: number;
  billBalance: number;
  hasPrepaid: boolean;
  prepaid: {
    paymentId: string;
    orderId: string;
    orderNumber: string;
    amount: number;
    paidAt: Date;
  } | null;
  settlementAmount: number;  // Min(prepaid, billBalance)
  remainingAfterSettlement: number;  // billBalance - settlementAmount
}
```

**Usage**: Display prepaid info banner on Bill Detail page.

**Example**:

```typescript
const info = await trpc.bill.getPrepaidInfo.query({
  billId: 'bill-uuid-456',
});

if (info.hasPrepaid) {
  // Show settlement banner
  console.log(`Prepaid available: ${info.prepaid.amount}`);
  console.log(`Settlement amount: ${info.settlementAmount}`);
}
```

---

### `bill.settlePrepaid`

**Type**: Mutation  
**Auth**: `protectedProcedure`

**Input Schema**:

```typescript
z.object({
  billId: z.string().uuid(),
});
```

**Output Schema**:

```typescript
{
  bill: {
    id: string;
    status: string;
    balance: number;
  }
  settlement: {
    amount: number;
    journalId: string;
    prepaidPaymentId: string;
  }
}
```

**Errors**:
| Code | Message |
|------|---------|
| `NOT_FOUND` | "Bill not found" |
| `BAD_REQUEST` | "Bill must be posted before settlement" |
| `BAD_REQUEST` | "No prepaid payment found for this order" |
| `BAD_REQUEST` | "Prepaid has already been settled" |
| `BAD_REQUEST` | "Bill is already paid" |

**Side Effects**:

1. Creates journal entry (Dr AP, Cr Advances to Supplier)
2. Reduces bill balance
3. Marks Payment as settled
4. Updates Order paymentStatus to SETTLED if fully cleared

**Example**:

```typescript
const result = await trpc.bill.settlePrepaid.mutate({
  billId: 'bill-uuid-456',
});

console.log(`Settled: ${result.settlement.amount}`);
console.log(`Bill balance now: ${result.bill.balance}`);
```

---

## Finance Router Extensions (Optional)

### `finance.getAccountBalance`

**Type**: Query  
**Auth**: `protectedProcedure`

**Input Schema**:

```typescript
z.object({
  accountCode: z.string(), // e.g., '1600'
});
```

**Output Schema**:

```typescript
{
  accountCode: string;
  accountName: string;
  balance: number;
  asOf: Date;
}
```

**Usage**: Display Advances to Supplier balance for reconciliation.

---

## Journal Service Methods (Internal)

These are service methods, not exposed via tRPC:

### `journalService.postUpfrontPayment()`

**Parameters**:

```typescript
postUpfrontPayment(
  companyId: string,
  paymentId: string,
  orderNumber: string,
  amount: number,
  method: 'CASH' | 'BANK' | 'TRANSFER',
  tx?: Prisma.TransactionClient,
  businessDate?: Date
): Promise<JournalEntry>
```

**Journal Entry**:
| Account | Debit | Credit |
|---------|-------|--------|
| 1600 Advances to Supplier | `amount` | |
| 1100 Cash / 1200 Bank | | `amount` |

---

### `journalService.postSettlement()`

**Parameters**:

```typescript
postSettlement(
  companyId: string,
  billId: string,
  billNumber: string,
  amount: number,
  prepaidPaymentId: string,
  tx?: Prisma.TransactionClient
): Promise<JournalEntry>
```

**Journal Entry**:
| Account | Debit | Credit |
|---------|-------|--------|
| 2100 Accounts Payable | `amount` | |
| 1600 Advances to Supplier | | `amount` |

---

## Response Type Definitions

```typescript
// packages/shared/src/types/upfront-payment.types.ts

export interface UpfrontPaymentResponse {
  id: string;
  companyId: string;
  orderId: string;
  amount: number; // Converted from Decimal
  method: string;
  reference: string | null;
  paymentType: 'UPFRONT';
  settledAt: Date | null;
  createdAt: Date;
}

export interface PaymentSummaryResponse {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus | null;
  payments: UpfrontPaymentResponse[];
}

export interface PrepaidInfoResponse {
  billId: string;
  billAmount: number;
  billBalance: number;
  hasPrepaid: boolean;
  prepaid: {
    paymentId: string;
    orderId: string;
    orderNumber: string;
    amount: number;
    paidAt: Date;
  } | null;
  settlementAmount: number;
  remainingAfterSettlement: number;
}

export interface SettlementResponse {
  bill: {
    id: string;
    status: string;
    balance: number;
  };
  settlement: {
    amount: number;
    journalId: string;
    prepaidPaymentId: string;
  };
}
```

---

## Frontend Integration

### React Query Hooks (via tRPC)

```typescript
// Register payment mutation
const registerPayment =
  trpc.purchaseOrder.registerUpfrontPayment.useMutation({
    onSuccess: () => {
      utils.purchaseOrder.getById.invalidate();
      utils.purchaseOrder.getPaymentSummary.invalidate();
      toast.success('Payment recorded successfully');
    },
  });

// Get prepaid info query
const { data: prepaidInfo } = trpc.bill.getPrepaidInfo.useQuery(
  { billId },
  { enabled: !!billId }
);

// Settle mutation
const settlePrepaid = trpc.bill.settlePrepaid.useMutation({
  onSuccess: () => {
    utils.bill.getById.invalidate();
    utils.bill.getPrepaidInfo.invalidate();
    toast.success('Settlement complete');
  },
});
```
