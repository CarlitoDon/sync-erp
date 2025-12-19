# Data Model: 034-grn-fullstack

## Entities

### GoodsReceipt (GRN)

Represents a physical receipt of goods against a Purchase Order.

| Field           | Type          | Required | Description                   |
| :-------------- | :------------ | :------- | :---------------------------- |
| id              | String (UUID) | Yes      | PK                            |
| companyId       | String (UUID) | Yes      | Multi-tenant isolation        |
| purchaseOrderId | String (UUID) | Yes      | FK to PurchaseOrder           |
| number          | String        | Yes      | Auto-generated (GRN-2025-001) |
| date            | DateTime      | Yes      | Date of receipt               |
| status          | Enum          | Yes      | `DRAFT`, `POSTED`, `VOID`     |
| notes           | String        | No       | Optional remarks              |
| createdAt       | DateTime      | Yes      | Audit                         |
| updatedAt       | DateTime      | Yes      | Audit                         |

### GoodsReceiptItem

Line items for the GRN.

| Field               | Type          | Required | Description            |
| :------------------ | :------------ | :------- | :--------------------- |
| id                  | String (UUID) | Yes      | PK                     |
| goodsReceiptId      | String (UUID) | Yes      | FK to GoodsReceipt     |
| productId           | String (UUID) | Yes      | FK to Product          |
| quantity            | Decimal       | Yes      | Qty actually received  |
| purchaseOrderItemId | String (UUID) | Yes      | FK to original PO Line |

### Shipment (Delivery Note)

Represents a physical shipment of goods against a Sales Order.

| Field        | Type          | Required | Description                   |
| :----------- | :------------ | :------- | :---------------------------- |
| id           | String (UUID) | Yes      | PK                            |
| companyId    | String (UUID) | Yes      | Multi-tenant isolation        |
| salesOrderId | String (UUID) | Yes      | FK to SalesOrder              |
| number       | String        | Yes      | Auto-generated (SHP-2025-001) |
| date         | DateTime      | Yes      | Date of shipment              |
| status       | Enum          | Yes      | `DRAFT`, `POSTED`, `VOID`     |
| notes        | String        | No       | Optional remarks              |

### ShipmentItem

Line items for the Shipment.

| Field            | Type          | Required | Description                                       |
| :--------------- | :------------ | :------- | :------------------------------------------------ |
| id               | String (UUID) | Yes      | PK                                                |
| shipmentId       | String (UUID) | Yes      | FK to Shipment                                    |
| productId        | String (UUID) | Yes      | FK to Product                                     |
| quantity         | Decimal       | Yes      | Qty actually shipped                              |
| salesOrderItemId | String (UUID) | Yes      | FK to original SO Line                            |
| costSnapshot     | Decimal       | No       | Unit cost at time of shipment (Populated on POST) |

## Prisma Schema Changes

```prisma
model GoodsReceipt {
  id              String   @id @default(uuid())
  companyId       String
  purchaseOrderId String
  number          String
  date            DateTime
  status          String   @default("DRAFT") // DRAFT, POSTED, VOID
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  company         Company       @relation(fields: [companyId], references: [id])
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
  items           GoodsReceiptItem[]

  @@index([companyId])
  @@index([purchaseOrderId])
}

model GoodsReceiptItem {
  id                  String   @id @default(uuid())
  goodsReceiptId      String
  productId           String
  quantity            Decimal  @db.Decimal(10, 2)
  purchaseOrderItemId String

  goodsReceipt        GoodsReceipt @relation(fields: [goodsReceiptId], references: [id])
  product             Product      @relation(fields: [productId], references: [id])
  purchaseOrderItem   PurchaseOrderItem @relation(fields: [purchaseOrderItemId], references: [id])
}

model Shipment {
  id           String   @id @default(uuid())
  companyId    String
  salesOrderId String
  number       String
  date         DateTime
  status       String   @default("DRAFT") // DRAFT, POSTED, VOID
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  company      Company    @relation(fields: [companyId], references: [id])
  salesOrder   SalesOrder @relation(fields: [salesOrderId], references: [id])
  items        ShipmentItem[]

  @@index([companyId])
  @@index([salesOrderId])
}

model ShipmentItem {
  id               String   @id @default(uuid())
  shipmentId       String
  productId        String
  quantity         Decimal  @db.Decimal(10, 2)
  salesOrderItemId String
  costSnapshot     Decimal? @db.Decimal(15, 2) // COGS snapshot

  shipment         Shipment @relation(fields: [shipmentId], references: [id])
  product          Product  @relation(fields: [productId], references: [id])
  salesOrderItem   SalesOrderItem @relation(fields: [salesOrderItemId], references: [id])
}
```
