# Research: Stock Compensation Strategy

**Feature**: Stock Compensation for Saga Rollback (B2)
**Date**: 2025-12-16

## Decision: Use `InventoryService.processReturn()`

**Context**: When `InvoicePostingSaga` fails after shipping goods, we must reverse the stock movement. The original shipment also posts a COGS journal.

**Findings**:

- `InventoryService.processShipment` creates OUT movements AND posts a COGS journal.
- `InventoryService.processReturn` creates IN movements AND posts a Reversal journal (if COGS was posted).
- `InvoicePostingSaga` currently processes the _entire_ order shipment.

**Decision**:
We will use `InventoryService.processReturn()` to handle compensation because it correctly reverses both the stock quantity and the financial impact (COGS), maintaining full system integrity.

**Rationale**:

- **Simplicity**: Reuses existing, tested business logic for returns.
- **Completeness**: Handles both physical (stock) and financial (journal) reversal.
- **Consistency**: Mirrors the forward flow (`processShipment`).

## Alternatives Considered

### 1. Manual Stock Adjustment

- **Description**: Manually create IN movements in the saga using repository.
- **Pros**: precise control.
- **Cons**: complicated; would likely miss the COGS reversal journal, leading to accounting discrepancy.

### 2. New `reverseShipment` Method

- **Description**: Create specific `reverseShipment` method in InventoryService.
- **Pros**: tailored naming.
- **Cons**: redundant; `processReturn` already does exactly this (conceptually, a failed shipment roll-back is a forced return).

## Implementation Details

- **Saga Context**: Need to store `orderId` in `stepData` to pass to `processReturn`.
- **Items**: Need to fetch Order Items to pass to `processReturn`. We will fetch the Order using `SalesRepository` (or `InvoiceRepository` if it has mapped access) to get the items.
