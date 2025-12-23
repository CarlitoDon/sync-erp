# Quickstart: Cash Upfront Payment

**Feature**: 036-cash-upfront-payment  
**Date**: 2025-12-23

---

## Prerequisites

1. **Account 1600** must exist in Chart of Accounts (add to seed if missing)
2. Branch `036-cash-upfront-payment` checked out
3. Development server running (`npm run dev`)

---

## Implementation Checklist

### Phase 1: Schema & Database

- [ ] Add `PaymentTerms` and `PaymentStatus` enums to Prisma schema
- [ ] Add `paymentTerms`, `paymentStatus`, `paidAmount` to Order model
- [ ] Add `orderId`, `paymentType`, `settledAt`, `settlementBillId` to Payment model
- [ ] Run migration: `npm run db:migrate`
- [ ] Add Account 1600 to seed file
- [ ] Run seed: `npm run db:seed`

### Phase 2: Shared Validators

- [ ] Add `PaymentTermsSchema` to `packages/shared/src/validators/order.validators.ts`
- [ ] Add `PaymentStatusSchema` to `packages/shared/src/validators/order.validators.ts`
- [ ] Add `RegisterUpfrontPaymentSchema` to `packages/shared/src/validators/payment.validators.ts`
- [ ] Add `SettlePrepaidSchema` to `packages/shared/src/validators/payment.validators.ts`
- [ ] Rebuild shared: `cd packages/shared && npm run build`

### Phase 3: Backend - Upfront Payment

- [ ] Add `registerUpfrontPayment()` to `PurchaseOrderService`
- [ ] Add `ensureCanRegisterPayment()` to `PurchaseOrderPolicy`
- [ ] Add `postUpfrontPayment()` to `JournalService`
- [ ] Add `registerUpfrontPayment` procedure to `purchaseOrder.router.ts`
- [ ] Add `getPaymentSummary` procedure to `purchaseOrder.router.ts`

### Phase 4: Backend - Settlement

- [ ] Add `getPrepaidByOrderId()` to `PaymentRepository`
- [ ] Add `getPrepaidInfo()` to `BillService`
- [ ] Add `settlePrepaid()` to `BillService`
- [ ] Add `postSettlement()` to `JournalService`
- [ ] Add `getPrepaidInfo` procedure to `bill.router.ts`
- [ ] Add `settlePrepaid` procedure to `bill.router.ts`

### Phase 5: Frontend - PO Detail

- [ ] Add `PaymentTermsBadge` component
- [ ] Add `PaymentStatusBadge` component
- [ ] Add `UpfrontPaymentCard` component (shows payment summary)
- [ ] Add `RegisterPaymentModal` component
- [ ] Add `PaymentHistoryTable` component
- [ ] Update `PurchaseOrderDetail.tsx` to show upfront UI

### Phase 6: Frontend - Bill Detail

- [ ] Add `PrepaidInfoBanner` component
- [ ] Add `SettlementModal` component
- [ ] Add `SettlementHistoryTable` component
- [ ] Update `BillDetail.tsx` to show prepaid info

### Phase 7: Integration Tests

- [ ] Test: Full Upfront Flow (PO → Pay → GRN → Bill → Settle)
- [ ] Test: Partial Payment Flow
- [ ] Test: Payment validation (amount > remaining)
- [ ] Test: Settlement validation (no prepaid)

### Phase 8: Build & Verify

- [ ] Run `npx tsc --noEmit` (zero errors)
- [ ] Run `npm run lint` (zero errors)
- [ ] Run `npm run test` (all green)
- [ ] Run `npm run build` (success)

---

## Quick Commands

```bash
# Start development
npm run dev

# Run type check
npx tsc --noEmit

# Run tests
npm run test

# Run specific test file
npm run test -- apps/api/test/integration/upfront-payment.test.ts

# Generate Prisma client after schema change
npm run db:generate

# Run migration
npm run db:migrate

# Seed database
npm run db:seed

# Rebuild shared package
cd packages/shared && npm run build
```

---

## Key Files to Create/Modify

### New Files

```
apps/api/src/modules/procurement/purchase-order-upfront.service.ts  (optional, or extend existing)
apps/web/src/features/procurement/components/RegisterPaymentModal.tsx
apps/web/src/features/procurement/components/PaymentHistoryTable.tsx
apps/web/src/features/accounting/components/PrepaidInfoBanner.tsx
apps/web/src/features/accounting/components/SettlementModal.tsx
apps/api/test/integration/upfront-payment.test.ts
```

### Files to Modify

```
packages/database/prisma/schema.prisma
packages/database/prisma/seed.ts
packages/shared/src/validators/order.validators.ts
packages/shared/src/validators/payment.validators.ts
packages/shared/src/validators/index.ts
apps/api/src/trpc/routers/purchaseOrder.router.ts
apps/api/src/trpc/routers/bill.router.ts
apps/api/src/modules/procurement/purchase-order.service.ts
apps/api/src/modules/procurement/purchase-order.policy.ts
apps/api/src/modules/procurement/purchase-order.repository.ts
apps/api/src/modules/accounting/services/bill.service.ts
apps/api/src/modules/accounting/services/journal.service.ts
apps/api/src/modules/accounting/repositories/payment.repository.ts
apps/web/src/features/procurement/pages/PurchaseOrderDetail.tsx
apps/web/src/features/accounting/pages/BillDetail.tsx
```

---

## Testing Flow

### Manual Test Scenario

1. **Create PO with Upfront Term**
   - Go to Purchase Orders
   - Create new PO
   - Select "Cash Upfront" as payment term
   - Post PO
   - Verify: "Register Payment" button visible

2. **Register Upfront Payment**
   - Click "Register Payment"
   - Enter amount (full or partial)
   - Select bank account
   - Post payment
   - Verify: Journal created (Dr 1600, Cr 1200)
   - Verify: PO shows "Paid (Upfront)" badge

3. **Create GRN**
   - Click "Create GRN"
   - Complete GRN form
   - Post GRN
   - Verify: Inventory + GRNI journal created

4. **Create Bill**
   - Navigate to Bills
   - Create bill from GRN
   - Verify: "Prepaid Available" banner shows
   - Post bill
   - Verify: GRNI → AP journal created

5. **Settle Prepaid**
   - Click "Settle Prepaid" on Bill Detail
   - Confirm settlement
   - Verify: AP → Prepaid journal created
   - Verify: Bill balance = 0 (or remaining if partial)
   - Verify: PO shows "Settled" status

---

## Journal Entry Reference

| Step             | Debit                     | Credit                    |
| ---------------- | ------------------------- | ------------------------- |
| Register Payment | 1600 Advances to Supplier | 1200 Bank                 |
| Post GRN         | 1400 Inventory            | 2105 GRNI Accrual         |
| Post Bill        | 2105 GRNI Accrual         | 2100 Accounts Payable     |
| Settle Prepaid   | 2100 Accounts Payable     | 1600 Advances to Supplier |

---

## Troubleshooting

### "Account 1600 not found"

- Add account to seed file and re-run `npm run db:seed`

### "Payment exceeds remaining balance"

- Check `paidAmount` on Order; may need to reset test data

### "No prepaid found for this order"

- Ensure Bill is linked to a PO with upfront payments
- Check `orderId` on Payment records

### Type errors after schema change

- Run `npm run db:generate` to regenerate Prisma client
- Run `cd packages/shared && npm run build` to rebuild types
