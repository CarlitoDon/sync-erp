# Tasks: Cash Upfront Payment (Procurement)

**Input**: Design documents from `/specs/036-cash-upfront-payment/`  
**Version**: 2.0 - Canonical Flow

**Tests**: Integration tests are MANDATORY for all business flows.

## Canonical Flow

```
PO (UPFRONT) → Pay Upfront → GRN → Bill → Auto Settlement → DONE
```

## Key Insight

> **GRN dan Bill journals SAMA dengan normal flow. Hanya Settlement yang AUTO setelah Bill posted.**

---

## Phase 1: Setup (Schema & Seed) ✅ DONE

- [x] T001 Add `PaymentTerms` enum to schema.prisma
- [x] T002 Add `PaymentStatus` enum to schema.prisma
- [x] T003 Add `paymentTerms`, `paymentStatus`, `paidAmount` to Order model
- [x] T004 Add `orderId`, `paymentType`, `settledAt` to Payment model
- [x] T005 Add relations to Order and Payment models
- [x] T006 Run Prisma migration
- [x] T007 Add Account 1600 (Advances to Supplier) to seed
- [x] T008 Run seed

**Checkpoint**: Database ready ✅

---

## Phase 2: Foundational (Shared Validators) ✅ DONE

- [x] T009-T017 All Zod schemas created and exported

**Checkpoint**: Validators ready ✅

---

## Phase 3: User Story 1 - Create PO with Upfront Terms ✅ DONE

- [x] T018-T025 PO with paymentTerms, badges, form, tests

**Checkpoint**: PO creation complete ✅

---

## Phase 4: User Story 2 - Register Upfront Payment ✅ DONE

### Backend ✅

- [x] T026 ensureCanRegisterPayment policy
- [x] T027 ensurePaymentWithinLimit policy
- [x] T028 postUpfrontPayment journal (Dr 1600 Cr Bank)
- [x] T029-T030 Repository methods
- [x] T031-T036 Service & Router

### Frontend ✅

- [x] T037-T041 RegisterPaymentModal, UpfrontPaymentCard, PaymentHistoryTable
- [x] T042 Integration test

**Checkpoint**: Payment registration complete ✅

---

## Phase 5: User Story 3 - GRN (No Changes Needed) ✅ VERIFIED

**Goal**: Verify GRN works with standard journal (Dr 1400 Cr 2105)

- [x] T043 Verify GRN journal is Dr 1400 Cr 2105 (already correct, no changes)
- [x] T044 Integration test: GRN for PAID_UPFRONT PO creates standard journal

**Note**: GRN flow sama dengan normal - tidak perlu modifikasi

**Checkpoint**: GRN verified ✅

---

## Phase 6: User Story 4 - Bill + Auto Settlement ✅ DONE

**Goal**: Bill posts with standard journal, then AUTO triggers settlement

### Backend Implementation ✅

- [x] T045 postSettlePrepaid() method already exists in journal.service.ts
- [x] T046 Auto-settlement logic added to BillService.post()
- [x] T047 Settlement triggers after Bill journal posted
- [x] T048 Payment status updated to CLEARED
- [x] T049 Bill status updated to PAID when fully settled
- [x] T050 Manual settlePrepaid kept for edge cases

### Testing ✅

- [x] T053 E2E test: Bill posted → auto settlement → journal verified
- [x] T054 Final statuses verified (Bill=PAID, Payment=CLEARED, Order=SETTLED)

**Checkpoint**: Auto settlement complete

---

## Phase 7: User Story 5 - Full E2E Test

**Goal**: Verify complete flow with all balances correct

### Testing

- [x] T055 [US5] E2E test: Full flow (PO → Pay → GRN → Bill → Auto Settle)
- [x] T056 [US5] Verify: Bank=-X, Inventory=+X, Advances=0, AP=0, GRN Clearing=0
- [x] T057 [US5] Test partial upfront scenario (prepaid < bill amount)
- [x] T058 [US5] Test partial payment scenario (multiple payments)

**Checkpoint**: Full flow verified ✅

---

## Phase 8: Polish & Edge Cases

- [x] T059 Partial upfront: System allows remaining AP for normal payment
- [ ] T060 SERVICE items: Bill without GRN (deferred: out of scope for now)
- [x] T061 Update documentation with final flow
- [x] T062 UI Consistency: Rename "Register Payment" to "Record Payment" on PO Upfront

**Checkpoint**: Feature complete ✅

---

## Summary

| Phase                      | Tasks  | Status   |
| -------------------------- | ------ | -------- |
| Phase 1: Setup             | 8      | ✅ Done  |
| Phase 2: Validators        | 9      | ✅ Done  |
| Phase 3: PO Creation       | 8      | ✅ Done  |
| Phase 4: Payment           | 17     | ✅ Done  |
| Phase 5: GRN               | 2      | ✅ Done  |
| Phase 6: Bill + Settlement | 10     | ✅ Done  |
| Phase 7: E2E Test          | 4      | ✅ Done  |
| Phase 8: Polish            | 3      | ✅ Done  |
| **Total**                  | **61** | **100%** |

---

## What Needs to Change

### Current Implementation (Wrong)

1. ❌ E2E test uses manual settlement
2. ❌ GRN was trying to Cr 1600 (should be 2105)
3. ❌ Bill was skipping journal for upfront PO

### Corrected Implementation

1. ✅ GRN: Standard journal Dr 1400 Cr 2105
2. ✅ Bill: Standard journal Dr 2105 Cr 2100
3. ✅ Auto Settlement: Triggered after Bill posted (Dr 2100 Cr 1600)
4. ✅ Final balances all correct
