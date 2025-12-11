# Phase 0: Research & Decisions

## Decision 1: Journal Entry Linking Strategy

**Context**: Auto-generated journals need to link back to the source document (Shipment or Adjustment) for audit trails (`FR-005`).
**Options**:

1.  Add polymorphic relations (`model relatedId`, `relatedType`) to `JournalEntry`.
2.  Add specific FK columns (`shipmentId`, `adjustmentId`) to `JournalEntry`.
3.  Use existing `reference` string column.

**Decision**: Option 3 (Use `reference` string).
**Rationale**:

- **Simplicity**: No schema migration required.
- **Flexibility**: `reference` field is already designed for "Human Readable + ID" correlation.
- **Consistency**: Current Invoice/Bill journals use this pattern (e.g., "Invoice: INV-1001").
- **Format**: Will use structured prefix, e.g., `Shipment: {id}` or `Adjustment: {id}`.

## Decision 2: Cost Snapshot

**Context**: Users want to record COGS at the time of shipment (`FR-001`). `Product.averageCost` changes over time.
**Question**: Do we need to store `unitCost` in `InventoryMovement`?
**Decision**: No. rely on the Journal Entry.
**Rationale**:

- The Journal Entry _is_ the financial record. It stores the exact Debit/Credit amount.
- `Amount / Quantity` = Implied Unit Cost.
- Storing it twice (Movement and Journal) risks data drift.
- **Constraint**: This assumes Journals are immutable (Standard Accounting Practice).

## Decision 3: "System Accounts" Handling

**Context**: The logic requires specific GL Accounts (e.g., 1400 Inventory, 5000 COGS).
**Risk**: If these don't exist in the user's Company DB, the transaction fails.
**Decision**: Strict Block (`FR-003`).
**Rationale**:

- Creating accounts on the fly is dangerous (might duplicate or mess up CoA structure).
- Warns user they must set up Finance before operations.
- **Mitigation**: Ensure Seed script includes these standard accounts.

## Decision 4: Inventory Adjustment Account

**Context**: Stock adjustments need a contra account.
**Decision**: Use Account Code `5200` (Inventory Shrinkage/Adjustment).
**Rationale**:

- Standardizing on `5200` avoids ambiguity in the spec (`5xxx`).
- This account acts as an Expense for stock loss and a Contra-Expense (or Revenue) for stock gain.
