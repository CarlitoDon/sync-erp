# API Contracts: Frontend Improvements

**Feature**: 039-frontend-improvements  
**Date**: December 29, 2025

---

## Overview

This is a **frontend-only** feature. No API changes are required.

---

## Existing APIs Used (Unchanged)

The lazy-loaded pages continue to use the same tRPC endpoints:

### Procurement
- `trpc.partner.list` - List suppliers
- `trpc.purchaseOrder.list` - List purchase orders
- `trpc.purchaseOrder.get` - Get purchase order details

### Sales
- `trpc.partner.list` - List customers
- `trpc.salesOrder.list` - List sales orders
- `trpc.salesOrder.get` - Get sales order details

### Accounting
- `trpc.invoice.list` - List invoices
- `trpc.bill.list` - List bills
- `trpc.payment.list` - List payments

### Inventory
- `trpc.product.list` - List products
- `trpc.inventory.getStock` - Get stock levels
- `trpc.goodsReceipt.list` - List goods receipts

---

## Query Caching Behavior

### Default (All Queries)
```typescript
{
  staleTime: 30_000,  // 30 seconds
  gcTime: 300_000,    // 5 minutes
  refetchOnWindowFocus: false,
  retry: 1
}
```

### Recommended Overrides

| Query | staleTime | Reason |
|-------|-----------|--------|
| `inventory.getStock` | 5_000 (5s) | Real-time stock accuracy |
| `product.list` | 60_000 (1m) | Rarely changes |
| `partner.list` | 60_000 (1m) | Rarely changes |

---

## No New Endpoints

This feature focuses on:
1. Error handling (frontend only)
2. Modal dialogs (frontend only)
3. Code splitting (frontend only)
4. Query caching (frontend configuration only)
