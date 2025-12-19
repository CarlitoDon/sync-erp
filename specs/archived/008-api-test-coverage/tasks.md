# Tasks: API Test Coverage

**Input**: Design documents from `/specs/008-api-test-coverage/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, quickstart.md ✅

**Goal**: Achieve and enforce test coverage for API source files.

**Current Status**: 96.37% (services: 99.58%, middlewares: 98.64%, routes: 88.30%) ✅
**Initial Threshold**: 35% (to be increased incrementally to 80%)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup (✅ COMPLETE)

- [x] T001 Install @vitest/coverage-v8
- [x] T002 Create vitest.config.ts with coverage configuration
- [x] T003 Add test:coverage script to package.json
- [x] T004 Add coverage/ to .gitignore

---

## Phase 2: Service Unit Tests (Priority P1) ✅ COMPLETE

### Services with 100% Coverage ✅

- [x] T005 [P] [US2] Create unit test for CompanyService
- [x] T006 [P] [US2] Create unit test for UserService
- [x] T007 [P] [US2] Create unit test for authService
- [x] T008 [P] [US2] Create unit test for authUtil
- [x] T009 [P] [US2] Create unit test for sessionService
- [x] T010 [P] [US2] Create unit test for PartnerService
- [x] T011 [P] [US2] Create unit test for BillService
- [x] T012 [P] [US2] Create unit test for PaymentService
- [x] T013 [P] [US2] Create unit test for DocumentNumberService
- [x] T014 [P] [US2] Create unit test for AccountService
- [x] T015 [P] [US2] Create unit test for ProductService
- [x] T016 [P] [US2] Create unit test for ReportService
- [x] T017 [P] [US2] Create unit test for FulfillmentService

### Complex Services (Completed with Mocking) ✅

- [x] T018 Create unit test for InventoryService
- [x] T019 Create unit test for InvoiceService
- [x] T020 Create unit test for JournalService
- [x] T021 Create unit test for PurchaseOrderService
- [x] T022 Create unit test for SalesOrderService

**Note**: All service tests utilize Prims mock infrastructure.

---

## Phase 3: Middleware Unit Tests (Priority P2) ✅ COMPLETE

- [x] T023 [P] [US4] Create unit test for auth middleware
- [x] T024 [P] [US4] Create unit test for errorHandler middleware
- [x] T025 [P] [US4] Create unit test for rbac middleware

---

## Phase 4: Route Integration Tests (Priority P3) ✅ COMPLETE

Route tests using supertest and full app initialization.

- [x] T026 Create integration tests for health router
- [x] T027 Create integration tests for user router
- [x] T028 Create integration tests for auth router
- [x] T029 Create integration tests for partner router
- [x] T030 Create integration tests for product router
- [x] T031 Create integration tests for salesOrder router
- [x] T032 Create integration tests for purchaseOrder router
- [x] T033 Create integration tests for invoice router
- [x] T034 Create integration tests for bill router
- [x] T035 Create integration tests for inventory router
- [x] T036 Create integration tests for payment router
- [x] T037 Create integration tests for finance router
- [x] T038 Create integration tests for company router

---

## Phase 5: Verification & Polish (✅ COMPLETE)

- [x] T039 Run full coverage suite and verify thresholds met
- [x] T040 Threshold enforcement configured (set to 80%)
- [x] T041 Ensure all unit tests pass (exit code 0)
- [x] T042 Update quickstart.md with test running instructions
- [x] T043 Fix integration tests (tax-purchase, finance-full-cycle)

---

## Summary

| Metric                 | Achieved | Target | Status     |
| ---------------------- | -------- | ------ | ---------- |
| **Setup Tasks**        | 4/4      | 4      | ✅         |
| **Service Tests**      | 18/18    | 18     | 100% ✅    |
| **Middleware Tests**   | 3/3      | 3      | 100% ✅    |
| **Route Tests**        | 13/13    | 13     | 100% ✅    |
| **Overall Coverage**   | 96.37%   | 80%    | ✅ PASSING |
| **Services Coverage**  | 99.58%   | 80%    | ✅         |
| **Functions Coverage** | 100%     | 80%    | ✅         |
| **Branches Coverage**  | 85.24%   | 80%    | ✅         |

## Next Steps

1. Maintain coverage as new features are added.
2. Consider adding E2E tests for complex user flows (using Playwright/etc via frontend).
