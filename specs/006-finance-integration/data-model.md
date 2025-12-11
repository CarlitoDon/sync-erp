# Phase 1: Data Model

## Existing Models

No new database tables or columns are required. This feature utilizes the existing schema.

### InventoryMovement

- **Source**: `packages/database/prisma/schema.prisma`
- **Usage**: Triggers the journal creation logic.
- **Key Fields**:
  - `id`: Used for reference.
  - `productId`: To fetch average cost.
  - `quantity`: Multiplier for cost.
  - `type`: `IN` (returns) or `OUT` (shipments).

### JournalEntry

- **Source**: `packages/database/prisma/schema.prisma`
- **Usage**: Records the financial impact.
- **Key Fields**:
  - `reference`: Stores `Shipment: {id}` or `Adjustment: {id}`.
  - `lines`: Contains the DR/CR pairs.

## Logic Mapping

| Event                         | Journal Reference | Debit Account         | Credit Account        | Amount         |
| :---------------------------- | :---------------- | :-------------------- | :-------------------- | :------------- |
| **Sales Shipment** (Outbound) | `Shipment: {id}`  | COGS (5000)           | Inventory (1400)      | Qty \* AvgCost |
| **Sales Return** (Inbound)    | `Return: {id}`    | Inventory (1400)      | COGS (5000)           | Qty \* AvgCost |
| **Stock Loss** (Adjustment)   | `Adj: {id}`       | Inv Adjustment (5xxx) | Inventory (1400)      | Qty \* AvgCost |
| **Stock Gain** (Adjustment)   | `Adj: {id}`       | Inventory (1400)      | Inv Adjustment (5xxx) | Qty \* AvgCost |
