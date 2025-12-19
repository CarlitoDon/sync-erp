# API Contracts: Procure-to-Pay

**Spec**: [spec.md](../spec.md)

## Endpoints

### Purchase Orders

| Method | Endpoint                       | Description     | Input           | Output          |
| :----- | :----------------------------- | :-------------- | :-------------- | :-------------- |
| `POST` | `/purchase-orders`             | Create DRAFT PO | `CreatePOInput` | `PurchaseOrder` |
| `POST` | `/purchase-orders/:id/confirm` | Confirm PO      | -               | `PurchaseOrder` |
| `POST` | `/purchase-orders/:id/cancel`  | Cancel PO       | -               | `PurchaseOrder` |
| `GET`  | `/purchase-orders/:id`         | Get Details     | -               | `PurchaseOrder` |

### Goods Receipts (GRN)

| Method | Endpoint                   | Description               | Input             | Output         |
| :----- | :------------------------- | :------------------------ | :---------------- | :------------- |
| `POST` | `/goods-receipts`          | Create DRAFT GRN from PO  | `CreateGRNInput`  | `GoodsReceipt` |
| `POST` | `/goods-receipts/:id/post` | Post GRN (Update Stock)   | -                 | `GoodsReceipt` |
| `POST` | `/goods-receipts/:id/void` | Void GRN (Rollback Stock) | `VoidReasonInput` | `GoodsReceipt` |

### Bills (Invoices)

| Method | Endpoint          | Description                | Input             | Output |
| :----- | :---------------- | :------------------------- | :---------------- | :----- |
| `POST` | `/bills`          | Create DRAFT Bill from GRN | `CreateBillInput` | `Bill` |
| `POST` | `/bills/:id/post` | Post Bill (Create AP)      | -                 | `Bill` |
| `POST` | `/bills/:id/void` | Void Bill (Reverse AP)     | `VoidReasonInput` | `Bill` |

### Payments

| Method | Endpoint             | Description    | Input                | Output    |
| :----- | :------------------- | :------------- | :------------------- | :-------- |
| `POST` | `/payments`          | Record Payment | `CreatePaymentInput` | `Payment` |
| `POST` | `/payments/:id/void` | Void Payment   | `VoidReasonInput`    | `Payment` |

## Types (Zod Schemas)

> Defined in `packages/shared/src/validators/p2p.ts`

```typescript
export const CreatePOInputSchema = z.object({
  supplierId: z.string(),
  date: z.string().datetime(),
  paymentTerms: z.string(),
  expectedDeliveryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().positive(), // Backend converts to Decimal
        unitPrice: z.number().nonnegative(),
      })
    )
    .min(1),
});

export const CreateGRNInputSchema = z.object({
  purchaseOrderId: z.string(),
  date: z.string().datetime(),
  items: z.array(
    z.object({
      poLineId: z.string(),
      quantity: z.number().positive(),
    })
  ),
});

export const CreateBillInputSchema = z.object({
  supplierInvoiceNumber: z.string(),
  date: z.string().datetime(),
  dueDate: z.string().datetime(),
  items: z.array(
    z.object({
      grnLineId: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
    })
  ),
});

export const CreatePaymentInputSchema = z.object({
  billId: z.string(),
  accountId: z.string(), // Bank/Cash account
  date: z.string().datetime(),
  amount: z.number().positive(),
  reference: z.string().optional(),
});

export const VoidReasonInputSchema = z.object({
  reason: z.string().min(5),
});
```
