# Quickstart: E2E Business Flows

## Prerequisites

- Database running (`npm run db:up`)
- Prisma client generated (`npm run db:generate`)
- Seeder run via API (`./scripts/seed-via-api.sh`)

## Verification Steps (O2C)

### 1. Confirm Sales Order

```bash
curl -X POST http://localhost:3000/api/sales/orders/{id}/confirm \
  -H "X-Company-Id: {companyId}" \
  -H "X-Correlation-Id: $(uuidgen)"
```

### 2. Post Invoice (Saga)

```bash
curl -X POST http://localhost:3000/api/accounting/invoices/{id}/post \
  -H "X-Company-Id: {companyId}" \
  -H "X-Correlation-Id: $(uuidgen)"
```

### 3. Apply Payment

```bash
curl -X POST http://localhost:3000/api/accounting/payments \
  -H "X-Company-Id: {companyId}" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "{id}",
    "amount": 1000,
    "method": "CASH",
    "date": "2025-12-18"
  }'
```

## Monitoring

- **Saga Trace**: `SELECT * FROM "SagaLog" WHERE "correlationId" = '{correlationId}';`
- **Audit Log**: Check `JournalEntry` references link back to `sourceId`.
