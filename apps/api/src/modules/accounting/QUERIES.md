# Accounting Module SQL Queries

## Invariant Checks (G7)

### 1. Journal Entry Balance

Ensure all posted journal entries sum to zero (Debits = Credits).

```sql
SELECT "journalId", SUM(debit) as debits, SUM(credit) as credits
FROM "JournalLine"
GROUP BY "journalId"
HAVING ABS(SUM(debit) - SUM(credit)) > 0.01;
```

### 2. Invoice State Consistency

Ensure POSTED invoices have generated a Journal Entry.

```sql
SELECT i.id, i.status, i."invoiceNumber"
FROM "Invoice" i
LEFT JOIN "JournalEntry" je ON i.id = je."sourceId" AND je."sourceType" = 'INVOICE'
WHERE i.status = 'POSTED' AND je.id IS NULL;
```

### 3. Payment Balance Integrity

Ensure Payment amount on Invoice does not exceed Invoice Total (if no overpayment allowed).
_Note: This is a soft invariant as overpayments might be allowed features._

```sql
-- Check for negative balances (overpaid)
SELECT id, "invoiceNumber", balance, amount
FROM "Invoice"
WHERE balance < 0;
```

### 4. Business Date Validity (G5)

Detect records with future business dates (allow 5 min skew).

```sql
-- Journal Entries in future
SELECT id, reference, date
FROM "JournalEntry"
WHERE date > NOW() + INTERVAL '5 minutes';
```
