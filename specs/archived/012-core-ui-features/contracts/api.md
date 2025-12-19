# API Contracts

## Inventory

### Process Goods Receipt

- **Endpoint**: `POST /api/inventory/goods-receipt`
- **Body**: `GoodsReceiptSchema` (from Shared)
  ```json
  {
    "purchaseOrderId": "uuid",
    "items": [
      { "productId": "uuid", "quantity": 10, "locationId": "uuid?" }
    ]
  }
  ```

### Adjust Stock

- **Endpoint**: `POST /api/inventory/adjust`
- **Body**: `StockAdjustmentSchema` (from Shared)
  ```json
  {
    "productId": "uuid",
    "quantity": 5,
    "type": "INCREMENT" | "DECREMENT" | "SET",
    "reason": "Damage"
  }
  ```

## Payments

### Get Payment History

- **Endpoint**: `GET /api/payments/invoice/:invoiceId`
- **Response**: Array of Payment records
  ```json
  [
    {
      "id": "uuid",
      "amount": 100.0,
      "date": "ISO-Date",
      "method": "CASH",
      "reference": "REF-001"
    }
  ]
  ```

## Users

### Invite User

- **Endpoint**: `POST /api/users` (mapped to `invite`)
- **Body**: `InviteUserSchema`
  ```json
  {
    "email": "user@example.com",
    "name": "John Doe",
    "roleId": "uuid?"
  }
  ```

### Assign User

- **Endpoint**: `POST /api/users/:userId/assign`
- **Body**: `AssignUserSchema`
  ```json
  {
    "userId": "uuid", // Required by Zod schema despite URL param
    "roleId": "uuid?"
  }
  ```
