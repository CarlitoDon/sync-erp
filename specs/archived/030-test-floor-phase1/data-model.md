# Data Model Invariants: Feature 030

**Phase 1 Test Floor** does not introduce new entities. Instead, it enforces strict constraints (Invariants) on existing entities.

## Invariant Rules

The following rules must be true at ALL TIMES (after any Saga or Transaction).

### 1. Finance (Invoice & Payment)

| Entity    | Field     | Constraint                | Rationale                                                                              |
| :-------- | :-------- | :------------------------ | :------------------------------------------------------------------------------------- |
| `Invoice` | `balance` | `>= 0`                    | Negative balance implies overpayment without Credit Note, which is illegal in Phase 1. |
| `Invoice` | `amount`  | `== subtotal + taxAmount` | Basic arithmetic integrity.                                                            |

### 2. Inventory (Product & Stock)

| Entity    | Field         | Constraint | Rationale                                                                                |
| :-------- | :------------ | :--------- | :--------------------------------------------------------------------------------------- |
| `Product` | `stockQty`    | `>= 0`     | Negative stock is physically impossible and indicates shipment without stock allocation. |
| `Product` | `averageCost` | `>= 0`     | Cost cannot be negative.                                                                 |

### 3. Accounting (Journal Entry)

| Entity         | Field      | Constraint                     | Rationale                                                                  |
| :------------- | :--------- | :----------------------------- | :------------------------------------------------------------------------- |
| `JournalEntry` | `lines`    | `Sum(debit) == Sum(credit)`    | Double-entry bookkeeping fundamental law.                                  |
| `JournalEntry` | `sourceId` | `UNIQUE(sourceType, sourceId)` | Prevent double-posting of the same document (enforced by DB Unique Index). |

## Validation Implementation

These rules will be enforced by the **Invariant Test Suite** (`apps/api/test/invariants`), which runs SQL/Prisma aggregates to detect violations across the entire dataset.
