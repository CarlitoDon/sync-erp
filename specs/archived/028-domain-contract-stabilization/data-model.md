# Data Model: Domain Contract Stabilization

**Feature**: Domain Contract Stabilization
**Schema**: Prisma + Zod
**Status**: DRAFT

## 1. Core Entities & State Machines

### 1.1 Invoice & Bill (Financial Documents)

**States**: `DRAFT` → `POSTED` → `PAID` → `VOID`

| State  | Allowed Transitions      | Guard Conditions                    | Side Effects                                           |
| ------ | ------------------------ | ----------------------------------- | ------------------------------------------------------ |
| DRAFT  | POSTED, VOID             | Valid lines, `businessDate` present | Creates Journal Entries, Updates Stock (if applicable) |
| POSTED | PAID, VOID (Credit Note) | `balance == 0` (for PAID)           | Locks mutation, allows Payments                        |
| PAID   | VOID (Credit Note)       | None                                | Fully settled                                          |
| VOID   | None                     | Terminal                            | Reverses Journals (if previously POSTED)               |

**Invariants**:

- `balance = total - paidAmount`
- `balance >= 0` (Non-negative check)

### 1.2 Sales & Purchase Order (Logistical Documents)

**States**: `DRAFT` → `CONFIRMED` → `COMPLETED` | `CANCELLED`

| State     | Allowed Transitions  | Guard Conditions        | Side Effects                                        |
| --------- | -------------------- | ----------------------- | --------------------------------------------------- |
| DRAFT     | CONFIRMED, CANCELLED | Valid lines             | Reserves Stock (sales), Pending Incoming (purchase) |
| CONFIRMED | COMPLETED, CANCELLED | Fully Invoiced/Received | Updates Stock Levels                                |
| COMPLETED | None                 | Terminal Positive       | None                                                |
| CANCELLED | None                 | Terminal Negative       | Releases Stock Reservations                         |

**Invariants**:

- `quantity >= 0` for all items
- `taxRate` must be explicit

### 1.3 Journal Entry (Immutable Ledger)

**Role**: Single source of truth for financial reality.

**Structure**:

```prisma
model JournalEntry {
  id         String
  date       DateTime // businessDate
  sourceType JournalSourceType // Invoice, Payment, etc.
  sourceId   String // UUID of source
  lines      JournalLine[]
}
```

**Invariants**:

- `SUM(debit) == SUM(credit)` per entry
- Uniqueness: `(companyId, sourceType, sourceId)`

## 2. Invariant SQL Verification

### 2.1 Invoice Balance

```sql
SELECT id FROM "Invoice"
WHERE "totalAmount" - "paidAmount" < 0
AND "status" != 'VOID';
-- Should return 0 rows
```

### 2.2 Journal Balance

```sql
SELECT "journalEntryId", SUM("debit") - SUM("credit") as diff
FROM "JournalLine"
GROUP BY "journalEntryId"
HAVING SUM("debit") - SUM("credit") != 0;
-- Should return 0 rows
```

### 2.3 Stock Non-Negative

```sql
SELECT "productId", "stockQty"
FROM "Product"
WHERE "stockQty" < 0;
-- Should return 0 rows (unless Policy exception)
```

## 3. Policy Constraints

| Policy          | Shape: RETAIL        | Shape: SERVICE     | Shape: MANUFACTURING |
| --------------- | -------------------- | ------------------ | -------------------- |
| **Inventory**   | Strict Stock >= 0    | No Stock Checks    | WIP Allowed          |
| **Sales**       | Requires Deliverable | Service Items Only | BOM Validation       |
| **Procurement** | PO Required          | PO Optional        | PO + QC Required     |

## 4. Schema Updates (Phase 1)

1.  **Add `businessDate`** to DTOs for `Invoice`, `Bill`, `Payment`.
2.  **Enforce Defaults**: `businessDate = now()` if missing at API boundary.
