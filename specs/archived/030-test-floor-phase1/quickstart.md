# Quickstart: Phase 1 Test Floor

How to run the new test suites for Feature 030.

## 1. Run Invariant Tests

Checks the database state for any corruption or invariant violations.

```bash
# From apps/api
npm run test:invariants
```

## 2. Run Saga Compliance Tests

Verifies that Sagas obey the "Golden Rules" (Success, Fail/Compensate, Idempotency).

```bash
# Specific Sagas
npx vitest run unit/modules/accounting/t025_bill_posting_saga.test.ts
npx vitest run unit/modules/accounting/t026_payment_posting_saga.test.ts
```

## 3. Run Policy Tests

Fast, pure logic verification.

```bash
# All policy tests
npx vitest run ".*\.policy\.test\.ts"
```
