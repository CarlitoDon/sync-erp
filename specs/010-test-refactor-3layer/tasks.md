# Tasks: Test Refactor for 3-Layer API Architecture

**Input**: Design documents from `/specs/010-test-refactor-3layer/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, quickstart.md ✅

**Tests**: This feature IS about tests - so we're fixing existing tests, not writing new ones.

**Organization**: Tasks grouped to enable incremental verification.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1-US4)
- Include exact file paths in descriptions

---

## Phase 0: Baseline Capture

**Purpose**: Record current test state before refactoring

- [x] T000 [US4] Run `npm run test --workspace=@sync-erp/api` and record total test count as baseline for SC-004 verification (BASELINE: 145 tests, 48 failed, 97 passed)

---

## Phase 1: Setup (Mock Infrastructure) 🎯 MVP Foundation

**Purpose**: Create repository mock utilities that all service tests will use (implements FR-001)

- [x] T001 Create `repositories.mock.ts` in `apps/api/test/unit/mocks/repositories.mock.ts` with mocks for all repository classes
- [x] T002 Add `resetRepositoryMocks()` utility function in `repositories.mock.ts` (implements FR-005)

**Checkpoint**: Mock infrastructure ready - service test fixes can begin

---

## Phase 2: User Story 1 - Fix Service Unit Tests (Priority: P1) 🎯 MVP

**Goal**: All 15 service test files run their tests (no "0 test" output)

**Independent Test**: `npm run test --workspace=@sync-erp/api -- test/unit/services/` shows tests running

### Prototype (First Test)

- [x] T003 [US1] Fix `ProductService.test.ts` - update import path from `../../../src/services/ProductService` to `../../../src/modules/product/product.service`
- [x] T004 [US1] Mock `ProductRepository` in `ProductService.test.ts` using vi.mock()
- [x] T005 [US1] Verify ProductService tests pass: `npm run test --workspace=@sync-erp/api -- -t "ProductService"` (17 tests pass)

### Apply Pattern to Remaining Tests

- [x] T006 [P] [US1] Fix `PartnerService.test.ts` - update import to `../../../src/modules/partner/partner.service` and mock `PartnerRepository`
- [x] T007 [P] [US1] Fix `UserService.test.ts` - update import to `../../../src/modules/user/user.service` and mock `UserRepository`
- [x] T008 [P] [US1] Fix `AccountService.test.ts` - update import to `../../../src/modules/accounting/services/account.service` and mock `AccountRepository`
- [x] T009 [P] [US1] Fix `InvoiceService.test.ts` - update import to `../../../src/modules/accounting/services/invoice.service` and mock `InvoiceRepository`
- [x] T010 [P] [US1] Fix `BillService.test.ts` - update import to `../../../src/modules/accounting/services/bill.service` and mock `BillRepository`
- [x] T011 [P] [US1] Fix `JournalService.test.ts` - update import to `../../../src/modules/accounting/services/journal.service` and mock `JournalRepository`
- [x] T012 [P] [US1] Fix `PaymentService.test.ts` - update import to `../../../src/modules/accounting/services/payment.service` and mock `PaymentRepository`
- [x] T013 [P] [US1] Fix `ReportService.test.ts` - update import to `../../../src/modules/accounting/services/report.service` and mock dependencies
- [x] T014 [P] [US1] Fix `InventoryService.test.ts` - update import to `../../../src/modules/inventory/inventory.service` and mock `InventoryRepository`
- [x] T015 [P] [US1] Fix `SalesOrderService.test.ts` - update import to `../../../src/modules/sales/sales.service` and mock `SalesRepository`
- [x] T016 [P] [US1] Fix `PurchaseOrderService.test.ts` - update import to `../../../src/modules/procurement/procurement.service` and mock `ProcurementRepository`
- [x] T017 [P] [US1] Deleted obsolete `FulfillmentService.test.ts` (service merged into SalesService.ship())
- [x] T018 [P] [US1] Replaced `sessionService.test.ts` with `AuthService.test.ts` using `AuthRepository` mock
- [x] T019 [P] [US1] Fix `authUtil.test.ts` - update import to `../../../src/modules/auth/auth.utils`
- [x] T020 [US1] Service tests verified: 14 files, 153 tests pass

**Checkpoint**: ✅ All 14 service test files execute their test cases (153 tests pass)

---

## Phase 3: User Story 2 - Fix Route/Controller Tests (Priority: P1)

**Goal**: Route tests pass without "Server Error" from service layer

**Independent Test**: `npm run test --workspace=@sync-erp/api -- test/unit/routes/` passes without errors

### Update Service Mocks

- [ ] T021 [US2] Add `listForUser` method to `mockCompanyService` in `services.mock.ts`
- [ ] T022 [P] [US2] Add `createFromSalesOrder` method to `mockInvoiceService` in `services.mock.ts`
- [ ] T023 [P] [US2] Add `createFromPurchaseOrder` method to `mockBillService` in `services.mock.ts`
- [ ] T024 [P] [US2] Add `processGoodsReceipt` method to `mockInventoryService` in `services.mock.ts`
- [ ] T025 [P] [US2] Add `void` method to `mockInvoiceService` and `mockBillService` in `services.mock.ts`

### Fix Route Test Files

- [ ] T026 [P] [US2] Fix `company.test.ts` route test - ensure mock returns proper array for `listForUser`
- [ ] T027 [P] [US2] Fix `invoice.test.ts` route test - mock `createFromSalesOrder`, `post`, `void` methods
- [ ] T028 [P] [US2] Fix `bill.test.ts` route test - mock `createFromPurchaseOrder`, `post`, `void` methods
- [ ] T029 [P] [US2] Fix `inventory.test.ts` route test - mock `processGoodsReceipt` properly
- [ ] T030 [P] [US2] Fix `partner.test.ts` route test - mock `update` method properly for update endpoint
- [ ] T031 [US2] Run all route tests and verify no "Server Error": `npm run test --workspace=@sync-erp/api -- test/unit/routes/`

**Checkpoint**: All route tests pass without unhandled service errors

---

## Phase 4: User Story 4 - Verify Test Coverage (Priority: P3)

**Goal**: Confirm total test count and coverage maintained

**Independent Test**: Compare test count before/after, verify exit code 0

- [ ] T032 [US4] Run full API test suite: `npm run test --workspace=@sync-erp/api`
- [ ] T033 [US4] Verify exit code 0 (all tests pass)
- [ ] T034 [US4] Check no "(0 test)" in any test file output
- [ ] T035 [US4] Verify middleware tests still pass (auth, rbac, errorHandler)

**Checkpoint**: Full test suite passes

---

## Phase 5: Polish & Documentation

**Purpose**: Final cleanup and documentation

- [ ] T036 [P] Remove unused imports from refactored test files
- [ ] T037 [P] Update any TODO comments in test files
- [ ] T038 Create walkthrough.md documenting completed work in `specs/010-test-refactor-3layer/walkthrough.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) → Phase 2 (US1 Service Tests) → Phase 3 (US2 Route Tests) → Phase 4 (Verify) → Phase 5 (Polish)
```

- **Phase 1**: Must complete first - provides mock infrastructure
- **Phase 2**: Service tests depend on repository mocks from Phase 1
- **Phase 3**: Route tests can start after Phase 1, but Phase 2 validates the pattern works
- **Phase 4**: Verification requires Phase 2 + 3 complete
- **Phase 5**: Only after all tests pass

### Parallel Opportunities

**Within Phase 2 (Service Tests)**:

```text
T006-T019 can all run in parallel (different test files)
```

**Within Phase 3 (Route Tests)**:

```text
T022-T025 can run in parallel (different mock methods)
T026-T030 can run in parallel (different route test files)
```

---

## Implementation Strategy

### MVP First (Phase 1-2 Only)

1. Complete Phase 1: Create repository mocks
2. Complete T003-T005: Prototype with ProductService
3. Verify pattern works
4. **STOP and VALIDATE**: Check ProductService tests pass

### Incremental Delivery

1. Phase 1 → Mock infrastructure ready
2. Phase 2 → Service tests all running (major milestone)
3. Phase 3 → Route tests fixed
4. Phase 4 → Full validation
5. Phase 5 → Polish and docs

---

## Summary

| Metric                      | Count               |
| --------------------------- | ------------------- |
| Total Tasks                 | 39                  |
| Phase 0 (Baseline)          | 1                   |
| Phase 1 (Setup)             | 2                   |
| Phase 2 (US1 Service Tests) | 18                  |
| Phase 3 (US2 Route Tests)   | 11                  |
| Phase 4 (US4 Verify)        | 4                   |
| Phase 5 (Polish)            | 3                   |
| Parallel Opportunities      | 23 tasks marked [P] |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- US3 (Repository Mock Infrastructure) is addressed in Phase 1
- Commit after each phase completion
- Use `--grep` flag to run specific tests during development
