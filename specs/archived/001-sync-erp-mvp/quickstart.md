# Quickstart: Sync ERP MVP Feature

**Feature**: Sync ERP Multi-Company MVP
**Spec**: [specs/001-sync-erp-mvp/spec.md](spec.md)

## Prerequisites

- Node.js 18+
- PostgreSQL running locally
- npm installed

## Setup

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Database Setup**:
   ```bash
   # In packages/database
   npm run db:generate
   npm run db:push
   ```

## Development

1. **Start Backend**:

   ```bash
   npm run dev --filter=api
   ```

2. **Start Frontend**:
   ```bash
   npm run dev --filter=web
   ```

## Verification Steps (Manual)

### 1. Create Company (Admin)

- POST `/api/companies` with `{ "name": "Acme Corp" }`.
- Verify response contains `id`.
- Save `id` for header `x-company-id`.

### 2. Create Master Data

- POST `/api/products` (Header: `x-company-id: <AcmeID>`)
- POST `/api/partners` (Customer)

### 3. Run Order-to-Cash

- POST `/api/orders` (Type: SALES)
- Check Inventory (should be reserved)
- POST `/api/invoices` (from Order)
- POST `/api/payments`
