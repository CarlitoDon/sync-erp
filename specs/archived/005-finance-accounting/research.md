# Research: Finance Module Implementation

**Feature**: Complete Finance & Accounting
**Status**: Completed

## 1. Journal Entry Auto-Generation Strategy

**Context**: Requirements state that journal entries must be generated automatically when invoices are posted or payments recorded to ensure double-entry compliance.

**Options Evaluated**:

1. **Synchronous Transaction**: Wrap the business action (e.g., Invoice Post) + Journal Creation in a single `prisma.$transaction`.
2. **Asynchronous Event Bus**: Emit event -> Consumer creates journal.
3. **Trigger-based**: DB triggers creates entries.

**Decision**: **Option 1 (Synchronous Transaction)**

**Rationale**:

- **Data Integrity**: Absolute requirement. Providing "posted" invoice without "journal entry" leaves books unbalanced. Transaction ensures all-or-nothing.
- **Simplicity**: MVP scale doesn't require queue complexity.
- **Latency**: Single transaction with <10 inserts is well within 500ms target.

## 2. Financial Reporting Aggregation

**Context**: Generating Income Statement (Period-based) and Balance Sheet (Point-in-time cumulative).

**Options Evaluated**:

1. **Database-side Aggregation (Raw SQL)**: Complex queries to sum definitions.
2. **Application-side Aggregation**: Fetch flat journal lines -> Reduce in JS.
3. **Materialized Views**: Store pre-calculated balances.

**Decision**: **Option 2 (Application-side Aggregation)**

**Rationale**:

- **Type Safety**: Prisma typed results vs `any` from raw SQL.
- **Flexibility**: Easier to handle custom filtering, date logic, and formatting in TS.
- **Performance**: Fetching filtered journal lines for a company is fast enough for <100k rows. If scale grows, move to Option 3.

## 3. Account Type Mapping

**Context**: Mapping system actions to specific accounts (e.g. Sales -> Revenue Account).

**Approach**:

- **Hardcoded System Accounts**: Seed specific "System Accounts" (Accounts Receivable, Accounts Payable, Sales Revenue, Inventory Asset, COGS).
- **Lookup Config**: Look up these accounts by `type` or reserved `code` range when auto-posting.
- **Decision**: Use **Account Type + Code Convention** lookup. e.g., Find account where `type=ASSET` and `code` starts with '12' for AR. For MVP, we will rely on seeded default accounts mapping.
