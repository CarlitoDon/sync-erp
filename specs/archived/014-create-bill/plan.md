# Implementation Plan: Create Bill (Manual Entry)

**Feature Branch**: `14-create-bill`  
**Spec**: [spec.md](file:///Users/wecik/Documents/Offline/sync-erp/specs/014-create-bill/spec.md)  
**Created**: 2025-12-13

## Goal

Add ability to manually create bills without requiring a Purchase Order. This enables users to record one-time expenses, utility bills, and historical bills during system migration.

## Technical Context

| Aspect         | Details                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------- |
| Database       | Invoice model already supports `orderId: null` (optional)                                |
| Backend        | BillService currently only has `createFromPurchaseOrder`, need new `createManual` method |
| Shared Schema  | `CreateBillSchema` exists, extends `CreateInvoiceSchema` with partnerId, dueDate, amount |
| Frontend       | AccountsPayable.tsx needs "Create Bill" button and form modal                            |
| Existing Tests | BillService.test.ts (260 lines), bill.test.ts (routes, 142 lines)                        |

## Constitution Check

| Principle                  | Compliant | Notes                                            |
| -------------------------- | --------- | ------------------------------------------------ |
| I. Monorepo Boundaries     | ✅        | Frontend → API → Database flow maintained        |
| IV. Layered Backend        | ✅        | Controller → Service → Repository pattern        |
| V. Multi-Tenant            | ✅        | All queries scoped by companyId                  |
| VI. Feature-Based Frontend | ✅        | Logic in `src/features/finance/`                 |
| VIII. Global UI Patterns   | ✅        | Using `apiAction()`, reusing existing components |

---

## Proposed Changes

### Shared Package

#### [MODIFY] [index.ts](file:///Users/wecik/Documents/Offline/sync-erp/packages/shared/src/validators/index.ts)

Add `CreateManualBillSchema` for manual bill creation (without orderId):

```typescript
export const CreateManualBillSchema = z.object({
  partnerId: z.string().uuid(),
  subtotal: z.number().positive('Subtotal must be positive'),
  taxRate: z.number().min(0).max(100).default(0),
  dueDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});
```

---

### Backend (apps/api)

#### [MODIFY] [bill.service.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/modules/accounting/services/bill.service.ts)

Add new `createManual` method:

```typescript
interface CreateManualBillInput {
  partnerId: string;
  subtotal: number;
  taxRate?: number;
  dueDate?: Date;
  notes?: string;
}

async createManual(companyId: string, data: CreateManualBillInput): Promise<Invoice> {
  const invoiceNumber = await this.documentNumberService.generate(companyId, 'BILL');

  const taxRate = data.taxRate ?? 0;
  const taxMultiplier = taxRate > 1 ? taxRate / 100 : taxRate;
  const taxAmount = data.subtotal * taxMultiplier;
  const amount = data.subtotal + taxAmount;

  return this.repository.create({
    companyId,
    partnerId: data.partnerId,
    orderId: null,  // No PO for manual bills
    type: InvoiceType.BILL,
    status: InvoiceStatus.DRAFT,
    invoiceNumber,
    subtotal: data.subtotal,
    taxRate,
    taxAmount,
    amount,
    balance: amount,
    dueDate: data.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
}
```

#### [MODIFY] [bill.controller.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/modules/accounting/controllers/bill.controller.ts)

Update `create` method to support both PO-based and manual creation:

```typescript
create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;

    // Check if this is manual creation (no orderId, has partnerId + subtotal)
    if (
      !req.body.orderId &&
      req.body.partnerId &&
      req.body.subtotal
    ) {
      const validated = CreateManualBillSchema.parse(req.body);
      const bill = await this.service.createManual(
        companyId,
        validated
      );
      return res.status(201).json({ success: true, data: bill });
    }

    // Otherwise, use PO-based creation
    const validated = CreateBillSchema.parse(req.body);
    const bill = await this.service.createFromPurchaseOrder(
      companyId,
      {
        orderId: validated.orderId!,
        dueDate: validated.dueDate,
      }
    );
    res.status(201).json({ success: true, data: bill });
  } catch (error) {
    next(error);
  }
};
```

#### [MODIFY] [bill.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/routes/bill.ts)

Update route validation to accept both schemas.

---

### Frontend (apps/web)

#### [MODIFY] [billService.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/finance/services/billService.ts)

Update `CreateBillInput` interface and `create` method:

```typescript
export interface CreateManualBillInput {
  partnerId: string;
  subtotal: number;
  taxRate?: number;
  dueDate?: string;
  notes?: string;
}

async createManual(data: CreateManualBillInput): Promise<Bill> {
  const res = await api.post('/bills', data);
  return res.data.data;
}
```

#### [MODIFY] [AccountsPayable.tsx](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/finance/pages/AccountsPayable.tsx)

Add:

1. "Create Bill" button in header
2. Modal with form for manual bill creation
3. Supplier dropdown (filter Partners by type=SUPPLIER)
4. Form fields: Supplier, Subtotal, Tax Rate, Due Date, Notes
5. Real-time tax/total calculation display

---

## Verification Plan

### Automated Tests

**Existing tests to update:**

1. `apps/api/test/unit/services/BillService.test.ts` - Add tests for `createManual`:

   ```bash
   cd apps/api && npm test -- --grep "BillService"
   ```

2. `apps/api/test/unit/routes/bill.test.ts` - Add tests for POST /api/bills with manual input:
   ```bash
   cd apps/api && npm test -- --grep "Bill Routes"
   ```

**New test cases to add:**

- `createManual` creates bill with correct tax calculation
- `createManual` defaults dueDate to 30 days if not provided
- `createManual` validates partnerId is required
- `createManual` validates subtotal must be positive
- POST /api/bills accepts manual creation payload (partnerId + subtotal without orderId)

### Manual Verification

1. Start dev server: `npm run dev`
2. Navigate to Bills page (`/bills`)
3. Verify "Create Bill" button appears in header
4. Click button → form modal opens
5. Select a supplier from dropdown
6. Enter subtotal (e.g., 1,000,000)
7. Enter tax rate (e.g., 11%)
8. Verify calculated values display: Tax Amount = 110,000, Total = 1,110,000
9. Submit form → success toast, modal closes, bill appears in list with status DRAFT
10. Verify bill can be Posted and Paid like normal bills

### Build Verification

```bash
npm run build
npm run test
```
