# Data Model: Stock Compensation

**Feature**: Stock Compensation for Saga Rollback (B2)

## Schema Changes

_No database schema changes required._

## Entity Usage

### InvoicePostingSaga (Modifications)

- **Context (`PostingContext`)**:
  - `stepData.stockMovementId`: Existing. Used to flag if compensation needed.
  - `stepData.orderId`: **NEW**. To be stored during execution to facilitate easy compensation (avoiding re-lookup of invoice if possible, though invoice lookup is cheap).

### InventoryService

- **InventoryMovement**:
  - **IN** movements created during compensation.
  - `reference`: Will be set to "Saga compensation for [EntityID]" or similar.

- **JournalEntry**:
  - **Reversal** journal created for COGS reversal.
  - `reference`: Linked to original order.
