# Implementation Plan: Cash Upfront Payment (Procurement)

**Branch**: `036-cash-upfront-payment` | **Date**: 2025-12-23 | **Spec**: [spec.md](./spec.md)  
**Version**: 2.0 - Canonical Flow

## Summary

Implement Cash Upfront Payment for Procurement flow (P2P). This feature enables payment recording before goods receipt, using proper accounting treatment with Advances to Supplier accounts.

### Canonical Flow

```
PO (UPFRONT) → Pay Upfront → GRN → Bill → Auto Settlement → DONE
```

### Key Insight

> **GRN dan Bill journals SAMA dengan normal flow. Hanya Settlement yang berbeda (auto vs manual).**

### Deliverables

1. **Schema Changes**: Add `paymentTerms` and `paymentStatus` to Order model ✅
2. **Payment Flow**: Register upfront payment (Dr 1600, Cr Cash) ✅
3. **GRN Flow**: Standard journal (Dr 1400, Cr 2105) - no changes needed
4. **Bill Flow**: Standard journal (Dr 2105, Cr 2100) - needs auto-settlement trigger
5. **Auto Settlement**: Dr 2100 Cr 1600 after Bill posted
6. **UI**: Payment modal on PO Detail ✅, Settlement info on Bill Detail

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+  
**Primary Dependencies**: Express, tRPC v11, Prisma ORM, Zod, Decimal.js, React, React Query  
**Storage**: PostgreSQL (via Prisma)  
**Testing**: Integration Tests (MANDATORY), Vitest

---

## Journal Entry Templates (FINAL)

| Step | Event           | Debit             | Credit            | Amount             |
| ---- | --------------- | ----------------- | ----------------- | ------------------ |
| 3    | Pay Upfront     | 1600 Advances     | 1100/1200 Cash    | Payment amount     |
| 4    | GRN Posted      | 1400 Inventory    | 2105 GRN Clearing | GRN value          |
| 5    | Bill Posted     | 2105 GRN Clearing | 2100 AP Trade     | Bill amount        |
| 6    | Auto Settlement | 2100 AP Trade     | 1600 Advances     | min(prepaid, bill) |

### Final Balance Check

After full flow completion:

- 1100/1200 Bank = **-X** (paid out)
- 1400 Inventory = **+X** (goods in)
- 1600 Advances = **0** (cleared)
- 2100 AP Trade = **0** (settled)
- 2105 GRN Clearing = **0** (cleared by bill)

---

## Implementation Status

### Phase 1: Schema & Seed ✅ DONE

- PaymentTerms enum
- PaymentStatus enum
- Order fields (paymentTerms, paymentStatus, paidAmount)
- Payment fields (orderId, paymentType, settledAt)
- Account 1600 seeded

### Phase 2: Foundational Validators ✅ DONE

- All Zod schemas created
- Exports configured

### Phase 3: User Story 1 - Create PO ✅ DONE

- PO with paymentTerms
- PaymentTermsBadge, PaymentStatusBadge

### Phase 4: User Story 2 - Register Payment ✅ DONE

- UpfrontPaymentService
- UpfrontPaymentRepository
- tRPC router
- RegisterPaymentModal, UpfrontPaymentCard, PaymentHistoryTable
- Integration tests

### Phase 5: User Story 3 - GRN 🔄 NEEDS REVIEW

- Current: GRN creates Dr 1400 Cr 2105 ✅ (already correct!)
- No changes needed for journal

### Phase 6: User Story 4 - Bill + Auto Settlement 🔴 NEEDS UPDATE

- **Current (wrong)**: Manual settlement button
- **Target**: AUTO settlement after Bill posted

### Required Changes for Phase 6

1. **BillService.post()**: Add trigger to call `autoSettlePrepaid()` after Bill journal posted
2. **autoSettlePrepaid()**: Check if linked PO has prepaid, if yes, create settlement journal
3. **Journal**: Dr 2100 Cr 1600
4. **Update statuses**: Bill = PAID, Payment = CLEARED

---

## Code Changes Required

### Files to Update

1. `apps/api/src/modules/accounting/services/bill.service.ts`
   - Add `autoSettlePrepaid()` call in `post()` method
2. `apps/api/src/modules/procurement/upfront-payment.service.ts`
   - Rename `settlePrepaid()` to `autoSettlePrepaid()`
   - Make it internal (not exposed to router)
3. `apps/api/src/trpc/routers/upfrontPayment.router.ts`
   - Remove manual `settlePrepaid` mutation (now auto)

### Files Unchanged

- `inventory.service.ts` - GRN journal already correct (Dr 1400 Cr 2105)
- Frontend components - mostly complete

---

## Test Scenarios

### E2E Test: Full P2P Upfront Flow

```typescript
it('Complete P2P flow: PO → Pay → GRN → Bill → Auto Settle', async () => {
  // 1. Create PO with UPFRONT terms
  // 2. Confirm PO
  // 3. Register upfront payment → verify Dr 1600 Cr Bank
  // 4. Create & post GRN → verify Dr 1400 Cr 2105
  // 5. Create & post Bill → verify Dr 2105 Cr 2100 + Dr 2100 Cr 1600
  // 6. Verify final balances: Advances=0, AP=0, Inventory=+X
});
```

---

## Next Steps

1. Update BillService to trigger auto-settlement
2. Remove manual settlement router
3. Update E2E test with correct flow
4. Verify all account balances
