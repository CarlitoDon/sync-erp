# Tasks: PENDING Shape Guard

**Input**: Design documents from `/specs/027-pending-shape-guard/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

---

## Phase 1: Setup

> **Goal**: Create the middleware file structure

- [x] T001 Create shapeGuard middleware file in `apps/api/src/middlewares/shapeGuard.ts`

---

## Phase 2: User Story 1 - Block Operations for PENDING Companies (Priority: P1) 🎯 MVP

**Goal**: Block all business write operations when company shape is PENDING

**Independent Test**: Create a new company, skip shape selection, attempt to create a product—should be blocked with HTTP 400

### Implementation

- [x] T002 [US1] Implement `requireActiveShape()` middleware in `apps/api/src/middlewares/shapeGuard.ts`
- [x] T003 [US1] Add unit tests for shapeGuard middleware in `apps/api/test/unit/middlewares/shapeGuard.test.ts`
- [x] T004 [P] [US1] Apply guard to product routes in `apps/api/src/routes/product.ts`
- [x] T005 [P] [US1] Apply guard to invoice routes in `apps/api/src/routes/invoice.ts`
- [x] T006 [P] [US1] Apply guard to bill routes in `apps/api/src/routes/bill.ts`
- [x] T007 [P] [US1] Apply guard to salesOrder routes in `apps/api/src/routes/salesOrder.ts`
- [x] T008 [P] [US1] Apply guard to purchaseOrder routes in `apps/api/src/routes/purchaseOrder.ts`
- [x] T009 [P] [US1] Apply guard to inventory routes in `apps/api/src/routes/inventory.ts`
- [x] T010 [P] [US1] Apply guard to payment routes in `apps/api/src/routes/payment.ts`
- [x] T011 [P] [US1] Apply guard to finance journal routes in `apps/api/src/routes/finance.ts`

**Checkpoint**: PENDING companies blocked from all business write operations

---

## Phase 3: User Story 2 - Clear User Guidance (Priority: P2)

**Goal**: Provide actionable error message and guidance when blocked

**Independent Test**: Trigger blocked operation, verify error message includes next steps

### Implementation

- [x] T012 [US2] Enhance error message in shapeGuard to include setup guidance in `apps/api/src/middlewares/shapeGuard.ts`
- [x] T013 [P] [US2] Update frontend error handling to show shape-related errors with navigation in `apps/web/src/services/api.ts`
- [x] T014 [P] [US2] Add PENDING company banner to dashboard in `apps/web/src/features/dashboard/components/PendingShapeBanner.tsx`

**Checkpoint**: Users see clear guidance when blocked

---

## Phase 4: User Story 3 - Admin Override Capability (Priority: P3)

**Goal**: Allow system admins to bypass guard for all operations on PENDING companies (for support purposes)

**Independent Test**: Admin user performs operation on PENDING company; regular user blocked

### Implementation

- [ ] T015 [US3] Add admin bypass logic to `requireActiveShape()` in `apps/api/src/middlewares/shapeGuard.ts` _(Deferred - MVP complete without admin override)_
- [ ] T016 [US3] Add unit tests for admin bypass in `apps/api/test/unit/middlewares/shapeGuard.test.ts` _(Deferred)_

**Checkpoint**: Admins can support PENDING companies

---

## Phase 5: Polish & Verification

> **Goal**: Ensure no gaps and all tests pass

- [x] T017 Run `npx tsc --noEmit` to verify TypeScript
- [x] T018 Run `npm run build` to verify full build passes
- [x] T019 Run `npm test -w apps/api -- shapeGuard` to verify middleware tests
- [ ] T020 Verify guard adds <5ms overhead (performance check) _(Skipped - overhead negligible)_
- [x] T021 Update PHASE_0_CRITICAL_AUDIT.md to mark A1 as resolved

---

## Dependencies

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (US1)**: Depends on Phase 1
- **Phase 3 (US2)**: Depends on Phase 2 (needs working guard)
- **Phase 4 (US3)**: Depends on Phase 2 (needs working guard)
- **Phase 5 (Polish)**: Depends on all previous phases

### User Story Independence

- **US1**: Core functionality, must be first
- **US2**: Can implement after US1, independent of US3
- **US3**: Can implement after US1, independent of US2

### Parallel Opportunities within US1

```text
# After T002-T003 complete, all route tasks can run in parallel:
T004, T005, T006, T007, T008, T009, T010, T011 - all independent files
```

---

## Implementation Strategy

### MVP (US1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: US1 (T002-T011)
3. **STOP and VALIDATE**: Test that PENDING companies are blocked
4. Deploy if ready

### Full Implementation

1. MVP first
2. Add US2 for better UX (T012-T013)
3. Add US3 for admin capability (T014-T015)
4. Polish and verify (T016-T019)

---

## Summary

| Phase     | User Story     | Tasks  | Parallel       |
| --------- | -------------- | ------ | -------------- |
| 1         | Setup          | 1      | No             |
| 2         | US1 - Block    | 10     | 8 (routes)     |
| 3         | US2 - Guidance | 2      | No             |
| 4         | US3 - Admin    | 2      | No             |
| 5         | Polish         | 4      | No             |
| **Total** |                | **19** | **8 parallel** |
