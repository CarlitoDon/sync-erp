# Data Model

## Inventory

mapped from `apps/api/src/modules/inventory/*`

**StockLevel**

- `product`: Product
- `quantity`: Int
- `location`: Location?

**InventoryMovement**

- `type`: "RECEIPT" | "ADJUSTMENT" | "SALE" | "RETURN"
- `quantity`: Int
- `reference`: String (PO Number or Reason)

## Finance

**Payment**

- `id`: UUID
- `invoiceId`: UUID
- `amount`: Decimal
- `date`: DateTime
- `method`: Enum (CASH, BANK_TRANSFER, etc.)

## Users

**User**

- `id`: UUID
- `email`: String
- `name`: String
- `companies`: Company[]

**UserRole**

- `userId`: UUID
- `companyId`: UUID
- `role`: Enum?
