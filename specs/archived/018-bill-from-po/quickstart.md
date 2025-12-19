# Quickstart: Create Bill from Purchase Order

## Development Setup

```bash
# 1. Checkout feature branch
git checkout 018-bill-from-po

# 2. Install dependencies (if needed)
npm install

# 3. Start dev servers
npm run dev
# API runs on :3001, Web runs on :5173

# 4. (Optional) Start TypeScript watch
npm run typecheck:watch
```

## Key Files to Modify

| File                                                             | Change                      |
| ---------------------------------------------------------------- | --------------------------- |
| `apps/web/src/features/procurement/pages/PurchaseOrders.tsx`     | Add Create Bill button      |
| `apps/web/src/features/finance/services/billService.ts`          | Add `createFromPO()` method |
| `apps/web/src/features/finance/pages/AccountsPayable.tsx`        | Show PO reference in table  |
| `apps/api/src/modules/accounting/controllers/bill.controller.ts` | Add `getByOrderId`          |
| `apps/api/src/routes/bill.ts`                                    | Add route                   |

## Existing Code Reference

### Backend (already works)

```typescript
// apps/api/src/modules/accounting/controllers/bill.controller.ts
// Lines 41-47 - PO-based creation already implemented
const validated = CreateBillSchema.parse(req.body);
const bill = await this.service.createFromPurchaseOrder(companyId, {
  orderId: validated.orderId!,
  dueDate: validated.dueDate,
});
```

### Frontend Service Pattern

```typescript
// Use existing pattern from billService.ts
async createFromPO(orderId: string): Promise<Bill> {
  const res = await api.post('/bills', { orderId });
  return res.data?.data ?? res.data;
}
```

### UI Pattern for Action Button

```tsx
// Use existing pattern from PurchaseOrders.tsx
{
  order.status === 'COMPLETED' && (
    <ActionButton
      onClick={() => handleCreateBill(order.id)}
      variant="primary"
    >
      Create Bill
    </ActionButton>
  );
}
```

## Verification Commands

```bash
# TypeScript check
npx tsc --noEmit

# Full build
npm run build

# Run bill tests
cd apps/api && npx vitest run test/unit/routes/bill.test.ts
cd apps/api && npx vitest run test/unit/services/BillService.test.ts
```

## Manual Test Checklist

1. [ ] COMPLETED PO shows "Create Bill" button
2. [ ] DRAFT/CONFIRMED PO does NOT show button
3. [ ] Clicking button creates bill and shows success toast
4. [ ] New bill appears in Accounts Payable with correct amount
5. [ ] Second click on same PO shows duplicate warning
6. [ ] Bill table shows source PO number
