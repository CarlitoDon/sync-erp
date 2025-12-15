# Data Model: Enhanced Detail Pages

**Status**: No Schema Changes Required.
**Description**: This feature purely consumes existing entities.

## Entities Consumed

### Partner (Existing)

- `getById(id)`: Used for `CustomerDetail` and `SupplierDetail`.
- **History**: Consumes `Order[]` and `Invoice[]` lists filtered by `partnerId`.

### Product (Existing)

- `getById(id)`: Used for `ProductDetail`.
- **Relationship**: `Order.items[].product` links to this.
- **Stock**: `getStock(id)` endpoint used for real-time stock check.

### Order (Sales/Purchase) (Existing)

- **New Links**:
  - `partnerId` → `CustomerDetail`/`SupplierDetail`
  - `invoices[]` → `InvoiceDetail`
  - `items[].productId` → `ProductDetail`

### Journal Entry (Existing)

- `getById(id)`: Used for `JournalDetail`.
- **Lines**: `JournalLine[]` displayed in full.

## New View Models (Frontend Only)

No new database models. Frontend state will compose these existing entities.
