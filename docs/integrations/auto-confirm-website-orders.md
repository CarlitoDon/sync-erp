# Auto-Confirm Website Orders on Payment Verification

**Feature**: Auto-confirm order status when payment is verified for website orders  
**Created**: 2026-01-13

---

## Problem Statement

Currently, website orders require **2 admin actions**:
1. Verify payment (AWAITING_CONFIRM → CONFIRMED)
2. Confirm order (DRAFT → CONFIRMED)

This is redundant because:
- Payment verification already validates the order is legitimate
- No additional info needed for confirmation (unlike manual orders that need deposit collection)

## Solution

**Auto-confirm order status when admin verifies payment for website orders.**

### Before (2 steps)
```
Website Order → DRAFT (paymentStatus=PENDING)
    ↓ Customer clicks "Saya Sudah Bayar"
paymentStatus=AWAITING_CONFIRM, status=DRAFT
    ↓ Admin verifies payment ✅
paymentStatus=CONFIRMED, status=DRAFT ← still draft!
    ↓ Admin confirms order ✅
status=CONFIRMED ← now confirmed
```

### After (1 step)
```
Website Order → DRAFT (paymentStatus=PENDING)
    ↓ Customer clicks "Saya Sudah Bayar"
paymentStatus=AWAITING_CONFIRM, status=DRAFT
    ↓ Admin verifies payment ✅
paymentStatus=CONFIRMED, status=CONFIRMED ← auto-confirmed!
```

## Scope

### In Scope
- Modify `verifyPayment` service method to auto-set `status=CONFIRMED` when:
  - `action === 'confirm'`
  - `orderSource === 'WEBSITE'`
  - Current `status === 'DRAFT'`

### Out of Scope
- Manual orders (still need explicit confirm with deposit)
- Rejected payments (status stays DRAFT)
- Orders already confirmed

## Implementation

### Files to Modify
1. `apps/api/src/modules/rental/rental.service.ts` - `verifyPayment()` method

### Logic Change
```typescript
// In verifyPayment method
if (action === 'confirm') {
  updateData = {
    rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
    paymentConfirmedAt: new Date(),
    paymentConfirmedBy: userId,
    paymentReference: paymentReference || undefined,
    // Auto-confirm website orders
    ...(order.orderSource === OrderSource.WEBSITE && order.status === RentalOrderStatus.DRAFT
      ? { status: RentalOrderStatus.CONFIRMED, confirmedAt: new Date() }
      : {}),
  };
}
```

## Testing

1. Create website order → status=DRAFT
2. Click "Saya Sudah Bayar" → paymentStatus=AWAITING_CONFIRM
3. Admin verifies payment → status should be CONFIRMED automatically
4. Manual order should still require separate confirm action
