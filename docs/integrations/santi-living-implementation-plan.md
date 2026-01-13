# Santi Living Integration - Implementation Plan

**Feature**: Payment Status Tracking for Santi Living Integration  
**Created**: 2026-01-13  
**Target**: Close critical gaps in customer payment flow

---

## Overview

This implementation adds payment status tracking to bridge the gap between customer payment actions on Santi Living and admin verification in Sync ERP.

---

## Phase 1: Schema Changes (sync-erp)

### 1.1 Add PaymentStatus Enum

```prisma
enum PaymentStatus {
  PENDING           // Order created, awaiting payment
  AWAITING_CONFIRM  // Customer claimed payment, awaiting admin verification
  CONFIRMED         // Admin confirmed payment received
  FAILED            // Payment rejected/expired
}
```

### 1.2 Add Fields to RentalOrder

```prisma
model RentalOrder {
  // ... existing fields
  
  // Payment tracking
  paymentStatus      PaymentStatus @default(PENDING)
  paymentClaimedAt   DateTime?     // When customer clicked "I've paid"
  paymentConfirmedAt DateTime?     // When admin verified payment
  paymentReference   String?       // Bank reference / transaction ID
}
```

### 1.3 Migration Strategy

1. Add enum and fields with defaults
2. Run `db:generate` to update Prisma client
3. Run `db:push` for dev or `db:migrate` for production

---

## Phase 2: Backend API (sync-erp)

### 2.1 Update public-rental.router.ts

Add new procedures:

```typescript
// Confirm payment - called when customer clicks "I've paid"
confirmPayment: publicProcedure
  .input(z.object({
    token: z.string().uuid(),
    paymentMethod: z.enum(['qris', 'transfer']),
    reference: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    // Update paymentStatus to AWAITING_CONFIRM
  })

// Get order with payment status
getByToken: // Update existing to include paymentStatus
```

### 2.2 Update getByToken Response

Include new payment fields in the response:

```typescript
return {
  // ... existing fields
  paymentStatus: order.paymentStatus,
  paymentClaimedAt: order.paymentClaimedAt,
  paymentConfirmedAt: order.paymentConfirmedAt,
  paymentReference: order.paymentReference,
};
```

---

## Phase 3: Admin UI (sync-erp web)

### 3.1 Update RentalOrdersPage

- Add filter for `paymentStatus`
- Show payment status badge
- Highlight orders with `AWAITING_CONFIRM` status

### 3.2 Update RentalOrderDetail

- Show payment status section
- Add "Confirm Payment" button for AWAITING_CONFIRM orders
- Show payment claimed timestamp

### 3.3 Add ConfirmPaymentModal

- Display payment details
- Input for payment reference
- Confirm/Reject actions

---

## Phase 4: Integration Service (santi-living)

### 4.1 Update erp-client.ts

Add new function:

```typescript
export async function confirmPayment(
  token: string,
  paymentMethod: 'qris' | 'transfer',
  reference?: string
): Promise<void> {
  return trpcMutate('publicRental.confirmPayment', {
    token,
    paymentMethod,
    reference,
  });
}
```

### 4.2 Update get-order.ts

Include payment status in response.

### 4.3 Add confirm-payment.ts Endpoint

New endpoint for checkout flow:

```typescript
POST /api/orders/:token/confirm-payment
```

---

## Phase 5: Customer UI (santi-living)

### 5.1 Update Checkout Flow

- Call confirmPayment after customer clicks "Saya Sudah Bayar"
- Show confirmation that payment is being verified

### 5.2 Update Order Tracking Page

- Show payment status with appropriate messaging
- Different UI for each payment status

---

## Status Mapping for Customer View

| Order Status | Payment Status | Customer Display |
|--------------|----------------|------------------|
| DRAFT | PENDING | "Menunggu Pembayaran" |
| DRAFT | AWAITING_CONFIRM | "Pembayaran Sedang Diverifikasi" |
| DRAFT | CONFIRMED | "Menunggu Konfirmasi Pesanan" |
| DRAFT | FAILED | "Pembayaran Gagal" |
| CONFIRMED | * | "Pesanan Dikonfirmasi" |
| ACTIVE | * | "Sedang Disewa" |
| COMPLETED | * | "Selesai" |
| CANCELLED | * | "Dibatalkan" |

---

## Testing Checklist

- [ ] Customer can create order (PENDING)
- [ ] Customer can confirm payment (→ AWAITING_CONFIRM)
- [ ] Admin sees order in "Pending Verification" filter
- [ ] Admin can confirm payment (→ CONFIRMED)
- [ ] Admin can reject payment (→ FAILED)
- [ ] Customer sees correct status at each step
- [ ] WA notification sent on status change

---

## Rollback Plan

If issues arise:
1. PaymentStatus field has default (PENDING), safe to add
2. New procedures are additive, don't break existing flow
3. Frontend changes are backward compatible (handle missing fields)
