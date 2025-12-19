# Quickstart: Domain Contract Stabilization

**Feature**: 028-domain-contract-stabilization
**Focus**: Backend Logic Verification

## 1. How to Verify Contracts

This feature has no UI. Verification is done via tests and logs.

### 1.1 Run Unit Tests

Verify policy logic and state machines:

```bash
# Run all domain tests
npx vitest apps/api/src/modules/accounting
npx vitest apps/api/src/modules/sales
npx vitest apps/api/src/modules/procurement
```

### 1.2 Verify Invariants (Manual)

1.  Posted an Invoice via API (Postman/Curl).
2.  Check Logs for transition:
    ```bash
    grep "StateTransition" apps/api/logs/app.log
    ```
3.  Verify Journal creation in DB:
    ```sql
    SELECT count(*) FROM "JournalEntry" WHERE "sourceId" = 'YOUR_INVOICE_ID';
    ```

## 2. Common Errors

| Error Code         | Meaning                              | Action                                   |
| ------------------ | ------------------------------------ | ---------------------------------------- |
| `MUTATION_BLOCKED` | Entity is POSTED/VOID                | Create Credit Note or new Invoice        |
| `INVALID_STATE`    | Illegal transition (e.g. DRAFT→PAID) | Follow state machine (DRAFT→POSTED→PAID) |
| `SHAPE_PENDING`    | Company has no BusinessShape         | Set shape in `Company` table             |

## 3. Development Workflow

1.  Modify `policy.ts` to add new constraints.
2.  Run tests: `npm run test`
3.  Check `ENTRY_GATE.md` compliance.
