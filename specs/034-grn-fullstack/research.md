# Research: 034-grn-fullstack

**Status**: Done
**Created**: 2025-12-18

## Unknowns & Decisions

### 1. Partial Receipt/Delivery Logic

- **Question**: How to handle partial quantities?
- **Decision**: PO/SO Item status will track `qtyReceived` / `qtyShipped`.
- **Reasoning**: Necessary for accurate 'remaining' calculation. PO open until strictly `qtyReceived >= qtyOrdered`.

### 2. Concurrent Transactions

- **Question**: Race conditions on stock levels?
- **Decision**: Use `prisma.$transaction`.
- **Reasoning**: Standard practice. Optimistic locking on Item version not needed for MVP, strict DB transaction sufficient for now.

### 3. Cost Snapshot

- **Question**: When to capture cost for Shipment?
- **Decision**: At the moment of `Shipment` posting (Stock OUT).
- **Reasoning**: COGS must reflect the cost of inventory _at the time it left the building_, regardless of later cost changes.

## Best Practices Checklist

- [x] **P2P/O2C Symmetry**: Naming conventions `GoodsReceipt` / `Shipment` mirror each other.
- [x] **Stock Journal**: Centralized ledger for all movements.
