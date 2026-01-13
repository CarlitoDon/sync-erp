# Santi Living Integration - Tasks

**Feature**: Payment Status Tracking  
**Created**: 2026-01-13  
**Last Updated**: 2026-01-13

---

## Sprint 1: Core Implementation

### Task 1.1: Schema Changes [sync-erp] ⏱️ 15min ✅
- [x] Add `RentalPaymentStatus` enum to schema.prisma
- [x] Add payment fields to `RentalOrder` model
- [x] Run `npm run db:generate`
- [x] Run `npm run db:push`

**Files:**
- `packages/database/prisma/schema.prisma`

---

### Task 1.2: Update public-rental.router.ts [sync-erp] ⏱️ 30min ✅
- [x] Add `confirmPayment` mutation
- [x] Update `getByToken` to include payment fields
- [x] Add validation for payment status transitions

**Files:**
- `apps/api/src/trpc/routers/public-rental.router.ts`

---

### Task 1.3: Update Shared Types [sync-erp] ⏱️ 10min ✅
- [x] Export `RentalPaymentStatus` enum from shared package
- [x] Export `RentalPaymentStatusSchema` from validators/rental.ts

**Files:**
- `packages/shared/src/validators/rental.ts`
- `packages/database/src/index.ts`

---

### Task 1.4: Update erp-client.ts [santi-living] ⏱️ 15min ✅
- [x] Add `confirmPayment` function
- [x] Update `OrderByTokenResponse` interface with payment fields
- [x] Add `RentalPaymentStatus` and `OrderStatus` const enums (no hardcoded strings)

**Files:**
- `apps/erp-sync-service/src/services/erp-client.ts`

---

### Task 1.5: Add confirm-payment endpoint [santi-living] ⏱️ 20min ✅
- [x] Create `apps/erp-sync-service/src/api/confirm-payment.ts`
- [x] Register route in server.ts
- [x] Add request validation with Zod

**Files:**
- `apps/erp-sync-service/src/api/confirm-payment.ts`
- `apps/erp-sync-service/src/server.ts`

---

### Task 1.6: Update Thank You Page [santi-living] ⏱️ 20min ✅
- [x] Create thank you page for payment confirmation (`/pesanan/[token]/terima-kasih`)
- [x] Update JS handler to redirect after confirmPayment
- [x] Show next steps (admin verification, WhatsApp follow-up)

**Files:**
- `src/pages/sewa-kasur/pesanan/[token]/terima-kasih.astro` (NEW)
- `src/pages/sewa-kasur/pesanan/[token].astro`

---

### Task 1.7: Update Order Tracking Page [santi-living] ⏱️ 30min ✅
- [x] Add payment status to order type
- [x] Update status display logic
- [x] Show different messages per payment status
- [x] Update progress steps component
- [x] Add "Saya Sudah Bayar" button with JS handler

**Files:**
- `src/pages/sewa-kasur/pesanan/[token].astro`
- `apps/erp-sync-service/src/api/get-order.ts`
- `apps/erp-sync-service/src/types/order.ts`

---

## Sprint 2: Admin UI

### Task 2.1: Update RentalOrdersPage [sync-erp] ⏱️ 30min ✅
- [x] Add payment status filter
- [x] Add payment status badge to order list
- [x] Highlight AWAITING_CONFIRM orders with alert banner
- [x] Add "Verifikasi" button for orders awaiting confirmation

**Files:**
- `apps/web/src/features/rental/pages/RentalOrdersPage.tsx`
- `apps/web/src/features/rental/constants/rental.constants.ts`

---

### Task 2.2: Update RentalOrderDetail [sync-erp] ⏱️ 30min ✅
- [x] Add payment status card in sidebar
- [x] Show payment claimed/confirmed timestamps
- [x] Show payment reference and fail reason
- [x] Add "Verifikasi Pembayaran" button for AWAITING_CONFIRM

**Files:**
- `apps/web/src/features/rental/pages/RentalOrderDetail.tsx`

---

### Task 2.3: Create VerifyPaymentModal [sync-erp] ⏱️ 45min ✅
- [x] Create modal component with order summary
- [x] Add confirm/reject action selection
- [x] Input for payment reference (confirm) or fail reason (reject)
- [x] Call rental.orders.verifyPayment mutation

**Files:**
- `apps/web/src/features/rental/modals/VerifyPaymentModal.tsx` (NEW)

---

### Task 2.4: Add verifyPayment Procedure [sync-erp] ⏱️ 20min ✅
- [x] Add `rental.orders.verifyPayment` mutation to router
- [x] Add `verifyPayment` method to rental.service.ts
- [x] Validate payment status transition (only AWAITING_CONFIRM → CONFIRMED/FAILED)
- [x] Record audit log

**Files:**
- `apps/api/src/trpc/routers/rental.router.ts`
- `apps/api/src/modules/rental/rental.service.ts`

---

### Task 2.5: Auto-confirm Website Orders [sync-erp] ⏱️ 15min ✅
- [x] Update `verifyPayment` to auto-set `status = CONFIRMED` when payment confirmed for WEBSITE orders
- [x] Reduce admin workflow from 2 actions (verify payment → confirm order) to 1 action

**Rationale:** Website orders are already pre-validated (customer filled form + submitted payment), so confirming payment = confirming order.

**Files:**
- `apps/api/src/modules/rental/rental.service.ts`
- `docs/integrations/auto-confirm-website-orders.md` (NEW - implementation plan)

---

## Sprint 3: Notifications

### Task 3.1: Customer Payment Notifications [santi-living] ⏱️ 30min ✅
- [x] Add `notifyPaymentConfirmed` function to `wa-notifier.ts`
- [x] Add `notifyPaymentRejected` function to `wa-notifier.ts`
- [x] Create `notify-payment-status.ts` endpoint in erp-sync-service
- [x] Register route in server.ts

**Trigger**: Admin confirms/rejects payment in sync-erp → notify customer via WA

**Files:**
- `apps/erp-sync-service/src/services/wa-notifier.ts`
- `apps/erp-sync-service/src/api/notify-payment-status.ts` (NEW)
- `apps/erp-sync-service/src/server.ts`

---

### Task 3.2: Admin Notification Functions [santi-living] ⏱️ 15min ✅
- [x] Add `notifyAdminNewOrder` function to `wa-notifier.ts`
- [x] Add `notifyAdminPaymentClaimed` function to `wa-notifier.ts`
- [x] Support via notify-payment-status endpoint with action="claimed"

**Trigger**: Customer claims payment → notify admin via WA (requires ADMIN_WHATSAPP env)

**Files:**
- `apps/erp-sync-service/src/services/wa-notifier.ts`

---

### Task 3.3: Webhook Trigger from sync-erp [sync-erp] ⏱️ 30min ✅
- [x] Create `RentalWebhookService` to call santi-living notifications
- [x] Add webhook call in `rental.service.ts` after verifyPayment
- [x] Handle webhook failures gracefully (log but don't block)
- [x] Register service in DI container

**Files:**
- `apps/api/src/modules/rental/rental-webhook.service.ts` (NEW)
- `apps/api/src/modules/rental/rental.service.ts`
- `apps/api/src/modules/common/di/register.ts`

---

### Task 3.4: Admin Notification - New Order [sync-erp] ⏱️ 20min ✅
- [x] Add `notifyNewOrder` method to `RentalWebhookService`
- [x] Create `notify-admin.ts` endpoint in santi-living erp-sync-service
- [x] Trigger webhook from `publicRental.createOrder`
- [x] Include partner relation in order query for customer details

**Trigger**: Website order created → notify admin via WA

**Files:**
- `apps/api/src/modules/rental/rental-webhook.service.ts`
- `apps/api/src/trpc/routers/public-rental.router.ts`
- (santi-living) `apps/erp-sync-service/src/api/notify-admin.ts` (NEW)
- (santi-living) `apps/erp-sync-service/src/server.ts`

---

### Task 3.5: Admin Notification - Payment Awaiting [sync-erp] ⏱️ 15min ✅
- [x] Use existing `notifyPaymentStatus` with action="claimed"
- [x] Trigger webhook from `publicRental.confirmPayment`

**Trigger**: Customer claims payment → notify admin via WA

**Files:**
- `apps/api/src/trpc/routers/public-rental.router.ts`

---

## Progress Tracker

| Task | Status | Notes |
|------|--------|-------|
| 1.1 Schema Changes | ✅ Done | Added RentalPaymentStatus enum + 7 payment fields |
| 1.2 public-rental.router | ✅ Done | Added confirmPayment mutation, updated getByToken |
| 1.3 Shared Types | ✅ Done | Exported RentalPaymentStatus from validators/rental.ts |
| 1.4 erp-client.ts | ✅ Done | Added confirmPayment + const enums |
| 1.5 confirm-payment endpoint | ✅ Done | POST /api/orders/:token/confirm-payment |
| 1.6 Thank You Page | ✅ Done | Created /pesanan/[token]/terima-kasih + redirect |
| 1.7 Order Tracking Page | ✅ Done | Payment status UI + confirm button + JS handler |
| 2.1 RentalOrdersPage | ✅ Done | Filter, badge, alert banner, verify button |
| 2.2 RentalOrderDetail | ✅ Done | Payment status card + verify button |
| 2.3 VerifyPaymentModal | ✅ Done | Confirm/reject with reference/reason |
| 2.4 verifyPayment Procedure | ✅ Done | Router + service method + audit log |
| 2.5 Auto-confirm Website | ✅ Done | Auto-set status=CONFIRMED when payment verified |
| 3.1 Customer Payment Notifications | ✅ Done | notifyPaymentConfirmed + notifyPaymentRejected |
| 3.2 Admin Notification Functions | ✅ Done | notifyAdminNewOrder + notifyAdminPaymentClaimed |
| 3.3 Webhook Trigger | ✅ Done | RentalWebhookService + DI integration |
| 3.4 Admin New Order Notification | ✅ Done | Webhook from publicRental.createOrder |
| 3.5 Admin Payment Awaiting | ✅ Done | Webhook from publicRental.confirmPayment |

**Sprint 1 Progress: 7/7 tasks done (100%)** ✅
**Sprint 2 Progress: 5/5 tasks done (100%)** ✅
**Sprint 3 Progress: 5/5 tasks done (100%)** ✅

🎉 **ALL SPRINTS COMPLETE!**

---

## Dependencies

```
Task 1.1 (Schema) ✅
    ↓
Task 1.2 (public-rental.router) ✅ ──→ Task 1.3 (Shared Types) ✅
    ↓
Task 1.4 (erp-client) ✅
    ↓
Task 1.5 (confirm-payment endpoint) ✅
    ↓
Task 1.6 (Thank You Page) ✅ ←─ parallel ─→ Task 1.7 (Tracking Page) ✅
    ↓
Task 2.1-2.4 (Admin UI) ✅
```

Sprint 2 tasks depend on Sprint 1 completion.
