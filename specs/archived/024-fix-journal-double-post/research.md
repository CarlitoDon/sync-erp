# Research: Prevent Journal Double-Posting

**Feature**: 024-fix-journal-double-post  
**Date**: 2025-12-16

---

## 1. Current Implementation Analysis

### JournalEntry Schema (Current)

```prisma
model JournalEntry {
  id        String   @id @default(uuid())
  companyId String
  reference String?  // Not unique, just display text
  date      DateTime
  memo      String?
  createdAt DateTime @default(now())
  // Missing: sourceType, sourceId
}
```

**Problem**: No link to source document. `reference` is just text like "Invoice: INV-001".

### Journal Creation Paths

| Path              | Method                                 | Source Document     |
| ----------------- | -------------------------------------- | ------------------- |
| Invoice Posting   | `JournalService.postInvoice()`         | Invoice             |
| Bill Posting      | `JournalService.postBill()`            | Bill                |
| Payment Recording | `JournalService.postPaymentReceived()` | Payment             |
| Credit Note       | `JournalService.postCreditNote()`      | Invoice (reversal)  |
| Payment Made      | `JournalService.postPaymentMade()`     | Payment (for bills) |

---

## 2. Design Decision: Source Type Enum

| Option | Approach             | Pros                  | Cons            |
| ------ | -------------------- | --------------------- | --------------- |
| A      | String field         | Flexible              | No type safety  |
| B      | Enum                 | Type safe, documented | Less flexible   |
| C      | Polymorphic relation | Prisma support        | Complex queries |

**Decision**: **Option B** — Use enum `JournalSourceType`

**Rationale**:

- Fixed set of source types in ERP: INVOICE, BILL, PAYMENT, CREDIT_NOTE, ADJUSTMENT
- Enum provides validation and documentation
- Easy to extend by adding enum values

---

## 3. Design Decision: Unique Constraint Behavior

### PostgreSQL Unique Constraint with NULLs

PostgreSQL treats each `NULL` as distinct in unique constraints. This means:

```sql
-- These are all allowed with @@unique([companyId, sourceType, sourceId]):
(company1, INVOICE, inv-001)  -- ✓ Unique
(company1, INVOICE, inv-001)  -- ✗ Blocked (duplicate)
(company1, NULL, NULL)        -- ✓ Allowed (manual entry)
(company1, NULL, NULL)        -- ✓ Allowed (another manual entry)
```

**Decision**: This behavior is CORRECT for our use case:

- Automated journals (with source) → unique, no duplicates
- Manual journals (no source) → allowed multiple times

---

## 4. Schema Changes Required

```prisma
enum JournalSourceType {
  INVOICE
  BILL
  PAYMENT
  CREDIT_NOTE
  ADJUSTMENT
}

model JournalEntry {
  id         String            @id @default(uuid())
  companyId  String
  reference  String?
  date       DateTime
  memo       String?
  sourceType JournalSourceType?  // NEW
  sourceId   String?             // NEW
  createdAt  DateTime          @default(now())

  company Company       @relation(...)
  lines   JournalLine[]

  @@index([companyId])
  @@unique([companyId, sourceType, sourceId])  // NEW
}
```

---

## 5. Service Changes Required

### JournalService Methods

| Method                  | Add sourceType | Add sourceId                |
| ----------------------- | -------------- | --------------------------- |
| `postInvoice()`         | INVOICE        | invoiceId (need to pass)    |
| `postBill()`            | BILL           | billId (need to pass)       |
| `postPaymentReceived()` | PAYMENT        | paymentId (need to pass)    |
| `postPaymentMade()`     | PAYMENT        | paymentId (need to pass)    |
| `postCreditNote()`      | CREDIT_NOTE    | creditNoteId (need to pass) |

### Signature Changes

```typescript
// Before
async postInvoice(companyId: string, invoiceNumber: string, amount: number, ...)

// After
async postInvoice(companyId: string, invoiceId: string, invoiceNumber: string, amount: number, ...)
//                                   ^^^^^^^^^^^ NEW parameter
```

---

## 6. Error Handling: Constraint Violation

When duplicate is blocked:

```typescript
try {
  await journalRepository.create({ ... });
} catch (err) {
  if ((err as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
    throw new Error(`Journal entry already exists for ${sourceType} ${sourceId}`);
  }
  throw err;
}
```

---

## 7. Migration Strategy

1. Add nullable `sourceType` and `sourceId` columns
2. Add unique constraint (works with NULLs per PostgreSQL behavior)
3. Update all journal creation methods to pass source info
4. Existing journals with NULL source remain valid

No backfill required — old entries are manual/adjustment type by nature.

---

## 8. Affected Files

| File                                                                 | Change Type                            |
| -------------------------------------------------------------------- | -------------------------------------- |
| `packages/database/prisma/schema.prisma`                             | Add enum, fields, constraint           |
| `apps/api/src/modules/accounting/services/journal.service.ts`        | Add sourceType/sourceId to all methods |
| `apps/api/src/modules/accounting/repositories/journal.repository.ts` | Handle P2002 errors                    |
| `apps/api/src/modules/accounting/sagas/invoice-posting.saga.ts`      | Pass invoiceId to journal              |
| `apps/api/src/modules/accounting/sagas/bill-posting.saga.ts`         | Pass billId to journal                 |
| `apps/api/src/modules/accounting/sagas/payment-posting.saga.ts`      | Pass paymentId to journal              |
