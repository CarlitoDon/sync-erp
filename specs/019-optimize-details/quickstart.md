# Quickstart: Testing Enhanced Details

## Running the App

```bash
cd apps/web
npm run dev
```

## Verification Steps

### 1. Sales Order Links

1. Navigate to **Sales > Orders**.
2. Open an Order that has an Invoice.
3. Check **Related Documents** section.
4. Click the **Invoice Number**.
5. Verify navigation to Invoice Detail.
6. Click **Customer Name** in header.
7. Verify navigation to **Customer Detail**.

### 2. Product Drill-Down

1. On Sales Order Detail, look at **Items Table**.
2. Click a **Product Name**.
3. Verify navigation to **Product Detail**.
4. Check stock level displayed.

### 3. Journal Audit

1. Navigate to **Finance > Journal Entries**.
2. Click an entry ID/Reference.
3. Verify navigation to **Journal Detail**.
