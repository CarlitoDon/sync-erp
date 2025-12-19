# Quickstart: Prevent Journal Double-Posting

**Feature**: 024-fix-journal-double-post  
**Branch**: `024-fix-journal-double-post`

---

## Problem

JournalEntry has no unique constraint linking it to source documents. Multiple code paths can create duplicate journals for the same invoice/bill/payment.

## Solution

Add `sourceType` and `sourceId` to JournalEntry with composite unique constraint.

---

## Implementation Checklist

### 1. Schema Migration

```bash
# Add enum and fields to schema.prisma
# packages/database/prisma/schema.prisma

# Run migration
cd packages/database
npx prisma migrate dev --name add_journal_source
```

### 2. Update JournalService

```typescript
// apps/api/src/modules/accounting/services/journal.service.ts

// Update method signatures to include sourceId
async postInvoice(companyId: string, invoiceId: string, invoiceNumber: string, ...)

// Add source fields when creating journal
await repository.create({
  companyId,
  reference: `Invoice: ${invoiceNumber}`,
  sourceType: 'INVOICE',
  sourceId: invoiceId,
  ...
});
```

### 3. Update Saga Callers

```typescript
// InvoicePostingSaga, BillPostingSaga, PaymentPostingSaga
// Pass the entity ID to journal service methods
```

### 4. Handle Constraint Violations

```typescript
// In journal.repository.ts
try {
  return await prisma.journalEntry.create({ data });
} catch (err) {
  if (
    (err as Prisma.PrismaClientKnownRequestError).code === 'P2002'
  ) {
    throw new Error(
      `Journal entry already exists for ${data.sourceType} ${data.sourceId}`
    );
  }
  throw err;
}
```

---

## Verification

```bash
# Run unit tests
cd apps/api && npm test -- -t "Journal"

# TypeScript check
npx tsc --noEmit

# Build
npm run build

# Manual test: Post same invoice twice, expect error on second attempt
```
