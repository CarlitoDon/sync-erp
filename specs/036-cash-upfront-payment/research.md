# Research: Cash Upfront Payment

**Feature**: 036-cash-upfront-payment  
**Date**: 2025-12-23  
**Status**: Complete

---

## Research Items

### 1. Upfront Payment Account Code

**Decision**: Use Account **1600 - Advances to Supplier**

**Rationale**:

- Standard accounting practice separates prepaid from Accounts Payable
- Prepaid is an ASSET until goods are received and bill is posted
- Keeps AP aging accurate (shows actual outstanding liabilities)
- Enables clear audit trail from payment → PO → GRN → Bill → Settlement

**Alternatives Considered**:
| Option | Rejected Because |
|--------|------------------|
| Direct debit to Inventory | Violates GAAP - goods not yet received |
| Debit AP directly | Incorrect - no liability exists yet |
| Use generic Prepaid Expense | Less specific; harder to reconcile per-supplier |

---

### 2. Payment-to-PO Linking Strategy

**Decision**: Add `orderId` field directly to Payment model

**Rationale**:

- Simple FK relationship (Payment → Order)
- Allows Payment to be linked to either Invoice OR Order (but not both)
- Query efficiency: `payment.orderId` is indexed, fast lookup
- Matches existing pattern where Payment already has `invoiceId`

**Alternatives Considered**:
| Option | Rejected Because |
|--------|------------------|
| Polymorphic reference (`referenceType` + `referenceId`) | More complex queries, losing type safety |
| Separate UpfrontPayment model | Over-engineering, duplicates Payment logic |
| Link via metadata JSON field | Not queryable, not type-safe |

**Implementation**:

```prisma
model Payment {
  id          String   @id @default(uuid())
  companyId   String
  invoiceId   String?  // For invoice payments
  orderId     String?  // NEW: For upfront payments
  paymentType String?  // 'UPFRONT' | 'INVOICE'
  amount      Decimal
  method      String
  // ...
}
```

---

### 3. Settlement Trigger Strategy

**Decision**: **Manual button** on Bill Detail page (auto-settle as future enhancement)

**Rationale**:

- Gives user explicit control over when clearing happens
- Prevents accidental settlements on incorrect bills
- Allows review of settlement amounts before posting
- Simpler to implement and test for MVP
- Aligns with Apple principle: "Do one thing well"

**Alternatives Considered**:
| Option | Rejected Because |
|--------|------------------|
| Auto-settle on Bill post | User loses visibility; might not want immediate clearing |
| Background job / scheduler | Over-engineering for MVP; adds failure modes |
| Hybrid (configurable) | Complexity not justified for initial release |

**Future Enhancement**: Add company setting `autoSettleUpfront: boolean` to enable automatic settlement on bill posting.

---

### 4. Partial Payment Strategy

**Decision**: Support multiple upfront payments until PO is fully paid

**Rationale**:

- Real-world suppliers sometimes require installments (e.g., 30-70 split)
- Maintains flexibility without adding complexity
- Uses simple calculation: `remainingBalance = totalAmount - paidAmount`
- PO status transitions: `PENDING` → `PARTIAL` → `PAID_UPFRONT`

**Implementation Notes**:

- Track `paidAmount` on Order (sum of all upfront payments)
- UI disables "Register Payment" only when `paidAmount >= totalAmount`
- Each payment creates separate journal entry

---

### 5. Bank Account Selection

**Decision**: Use existing Account dropdown (filter by type = CASH/BANK)

**Rationale**:

- Reuses existing UI component from Bill payment flow
- Accounts already seeded (1100 Cash, 1200 Bank)
- No new infrastructure needed

**Query Filter**:

```typescript
const bankAccounts = await accountRepository.findAll(companyId, {
  code: { startsWith: '1' }, // Asset accounts
  type: { in: ['CASH', 'BANK'] },
});
```

---

### 6. PO State After Payment

**Decision**: Introduce `paymentStatus` field (separate from `status`)

**Rationale**:

- `status` tracks operational state (DRAFT → POSTED → RECEIVED)
- `paymentStatus` tracks financial state (PENDING → PAID_UPFRONT → SETTLED)
- Separation allows GRN before or after payment
- Cleaner queries: filter by operational OR financial state independently

**State Machine**:

```
paymentStatus:
  null/PENDING → (register payment) → PARTIAL or PAID_UPFRONT
  PAID_UPFRONT → (bill settled) → SETTLED
```

---

## Resolved NEEDS CLARIFICATION

All unknowns from the spec have been resolved:

| Item                         | Resolution                     |
| ---------------------------- | ------------------------------ |
| Which account for prepaid?   | 1600 Advances to Supplier      |
| How to link payment to PO?   | Add `orderId` to Payment model |
| When does settlement happen? | Manual button on Bill Detail   |
| Support partial upfront?     | Yes, tracked via `paidAmount`  |

---

## Dependencies Verified

| Dependency               | Status    | Notes                                               |
| ------------------------ | --------- | --------------------------------------------------- |
| Account 1600 in seed     | ❌ NEEDED | Must add to `packages/database/prisma/seed.ts`      |
| Payment model extensible | ✅ OK     | Can add `orderId` and `paymentType`                 |
| JournalService methods   | ✅ OK     | Existing patterns for new journal types             |
| tRPC router extensible   | ✅ OK     | Can add new procedures to `purchaseOrder.router.ts` |

---

## Best Practices Applied

1. **Accounting Correctness**: Prepaid is always an asset until cleared
2. **Idempotency**: Use existing `IdempotencyService` for payment creation
3. **Atomic Transactions**: All journal + status updates in single `$transaction`
4. **Audit Trail**: Payment linked to PO, settlement linked to Bill
5. **User Control**: Explicit settlement action instead of magic auto-clearing
