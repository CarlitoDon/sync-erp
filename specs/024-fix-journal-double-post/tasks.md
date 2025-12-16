# Tasks: Prevent Journal Double-Posting

**Input**: Design documents from `/specs/024-fix-journal-double-post/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: This feature requires tests per the spec acceptance scenarios.

**Organization**: Tasks grouped by user story for independent implementation.

**Status**: Ready for implementation

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Exact file paths included

---

## Phase 1: Setup (Schema Migration)

**Purpose**: Database schema changes for journal source tracking

- [x] T001 Add `JournalSourceType` enum to `packages/database/prisma/schema.prisma`
- [x] T002 Add `sourceType` and `sourceId` fields to `JournalEntry` model in `packages/database/prisma/schema.prisma`
- [x] T003 Add unique constraint `@@unique([companyId, sourceType, sourceId])` in `packages/database/prisma/schema.prisma`
- [x] T004 Run Prisma migration: `cd packages/database && npx prisma migrate dev --name add_journal_source`
- [x] T005 Rebuild database package: `cd packages/database && npm run build`

**Checkpoint**: Schema ready with JournalSourceType enum and unique constraint

---

## Phase 2: Foundational (Service & Repository Changes)

**Purpose**: Core JournalService and Repository changes that enable all user stories

**⚠️ CRITICAL**: User story work depends on this phase

- [x] T006 Update `JournalRepository.create()` to handle P2002 unique constraint violations in `apps/api/src/modules/accounting/repositories/journal.repository.ts`
- [x] T007 Update `JournalService.resolveAndCreate()` to accept optional `sourceType` and `sourceId` params in `apps/api/src/modules/accounting/services/journal.service.ts`
- [x] T008 Update `JournalService.postInvoice()` to require `invoiceId` parameter in `apps/api/src/modules/accounting/services/journal.service.ts`
- [x] T009 Update `JournalService.postBill()` to require `billId` parameter in `apps/api/src/modules/accounting/services/journal.service.ts`
- [x] T010 Update `JournalService.postPaymentReceived()` to require `paymentId` parameter in `apps/api/src/modules/accounting/services/journal.service.ts`
- [x] T011 Update `JournalService.postPaymentMade()` to require `paymentId` parameter in `apps/api/src/modules/accounting/services/journal.service.ts`
- [x] T012 Update `JournalService.postCreditNote()` to require `creditNoteId` parameter in `apps/api/src/modules/accounting/services/journal.service.ts`

**Checkpoint**: JournalService ready to store source type and ID

---

## Phase 3: User Story 1 - Prevent Duplicate Journal Entries (Priority: P1) 🎯 MVP

**Goal**: Database blocks duplicate journals for same source document

**Independent Test**: Post same invoice twice → second attempt blocked with error

### Tests for User Story 1

- [x] T013 [P] [US1] Add test for journal creation with sourceType/sourceId in `apps/api/test/unit/modules/accounting/`
- [x] T014 [P] [US1] Add test for P2002 constraint violation handling in `apps/api/test/unit/modules/accounting/`

### Implementation for User Story 1

- [x] T015 [US1] Update `InvoicePostingSaga.executeSteps()` to pass `invoiceId` to `postInvoice()` in `apps/api/src/modules/accounting/sagas/invoice-posting.saga.ts`
- [x] T016 [US1] Update `BillPostingSaga.executeSteps()` to pass `billId` to `postBill()` in `apps/api/src/modules/accounting/sagas/bill-posting.saga.ts`
- [x] T017 [US1] Update `PaymentPostingSaga.executeSteps()` to pass `paymentId` to `postPaymentReceived()` in `apps/api/src/modules/accounting/sagas/payment-posting.saga.ts`
- [x] T018 [US1] Update `CreditNoteSaga.executeSteps()` to pass `creditNoteId` to `postCreditNote()` in `apps/api/src/modules/accounting/sagas/credit-note.saga.ts`
- [x] T019 [US1] Update `InvoiceService.createCreditNote()` to pass `creditNoteId` to `postCreditNote()` in `apps/api/src/modules/accounting/services/invoice.service.ts`
- [x] T020 [US1] Run unit tests: `cd apps/api && npm test -- -t "Journal"`

**Checkpoint**: Journal double-posting prevented for all source types

---

## Phase 4: User Story 2 - Journal Entry Traceability (Priority: P1)

**Goal**: Journal entries link back to source documents

**Independent Test**: Query journal entry → see sourceType and sourceId

### Implementation for User Story 2

- [x] T020 [US2] Verify journal repository includes sourceType/sourceId in query results in `apps/api/src/modules/accounting/repositories/journal.repository.ts`
- [x] T021 [US2] Add test for journal traceability (source fields present in results)

**Checkpoint**: Journals traceable to source documents

---

## Phase 5: User Story 3 - Graceful Constraint Violation Handling (Priority: P2)

**Goal**: P2002 errors handled gracefully with clear messages

**Independent Test**: Force duplicate → get clear error message, not crash

### Implementation for User Story 3

- [x] T022 [US3] Add error message formatting for constraint violations in `apps/api/src/modules/accounting/repositories/journal.repository.ts`
- [x] T023 [US3] Add logging for duplicate journal attempts

**Checkpoint**: Constraint violations handled gracefully

---

## Phase 6: Polish & Verification

**Purpose**: Final verification and documentation

- [x] T024 TypeScript check: `npx tsc --noEmit` (verify zero errors)
- [x] T025 Run all journal tests: `cd apps/api && npm test -- -t "Journal"`
- [x] T026 Full build: `npm run build`
- [x] T027 Update `docs/apple-like-development/reviews/PHASE_0_CRITICAL_AUDIT.md` to mark C1 as resolved

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3-5 (User Stories) → Phase 6 (Polish)
```

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 only — Core fix (MVP)
- **US2 (P1)**: Depends on Phase 2 only — Can run parallel with US1
- **US3 (P2)**: Depends on Phase 2 only — Can run parallel with US1/US2

### Within Each Story

- Tests first (marked [P])
- Implementation after tests pass
- Verify at checkpoint before next story

---

## Parallel Execution Example

```bash
# Phase 3 tests can run in parallel:
T013 [P] [US1] Add test for journal creation
T014 [P] [US1] Add test for P2002 handling

# Across stories (after Phase 2):
Developer A: US1 (T013-T019)
Developer B: US2 (T020-T021)
Developer C: US3 (T022-T023)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T012)
3. Complete Phase 3: US1 (T013-T019)
4. **STOP and VALIDATE**: Run tests, verify duplicate blocked
5. This alone fixes the critical accounting bug

### Full Delivery

1. MVP + US2 (traceability)
2. MVP + US3 (graceful handling)
3. Phase 6 (polish)

---

## Summary

| Metric                 | Value                 |
| ---------------------- | --------------------- |
| Total Tasks            | 27                    |
| Setup Tasks            | 5                     |
| Foundational Tasks     | 7                     |
| US1 Tasks              | 7                     |
| US2 Tasks              | 2                     |
| US3 Tasks              | 2                     |
| Polish Tasks           | 4                     |
| Parallel Opportunities | 4 tasks marked [P]    |
| MVP Scope              | Phase 1-3 (T001-T019) |
