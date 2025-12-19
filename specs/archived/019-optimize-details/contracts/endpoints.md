# API Contracts

This feature relies on existing REST endpoints. No new contracts defined.

## Reused Endpoints

### Partners

- `GET /api/partners/:id`: Get Partner details.
- `GET /api/sales/orders?partnerId=:id`: Get Sales History.
- `GET /api/procurement/orders?partnerId=:id`: Get Purchase History.

### Products

- `GET /api/products/:id`: Get Product details.
- `GET /api/products/:id/stock`: Get Stock levels.

### Transactions

- `GET /api/sales/orders/:id`: Sales Order Detail.
- `GET /api/procurement/orders/:id`: Purchase Order Detail.
- `GET /api/finance/invoices/:id`: Invoice Detail.
- `GET /api/finance/bills/:id`: Bill Detail.

### Accounting

- `GET /api/accounting/journals/:id`: Journal Entry Detail.
