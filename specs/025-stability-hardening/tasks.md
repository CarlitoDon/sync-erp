# Phase 0.5 Tasks: Stability Hardening

## 1. Idempotency (Week 1)

- [x] **T013: Implement Idempotency Infrastructure** <!-- id: 13 -->
  - Created `IdempotencyKey` model.
  - Implemented `IdempotencyService` locked/get/complete/fail.
  - Verified with Unit Test `t013_idempotency.test.ts`.
- [x] **T014: Apply Idempotency to Invoicing** <!-- id: 14 -->
  - Updated `InvoiceService.post` to accept key.
  - Guard against double posting.
  - Verified with Unit Test `t014_invoice_idempotency.test.ts`.
- [x] **T015: Apply Idempotency to Payment** <!-- id: 15 -->
  - Updated `PaymentService.create` to accept key.
  - Guard against double payment.
  - Verified with Unit Test `t015_payment_idempotency.test.ts`.

## 2. Reversals (Week 2)

- [x] **T016: Implement Credit Note (Reversal of Invoice)** <!-- id: 16 -->
  - Added `CREDIT_NOTE` type to Invoice.
  - Implemented `InvoiceService.createCreditNote` & `JournalService.postCreditNote`.
  - Verified with `t016_credit_note.test.ts`.gic.
  - Ensure Journal impact is reversed (Contra-revenue).
- [x] **T017: Implement Stock Return (Reversal of Shipment)** <!-- id: 17 -->
  - Added `OrderItem.cost` for accurate COGS reversal.
  - Updated `InventoryService.processReturn` to use cost snapshot.
  - Verified with `t017_stock_return.test.ts`.
- [x] **T018: Implement Journal Reversal** <!-- id: 18 -->
  - Implemented `JournalService.reverse`.
  - Updated `JournalRepository` types for inference.
  - Verified with `t018_journal_reversal.test.ts`.

## 3. Concurrency (Week 3)

- [x] **T019: Implement Inventory Concurrency Guard** <!-- id: 19 -->
  - Implemented `ProductRepository.decreaseStockWithGuard` (Atomic Decrement).
  - Updated `InventoryService.processShipment` with Manual Rollback logic.
  - Verified with `t019_inventory_guard.test.ts`.ion.
  - Test race conditions (e.g. 2 orders vs 1 stock).
- [x] **T020: Implement Payment Concurrency Guard** <!-- id: 20 -->
  - Implemented `InvoiceRepository.decreaseBalanceWithGuard` (Atomic Decrement).
  - Updated `PaymentService.create` to use guard.
  - Verified with `t020_payment_guard.test.ts`.
  - Prevent overpayment via race condition.
