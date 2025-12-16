# Quickstart: Stock Compensation Dev

**Feature**: Fix B2 Stock Compensation

## Prerequisites

- Local DB running
- `npm install`

## Key Files

- `apps/api/src/modules/accounting/sagas/invoice-posting.saga.ts` (Logic location)
- `apps/api/src/modules/inventory/inventory.service.ts` (Reversal logic provider)

## Running Tests

```bash
# Run new compensation test
cd apps/api && npm test -- -t "stock_compensation"

# Run existing saga tests (ensure no regression)
cd apps/api && npm test -- -t "InvoicePostingSaga"
```
