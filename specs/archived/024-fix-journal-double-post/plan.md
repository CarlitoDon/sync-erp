# Implementation Plan: Prevent Journal Double-Posting

**Branch**: `024-fix-journal-double-post` | **Date**: 2025-12-16 | **Spec**: [spec.md](./spec.md)

## Summary

Fix critical accounting bug (Audit C1) where duplicate journal entries can be created for the same source document. Add `sourceType` and `sourceId` fields to JournalEntry with composite unique constraint `(companyId, sourceType, sourceId)`.

---

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 20+  
**Primary Dependencies**: Express, Prisma, Vitest  
**Storage**: PostgreSQL (via Prisma)  
**Testing**: Vitest (existing tests at `apps/api/test/unit/modules/accounting/`)  
**Target Platform**: Linux server (Node.js)  
**Project Type**: Monorepo (turbo)  
**Performance Goals**: N/A (data integrity fix)  
**Constraints**: Backward compatible with existing journals  
**Scale/Scope**: 6 files modified, 1 migration

---

## Constitution Check

_GATE: All items relevant to this backend-only change._

- [x] **I. Architecture**: Backend-only change, no frontend impact
- [x] **II. Contracts**: Schema types auto-exported via Prisma
- [x] **III. Backend Layers**: JournalService is service layer, JournalRepository is data layer
- [x] **IV. Multi-Tenant**: All constraints scoped by `companyId`
- [x] **V. Frontend**: N/A (no frontend changes)
- [x] **VIII. Verification**: Will run `npx tsc --noEmit` and `npm run build`
- [x] **IX. Schema-First**: Prisma schema modified first, types auto-generated
- [x] **X. Parity**: Invoice/Bill/Payment posting all updated together
- [x] **XI. Performance**: No N+1 loops
- [x] **XII. Apple-Standard**: N/A (no user-facing change)
- [x] **XIII. Data Flow**: N/A (infrastructure)
- [x] **XIV-XVII. Human Experience**: N/A (backend only)

---

## Proposed Changes

### 1. Schema Migration

**File**: `packages/database/prisma/schema.prisma`

```diff
+enum JournalSourceType {
+  INVOICE
+  BILL
+  PAYMENT
+  CREDIT_NOTE
+  ADJUSTMENT
+}

model JournalEntry {
  id         String            @id @default(uuid())
  companyId  String
  reference  String?
  date       DateTime
  memo       String?
+ sourceType JournalSourceType?  // NEW
+ sourceId   String?             // NEW
  createdAt  DateTime          @default(now())

  company Company       @relation(...)
  lines   JournalLine[]

  @@index([companyId])
+ @@unique([companyId, sourceType, sourceId])  // NEW
}
```

### 2. JournalService Update

**File**: `apps/api/src/modules/accounting/services/journal.service.ts`

**Changes**:

- Add `sourceId` parameter to all `post*` methods
- Pass `sourceType` and `sourceId` to repository create

### 3. JournalRepository Update

**File**: `apps/api/src/modules/accounting/repositories/journal.repository.ts`

**Changes**:

- Handle P2002 error (unique constraint violation)
- Re-throw with clear error message

### 4. Saga Updates

**Files**:

- `apps/api/src/modules/accounting/sagas/invoice-posting.saga.ts`
- `apps/api/src/modules/accounting/sagas/bill-posting.saga.ts`
- `apps/api/src/modules/accounting/sagas/payment-posting.saga.ts`
- `apps/api/src/modules/accounting/sagas/credit-note.saga.ts`

**Changes**: Pass entity ID to journal service methods

---

## Verification Plan

### Automated Tests

**Existing Tests**:

```bash
cd apps/api && npm test -- -t "Journal"
```

**New Test Cases** (to be added):

| Test                                                 | Description                 |
| ---------------------------------------------------- | --------------------------- |
| `should create journal with sourceType and sourceId` | Verify source fields stored |
| `should reject duplicate journal for same source`    | P2002 error handling        |
| `should allow multiple journals with NULL source`    | Backward compat             |

### Build Verification

```bash
# TypeScript check
npx tsc --noEmit

# Full build
npm run build
```

### Migration Test

```bash
cd packages/database
npx prisma migrate dev --name add_journal_source
```

---

## Source Structure

```text
packages/database/prisma/
└── schema.prisma                    # [MODIFY] Add enum, fields, constraint

apps/api/src/modules/accounting/
├── services/
│   └── journal.service.ts           # [MODIFY] Add sourceId params
├── repositories/
│   └── journal.repository.ts        # [MODIFY] Handle P2002
└── sagas/
    ├── invoice-posting.saga.ts      # [MODIFY] Pass invoiceId
    ├── bill-posting.saga.ts         # [MODIFY] Pass billId
    ├── payment-posting.saga.ts      # [MODIFY] Pass paymentId
    └── credit-note.saga.ts          # [MODIFY] Pass creditNoteId
```

---

## Risks & Mitigations

| Risk                       | Mitigation                                       |
| -------------------------- | ------------------------------------------------ |
| Breaking existing journals | sourceType/sourceId nullable; old journals valid |
| Migration rollback         | Standard Prisma rollback supported               |
| Multiple saga conflicts    | P2002 handled gracefully with clear error        |
