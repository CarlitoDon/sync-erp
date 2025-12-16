# Tasks: Fix Idempotency Key Scope

**Input**: Design documents from `/specs/023-fix-idempotency-scope/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: This feature requires tests per the spec acceptance scenarios.

**Organization**: Tasks grouped by user story for independent implementation.

**Status**: ✅ **COMPLETE** (2025-12-16)

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Exact file paths included

---

## Phase 1: Setup (Schema Migration) ✅

**Purpose**: Database schema changes for entityId support

- [x] T001 Add `entityId` field to IdempotencyKey model in `packages/database/prisma/schema.prisma`
- [x] T002 Add unique constraint `@@unique([companyId, scope, entityId])` in `packages/database/prisma/schema.prisma`
- [x] T003 Run Prisma migration: `cd packages/database && npx prisma migrate dev --name add_idempotency_entity_id`
- [x] T004 Rebuild database package: `cd packages/database && npm run build`

**Checkpoint**: ✅ Schema ready with entityId field and constraint

---

## Phase 2: Foundational (Service API Changes) ✅

**Purpose**: Core IdempotencyService changes that enable all user stories

- [x] T005 Update `IdempotencyService.lock()` signature to require `entityId` parameter
- [x] T006 Add entityId validation logic in `lock()` method: if existing key has entityId AND differs, throw error
- [x] T007 Update `lock()` to store entityId when creating new key
- [x] T008 Add logging for key scope mismatch attempts

**Checkpoint**: ✅ Service API ready for callers to pass entityId

---

## Phase 3: User Story 1 - Prevent Key Reuse Across Entities (Priority: P1) ✅ MVP

**Goal**: Reject requests where idempotency key is reused for different entity

### Tests for User Story 1

- [x] T009 [P] [US1] Add entity mismatch test case in `t013_idempotency.test.ts`
- [x] T010 [P] [US1] Add matching entityId test case (should return cached) in `t013_idempotency.test.ts`

### Implementation for User Story 1

- [x] T011 [US1] Update `InvoiceService.post()` to pass `invoiceId` as entityId
- [x] T012 [US1] Update `PaymentService.create()` to pass `invoiceId` as entityId
- [x] T013 [US1] Run unit tests (13 passed)

**Checkpoint**: ✅ Entity mismatch rejection working for Invoice and Payment flows

---

## Phase 4: User Story 3 - Backward Compatibility (Priority: P2) ✅

**Goal**: Existing old-style keys (without entityId) continue to work

### Tests for User Story 3

- [x] T014 [P] [US3] Add backward compatibility test case (old key, no entityId) in `t013_idempotency.test.ts`

### Implementation for User Story 3

- [x] T015 [US3] Validation logic skips entityId check if existing key has null entityId (implemented in T006)

**Checkpoint**: ✅ Old keys work, new keys enforce entity binding

---

## Phase 5: Polish & Verification ✅

**Purpose**: Final verification and documentation

- [x] T016 TypeScript check: `npx tsc --noEmit` (zero errors)
- [x] T017 Run all idempotency tests: 13 passed
- [x] T018 Full build: `npm run build` (5/5 tasks successful)
- [x] T019 Update `PHASE_0_CRITICAL_AUDIT.md` to mark B1 as resolved

---

## Summary

| Metric        | Value      |
| ------------- | ---------- |
| Total Tasks   | 19         |
| Completed     | 19 ✅      |
| Failed        | 0          |
| Tests Passing | 13         |
| Build Status  | ✅ Success |
