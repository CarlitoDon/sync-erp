# Research: Cash and Bank Architecture

**Feature**: `042-cash-and-bank`
**Date**: 2026-01-06

## Decisions

### 1. Data Model Strategy: Separate `CashTransaction` Model

**Question**: Should we store operational transactions (Spend, Receive, Transfer) directly as `JournalEntry` or as a separate `CashTransaction` model?

**Decision**: **Separate `CashTransaction` Model**.

**Rationale**:

- **User Intent**: Users think in terms of "Paying Vendor X" or "Buying Office Supplies", not "Debiting Expense/Crediting Asset".
- **Metadata**: We need to store `payee`, `notes`, and `status` (Draft/Posted) which don't fit well in a strict `JournalEntry`.
- **Editability**: `CashTransaction` can be drafted and edited. `JournalEntry` is immutable once posted.
- **Traceability**: `CashTransaction` will have a `journalEntryId` to link to the GL.

### 2. Bank Account Identification

**Question**: How do we distinguish "Cash/Bank" accounts from other "Asset" accounts (like Inventory)?

**Decision**: **New `BankAccount` Model (1:1 with `Account`)**.

**Rationale**:

- `Account` type `ASSET` is too broad (includes Inventory, Fixed Assets, Accounts Receivable).
- We need to strictly limit the "Source" (for Spend) and "Destination" (for Receive) to liquid accounts.
- `BankAccount` table will store:
  - `companyId`
  - `accountId` (FK to `Account`)
  - `bankName` (e.g., "BCA", "Petty Cash")
  - `accountNumber` (optional)
  - `currency` (for future use, default IDR)

### 3. Transaction Types & Flow

**Decision**: Implement 3 distinct transaction types handled by `CashTransaction` model.

- **SPEND**:
  - Decrease `BankAccount` (Credit).
  - Increase Allocation Accounts (Debit Expense/Liability).
- **RECEIVE**:
  - Increase `BankAccount` (Debit).
  - Increase Allocation Accounts (Credit Revenue/Equity/Asset).
- **TRANSFER**:
  - Decrease Source `BankAccount` (Credit).
  - Increase Destination `BankAccount` (Debit).

**Flow**:

1. User creates `CashTransaction` (Status: DRAFT).
2. User posts `CashTransaction`.
3. Service validates.
4. Service calls `JournalService.create()`.
5. `CashTransaction` updated with `journalEntryId` and `status: POSTED`.

### 4. Idempotency Scope

**Decision**: Add `CASH_TRANSACTION_POST` to `IdempotencyScope` enum.

## Alternatives Considered

- **Using `JournalEntry` direct**: Rejected. Too technical for users, hard to edit drafts.
- **Flags on `Account`**: Adding `isBank` boolean. Rejected. `BankAccount` table allows storing extra bank-specific details (account number, SWIFT code) without polluting the generic Ledger `Account` table.
