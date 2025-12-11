# Quickstart: Finance Integration

## Overview

This feature automates COGS and Inventory Asset adjustments.

## Prerequisites

- **Database**: Must be seeded with standard Chart of Accounts (specifically codes `1400` and `5000`).
- **Server**: Run `npm run dev:api`.

## Verification Steps (Manual)

1.  **Check Accounts**:
    ```bash
    # Open Prisma Studio or DB client
    SELECT * FROM "Account" WHERE code IN ('1400', '5000');
    ```
2.  **Create Shipment**:
    - Login as Admin.
    - Go to Sales -> New Order. Add Item. Confirm.
    - Click "Fulfill" / "Ship".
3.  **Verify Journal**:
    - Go to Finance -> Journal Entries.
    - Look for latest entry with Reference `Shipment: ...`.
    - Verify Debit COGS / Credit Inventory.

## Automated Tests

Run the integration test suite:

```bash
npm test apps/api/test/integration/finance-automation.test.ts
```

(Note: Test file to be created in implementation phase)
