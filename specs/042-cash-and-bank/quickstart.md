# Quickstart: Cash and Bank

## 1. Database Setup

1. **Schema Migration**:

   ```bash
   # Apply schema changes (BankAccount, CashTransaction)
   npx turbo db:push
   # OR
   npx turbo db:migrate --name 042_cash_and_bank
   ```

2. **Seed Data**:
   Ensure Chart of Accounts includes standard Cash/Bank accounts.
   ```bash
   packages/database/prisma/seed.ts
   ```
   Add:
   - `1101` - Cash on Hand
   - `1102` - Petty Cash
   - `1201` - BCA Corporate

## 2. API Implementation Order

1. **Scaffold Module**:
   Create `apps/api/src/modules/cash-bank/`.
2. **Implement Repository**:
   `cash-bank.repository.ts` (CRUD for BankAccount, CashTransaction).
3. **Implement Service**:
   `cash-bank.service.ts`.
   - Implement `createAccount`, `updateAccount`.
   - Implement `createTransaction` (Validation).
   - Implement `postTransaction` (Call JournalService).
4. **Implement Controller**:
   `cash-bank.controller.ts`.

## 3. Frontend Implementation Order

1. **Types**:
   Generate types from shared schema.
2. **Bank Account List**:
   UI to list/add/edit accounts.
3. **Transaction List**:
   UI to list operational transactions.
4. **Transaction Forms**:
   - Spend Money Form (with splits).
   - Receive Money Form (with splits).
   - Transfer Form (Source -> Dest).

## 4. Verification

Run integration test:

```bash
npm test apps/api/test/integration/cash-bank.test.ts
```

Expected flow:

1. Create Bank Account.
2. Create Spend Transaction (Draft).
3. Post Transaction -> Verify Journal Entry Created.
4. Verify Bank Balance reduced.
