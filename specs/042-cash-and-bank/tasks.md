# Tasks: Cash and Bank Feature

**Feature**: `042-cash-and-bank`
**Status**: Planning
**Spec**: [specs/042-cash-and-bank/spec.md](spec.md)

## Phase 1: Setup

**Goal**: Initialize project structure and database schema.

- [x] T001 Update Prisma schema with `BankAccount` and `CashTransaction` models packages/database/prisma/schema.prisma
- [x] T002 Run DB migration and generate client packages/database
- [x] T003 Seed default Cash and Bank accounts (Cash, Petty Cash, Bank) packages/database/prisma/seed.ts
- [x] T004 Create Zod schemas for CashBank API packages/shared/src/validators/cash-bank.schema.ts
- [x] T005 Create backend module structure (Router, Service, Repository, Policy) apps/api/src/modules/cash-bank
- [x] T006 Create frontend feature structure apps/web/src/features/cash-bank

## Phase 2: Foundational

**Goal**: Core repository methods and base service logic.

- [x] T007 Implement `BankAccountRepository` (CRUD) apps/api/src/modules/cash-bank/cash-bank.repository.ts
- [x] T008 Implement `CashTransactionRepository` (CRUD) apps/api/src/modules/cash-bank/cash-bank.repository.ts
- [x] T009 Implement `CashBankService` base structure apps/api/src/modules/cash-bank/cash-bank.service.ts
- [x] T010 Register `CashBankRouter` in API routes apps/api/src/trpc/router.ts

## Phase 3: [US1] Manage Cash & Bank Accounts

**Goal**: User can create, list, and edit bank accounts.
**Test**: Integration test verifying account creation creates GL Account.

- [x] T011 [US1] Implement `createAccount` service method (with GL creation) apps/api/src/modules/cash-bank/cash-bank.service.ts
- [x] T012 [US1] Implement `listAccounts` with balance aggregation apps/api/src/modules/cash-bank/cash-bank.service.ts
- [x] T013 [US1] Implement Account Router endpoints (create, list, get, update) apps/api/src/modules/cash-bank/cash-bank.router.ts
- [x] T014 [US1] Create frontend types and API hooks apps/web/src/features/cash-bank/hooks.ts
- [x] T015 [US1] Create `BankAccountList` component apps/web/src/features/cash-bank/components/BankAccountList.tsx
- [x] T016 [US1] Create `BankAccountForm` modal apps/web/src/features/cash-bank/components/BankAccountForm.tsx
- [x] T017 [US1] Add Cash & Bank page to main navigation apps/web/src/app/router.tsx

## Phase 4: [US2] Record Direct Expense (Spend Money)

**Goal**: User can record and post spend transactions.
**Test**: Integration test verifying SPEND posts to Journal correctly (Credit Bank, Debit Expense).

- [x] T018 [US2] Implement `createTransaction` validation for SPEND apps/api/src/modules/cash-bank/cash-bank.service.ts
- [x] T019 [US2] Implement `postTransaction` logic for SPEND (Journal Mapping) apps/api/src/modules/cash-bank/cash-bank.service.ts
- [x] T020 [US2] Implement Transaction Router endpoints apps/api/src/modules/cash-bank/cash-bank.router.ts
- [x] T021 [US2] Create `SpendMoneyForm` component apps/web/src/features/cash-bank/components/SpendMoneyForm.tsx
- [x] T022 [US2] Create `TransactionList` component apps/web/src/features/cash-bank/components/TransactionList.tsx

## Phase 5: [US3] Record Direct Income (Receive Money)

**Goal**: User can record and post receive transactions.
**Test**: Integration test verifying RECEIVE posts to Journal correctly (Debit Bank, Credit Revenue).

- [x] T023 [US3] Update `createTransaction` validation for RECEIVE apps/api/src/modules/cash-bank/cash-bank.service.ts
- [x] T024 [US3] Update `postTransaction` logic for RECEIVE (Journal Mapping) apps/api/src/modules/cash-bank/cash-bank.service.ts
- [x] T025 [US3] Create `ReceiveMoneyForm` component apps/web/src/features/cash-bank/components/ReceiveMoneyModal.tsx

## Phase 6: [US4] Transfer Funds

**Goal**: User can transfer between internal accounts.
**Test**: Integration test verifying TRANSFER posts to Journal correctly (Credit Source, Debit Dest).

- [x] T026 [US4] Update `createTransaction` validation for TRANSFER apps/api/src/modules/cash-bank/cash-bank.service.ts
- [x] T027 [US4] Update `postTransaction` logic for TRANSFER (Journal Mapping) apps/api/src/modules/cash-bank/cash-bank.service.ts
- [x] T028 [US4] Create `TransferMoneyForm` component apps/web/src/features/cash-bank/components/TransferMoneyModal.tsx

## Phase 7: Polish & Verification

**Goal**: Finalize and verify full module.

- [x] T029 Create Integration Test `cash-bank.test.ts` covering entire flow apps/api/test/integration/cash-bank.test.ts
- [x] T030 UI Polish: Add empty states and loading skeletons apps/web/src/features/cash-bank/components/
- [x] T031 Final manual verification of all flows apps/web

## Dependencies

- Phase 2 depends on Phase 1
- Phase 3, 4, 5, 6 depend on Phase 2
- Phase 4, 5, 6 can run somewhat in parallel but best sequential for shared service logic updates.
- Phase 7 depends on all prior phases.

## Implementation Strategy

1. **MVP Scope**: Phases 1-4 (Accounts + Spend). This covers the most critical business need (paying for things).
2. **Incremental**: Deliver specific forms one by one.
