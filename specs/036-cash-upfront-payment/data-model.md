# Data Model: Cash Upfront Payment

**Feature**: 036-cash-upfront-payment  
**Date**: 2025-12-23

---

## Schema Changes

### 1. New Enums

```prisma
enum PaymentTerms {
  NET_30    // Standard 30-day payment after invoice
  PARTIAL   // Partial upfront, partial on delivery
  UPFRONT   // Full payment before delivery
}

enum PaymentStatus {
  PENDING       // No payment recorded
  PARTIAL       // Some payment made, not fully paid
  PAID_UPFRONT  // Fully paid upfront
  SETTLED       // Prepaid has been cleared against bill
}
```

### 2. Order Model Changes

```prisma
model Order {
  id              String        @id @default(uuid())
  companyId       String
  partnerId       String
  type            OrderType
  status          OrderStatus   @default(DRAFT)
  orderNumber     String?
  totalAmount     Decimal       @default(0)
  taxRate         Decimal       @default(0)

  // === NEW FIELDS ===
  paymentTerms    PaymentTerms  @default(NET_30)
  paymentStatus   PaymentStatus?
  paidAmount      Decimal       @default(0)  // Sum of upfront payments

  // Relations
  company         Company       @relation(fields: [companyId], references: [id])
  partner         Partner       @relation(fields: [partnerId], references: [id])
  items           OrderItem[]
  invoices        Invoice[]
  goodsReceipts   GoodsReceipt[]
  shipments       Shipment[]
  upfrontPayments Payment[]     @relation("OrderUpfrontPayments")  // NEW

  version         Int           @default(0)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([companyId])
  @@index([partnerId])
  @@index([type])
  @@index([status])
  @@index([paymentTerms])
  @@index([paymentStatus])
}
```

### 3. Payment Model Changes

```prisma
model Payment {
  id          String    @id @default(uuid())
  companyId   String
  invoiceId   String?   // For invoice/bill payments

  // === NEW FIELDS ===
  orderId     String?               // For upfront payments (PO link)
  paymentType String    @default("INVOICE")  // 'UPFRONT' | 'INVOICE'
  settledAt   DateTime?             // When this prepaid was applied to bill
  settlementBillId String?          // Which bill consumed this prepaid

  amount      Decimal
  method      String                // 'CASH' | 'BANK' | 'TRANSFER'
  reference   String?               // User-provided reference

  // Relations
  company     Company   @relation(fields: [companyId], references: [id])
  invoice     Invoice?  @relation(fields: [invoiceId], references: [id])
  order       Order?    @relation("OrderUpfrontPayments", fields: [orderId], references: [id])
  settlementBill Invoice? @relation("SettlementPayments", fields: [settlementBillId], references: [id])

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([companyId])
  @@index([invoiceId])
  @@index([orderId])
  @@index([paymentType])
  @@index([settledAt])
}
```

### 4. Invoice Model (Optional Enhancement)

```prisma
model Invoice {
  // ... existing fields ...

  // NEW: Track settlements
  settlements Payment[] @relation("SettlementPayments")
}
```

---

## Entity Relationship Diagram

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Order     │         │   Payment   │         │  Invoice    │
│ (PO/SO)     │         │             │         │  (Bill)     │
├─────────────┤         ├─────────────┤         ├─────────────┤
│ id          │◄────────┤ orderId     │         │ id          │
│ paymentTerms│         │ invoiceId   │────────►│ orderId     │
│ paymentStatus         │ paymentType │         │ balance     │
│ paidAmount  │         │ amount      │         │ status      │
│ totalAmount │         │ settledAt   │         │             │
└─────────────┘         │ settlementBillId─────►│             │
       │                └─────────────┘         └─────────────┘
       │                                               │
       │                ┌─────────────┐                │
       │                │   Journal   │                │
       └───────────────►│             │◄───────────────┘
         (via Service)  │ reference   │  (via Service)
                        │ lines[]     │
                        └─────────────┘
```

---

## Field Validations

### PaymentTerms

| Value     | Description                    | UI Label          |
| --------- | ------------------------------ | ----------------- |
| `NET_30`  | Standard payment after invoice | "Net 30 Days"     |
| `PARTIAL` | Split payment (future)         | "Partial Upfront" |
| `UPFRONT` | Full payment before delivery   | "Cash Upfront"    |

### PaymentStatus

| Value          | Description                     | Transition From  | Transition To         |
| -------------- | ------------------------------- | ---------------- | --------------------- |
| `null`         | Not applicable (non-upfront PO) | -                | -                     |
| `PENDING`      | Upfront PO, no payment yet      | null             | PARTIAL, PAID_UPFRONT |
| `PARTIAL`      | Some payment, not fully paid    | PENDING          | PAID_UPFRONT          |
| `PAID_UPFRONT` | Fully paid upfront              | PENDING, PARTIAL | SETTLED               |
| `SETTLED`      | Prepaid cleared against bill    | PAID_UPFRONT     | -                     |

### Business Rules

1. **Only UPFRONT POs have paymentStatus**: If `paymentTerms != UPFRONT`, `paymentStatus` should be null.
2. **paidAmount <= totalAmount**: Repository enforces atomic update with validation.
3. **Payment.orderId XOR Payment.invoiceId**: A payment links to PO OR Invoice, not both.
4. **Settlement requires POSTED bill**: Cannot settle against DRAFT bill.

---

## State Transitions

### Order State Machine (Payment)

```
           ┌─────────────────────────────────────────┐
           │                                         │
           ▼                                         │
     ┌──────────┐     register     ┌───────────┐    │ more payment
     │ PENDING  │ ──────────────►  │  PARTIAL  │ ───┘
     └──────────┘     payment      └───────────┘
           │ (if full)                   │
           │                             │ (if full)
           ▼                             ▼
     ┌───────────────┐          ┌───────────────┐
     │  PAID_UPFRONT │ ◄────────│  PAID_UPFRONT │
     └───────────────┘          └───────────────┘
              │
              │ settle against bill
              ▼
     ┌───────────────┐
     │   SETTLED     │
     └───────────────┘
```

---

## Migration Script

```sql
-- Add PaymentTerms enum
CREATE TYPE "PaymentTerms" AS ENUM ('NET_30', 'PARTIAL', 'UPFRONT');

-- Add PaymentStatus enum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID_UPFRONT', 'SETTLED');

-- Add new columns to Order
ALTER TABLE "Order"
  ADD COLUMN "paymentTerms" "PaymentTerms" NOT NULL DEFAULT 'NET_30',
  ADD COLUMN "paymentStatus" "PaymentStatus",
  ADD COLUMN "paidAmount" DECIMAL(19,4) NOT NULL DEFAULT 0;

-- Add new columns to Payment
ALTER TABLE "Payment"
  ADD COLUMN "orderId" TEXT,
  ADD COLUMN "paymentType" TEXT NOT NULL DEFAULT 'INVOICE',
  ADD COLUMN "settledAt" TIMESTAMP(3),
  ADD COLUMN "settlementBillId" TEXT;

-- Add foreign keys
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_settlementBillId_fkey"
  FOREIGN KEY ("settlementBillId") REFERENCES "Invoice"("id") ON DELETE SET NULL;

-- Add indexes
CREATE INDEX "Order_paymentTerms_idx" ON "Order"("paymentTerms");
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX "Payment_paymentType_idx" ON "Payment"("paymentType");
CREATE INDEX "Payment_settledAt_idx" ON "Payment"("settledAt");
```

---

## Seed Data Required

### New Account

```typescript
// packages/database/prisma/seed.ts
{
  code: '1600',
  name: 'Advances to Supplier',
  type: 'ASSET',
  isActive: true,
}
```

---

## Zod Schemas (packages/shared)

### Order Schema Updates

```typescript
// packages/shared/src/validators/order.validators.ts

export const PaymentTermsSchema = z.enum([
  'NET_30',
  'PARTIAL',
  'UPFRONT',
]);
export type PaymentTerms = z.infer<typeof PaymentTermsSchema>;

export const PaymentStatusSchema = z.enum([
  'PENDING',
  'PARTIAL',
  'PAID_UPFRONT',
  'SETTLED',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const CreatePurchaseOrderSchema = z.object({
  partnerId: z.string().uuid(),
  items: z.array(OrderItemSchema),
  taxRate: z.number().min(0).max(100).optional(),
  paymentTerms: PaymentTermsSchema.optional().default('NET_30'), // NEW
});
```

### Upfront Payment Schema

```typescript
// packages/shared/src/validators/payment.validators.ts

export const RegisterUpfrontPaymentSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['CASH', 'BANK', 'TRANSFER']),
  bankAccountId: z.string().uuid().optional(),
  reference: z.string().max(100).optional(),
  businessDate: z.date().optional(),
});

export type RegisterUpfrontPaymentInput = z.infer<
  typeof RegisterUpfrontPaymentSchema
>;
```

### Settlement Schema

```typescript
export const SettlePrepaidSchema = z.object({
  billId: z.string().uuid(),
});

export type SettlePrepaidInput = z.infer<typeof SettlePrepaidSchema>;
```
