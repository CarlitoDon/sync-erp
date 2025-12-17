# Data Model: Phase 1 Flow Completeness

> **Note**: This feature uses existing entities. No schema changes required.

## Involved Entities

### Procurement

- **PurchaseOrder**: Source of GRN.
- **StockMovement**: Created by GRN.

### Accounting

- **Bill**: Vendor Invoice (AP).
- **Invoice**: Sale Invoice (AR).
- **Payment**: Cash transaction.
- **CreditNote**: Reversal.
- **JournalEntry**: GL record.
