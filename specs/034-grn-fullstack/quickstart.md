# Quickstart: GRN & Shipment Features

## Overview

This feature introduces explicit physical inventory documents: `GoodsReceipt` (Inbound) and `Shipment` (Outbound), mirroring the financial `Bill` and `Invoice` documents.

## Key Flows

### 1. Receive Goods (P2P)

```typescript
// Service
inventoryService.createGoodsReceipt({
  purchaseOrderId: 'po-123',
  items: [{ productId: 'p-1', quantity: 10 }],
});

// Post (Stock IN)
inventoryService.postGoodsReceipt('grn-id');
```

### 2. Ship Goods (O2C)

```typescript
// Service
inventoryService.createShipment({
  salesOrderId: 'so-123',
  items: [{ productId: 'p-1', quantity: 5 }],
});

// Post (Stock OUT + Cost Snapshot)
inventoryService.postShipment('shp-id');
```

## Testing

Run the full integration suites:

```bash
npm test apps/api/test/integration/p2p-flow.test.ts
npm test apps/api/test/integration/o2c-flow.test.ts
```
