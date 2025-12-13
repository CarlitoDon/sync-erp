# Tasks: Backend Shared Validation

**Feature Branch**: `013-backend-shared-validation`
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

## Phase 1: Setup

- [ ] T001 Verify branch is `013-backend-shared-validation`
- [ ] T002 Run `npm run build -w packages/shared` to ensure shared package is up-to-date

---

## Phase 2: Foundational (Shared Package Updates)

**Purpose**: Add any missing schemas to `@sync-erp/shared` before controller updates

- [ ] T003 [P] Check if `CreateBillSchema` exists in `packages/shared/src/validators/index.ts`
- [ ] T004 If missing, add `CreateBillSchema` extending `CreateInvoiceSchema` with `type: z.literal('BILL')` in `packages/shared/src/validators/index.ts`
- [ ] T005 Export `CreateBillInput` type in `packages/shared/src/validators/index.ts`
- [ ] T006 Rebuild shared package: `npm run build -w packages/shared`

**Checkpoint**: All schemas now available in `@sync-erp/shared`

---

## Phase 3: User Story 1 - Consistent API Validation (Priority: P1) 🎯 MVP

**Goal**: All API endpoints validate request payloads using centralized schemas from `@sync-erp/shared`

**Independent Test**: Send invalid payloads to updated endpoints and verify 400 errors with validation messages

### Implementation for User Story 1

- [ ] T007 [US1] Import `InviteUserSchema` from `@sync-erp/shared` in `apps/api/src/modules/user/user.controller.ts`
- [ ] T008 [US1] Import `AssignRoleSchema` from `@sync-erp/shared` in `apps/api/src/modules/user/user.controller.ts`
- [ ] T009 [US1] Remove local `InviteUserSchema` definition from `apps/api/src/modules/user/user.controller.ts`
- [ ] T010 [US1] Remove local `AssignUserSchema` definition from `apps/api/src/modules/user/user.controller.ts`
- [ ] T011 [US1] Update `invite()` method to use imported `InviteUserSchema.parse()` in `apps/api/src/modules/user/user.controller.ts`
- [ ] T012 [US1] Update role assignment to use `AssignRoleSchema.parse()` in `apps/api/src/modules/user/user.controller.ts`
- [ ] T013 [US1] Import `CreateInvoiceSchema` from `@sync-erp/shared` in `apps/api/src/modules/accounting/controllers/invoice.controller.ts`
- [ ] T014 [US1] Add `CreateInvoiceSchema.parse(req.body)` in `create()` method of `apps/api/src/modules/accounting/controllers/invoice.controller.ts`
- [ ] T015 [US1] Import `CreateBillSchema` from `@sync-erp/shared` in `apps/api/src/modules/accounting/controllers/bill.controller.ts`
- [ ] T016 [US1] Add `CreateBillSchema.parse(req.body)` in `create()` method of `apps/api/src/modules/accounting/controllers/bill.controller.ts`

**Checkpoint**: All 3 controllers now validate input using shared schemas

---

## Phase 4: User Story 2 - Standardized Error Responses (Priority: P2)

**Goal**: Validation errors follow consistent format across all endpoints

**Independent Test**: Send invalid payloads to user, invoice, bill endpoints - verify same error structure

### Implementation for User Story 2

- [ ] T017 [US2] Verify `errorHandler.ts` middleware correctly handles `ZodError` in `apps/api/src/middlewares/errorHandler.ts`
- [ ] T018 [US2] If needed, update error handler to extract Zod field-level errors into structured response
- [ ] T019 [US2] Test invalid email in `/api/users/invite` returns `{ success: false, error: { message, details } }`
- [ ] T020 [US2] Test missing field in invoice creation returns same error structure

**Checkpoint**: Error responses are consistent across all validation-enabled endpoints

---

## Phase 5: User Story 3 - Remove Local Schema Duplication (Priority: P3)

**Goal**: No local `z.object()` definitions in controllers - all from shared

**Independent Test**: Grep for `z.object()` in controllers - should return zero results

### Implementation for User Story 3

- [ ] T021 [US3] Remove `import { z } from 'zod'` from `apps/api/src/modules/user/user.controller.ts` if no longer needed
- [ ] T022 [US3] Run grep to verify no `z.object()` in `apps/api/src/modules/user/user.controller.ts`
- [ ] T023 [US3] Run grep to verify no `z.object()` in `apps/api/src/modules/accounting/controllers/`

**Checkpoint**: Zero local schema definitions in controllers

---

## Phase 6: Polish & Verification

- [ ] T024 Run `npx tsc --noEmit` in `apps/api` - verify zero type errors
- [ ] T025 Run `npm test -w apps/api` - verify existing tests pass
- [ ] T026 Run quickstart.md verification steps (curl with invalid payload)
- [ ] T027 Commit changes with message: `refactor(api): use shared schemas for validation`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: Depends on Phase 1 - adds missing schemas
- **Phase 3 (US1)**: Depends on Phase 2 - core validation implementation
- **Phase 4 (US2)**: Can run after Phase 3 - error response standardization
- **Phase 5 (US3)**: Can run after Phase 3 - cleanup
- **Phase 6 (Polish)**: Depends on all user stories

### Parallel Opportunities

```bash
# T003-T005 can run in parallel (checking/adding schemas)
# T007-T012 (user controller) can run while T013-T016 (accounting controllers) run
# T021-T023 can run in parallel (grep verification)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (add missing schemas)
3. Complete Phase 3: User Story 1 (core validation)
4. **STOP and VALIDATE**: Type check + basic API test
5. Can merge after this point

### Full Implementation

1. Setup → Foundational → US1 → US2 → US3 → Polish
2. Total: 27 tasks
3. Estimated time: 1-2 hours

---

## Summary

| Phase        | Story                     | Task Count |
| ------------ | ------------------------- | ---------- |
| Setup        | -                         | 2          |
| Foundational | -                         | 4          |
| US1 (P1)     | Consistent API Validation | 10         |
| US2 (P2)     | Standardized Errors       | 4          |
| US3 (P3)     | Remove Duplication        | 3          |
| Polish       | -                         | 4          |
| **Total**    |                           | **27**     |
