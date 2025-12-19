# Data Model: Finance Tax & Accruals

**Feature**: 007-finance-tax-returns

## 1. Schema Extensions

### `Invoice` Model

Add support for subtotal and tax separation.

```prisma
model Invoice {
  // ... existing fields
  subtotal    Decimal  @default(0) // New: Net amount before tax
  taxAmount   Decimal  @default(0) // New: Tax portion
  taxRate     Decimal  @default(0) // New: Snapshot of rate used (e.g. 11.0)
  // amount remains as Total (Subtotal + Tax)
}
```

### `Bill` Model

Add support for subtotal and tax separation (Input VAT).

```prisma
model Bill {
  // ... existing fields
  subtotal    Decimal  @default(0) // New: Net amount before tax
  taxAmount   Decimal  @default(0) // New: Tax portion
  taxRate     Decimal  @default(0) // New: Snapshot of rate used
  // amount remains as Total
}
```

### `SalesOrder` & `PurchaseOrder`

Need to persist the selected Tax Rate.

```prisma
model SalesOrder {
  // ... existing fields (ensure taxRate is present)
  taxRate     Decimal  @default(0) // e.g., 11.0
}

model PurchaseOrder {
  // ...
  taxRate     Decimal  @default(0)
}
```

## 2. API Contracts (Shared Types)

### Tax Rate Enum/Const

Define standard tax rates available in the system.

```typescript
// packages/shared/src/types/finance.ts

export const TAX_RATES = [
  { label: 'No Tax (0%)', value: 0 },
  { label: 'PPN 11%', value: 11 },
  { label: 'PPN 12%', value: 12 },
] as const;
```

### DTO Updates

**CreateInvoiceDto**

```typescript
interface CreateInvoiceDto {
  // ...
  taxRate?: number; // Optional override
}
```

**CreateBillDto**

```typescript
interface CreateBillDto {
  // ...
  taxRate?: number;
}
```

## 3. Entity Relationships

- **Invoice <-> JournalEntry**: One-to-One (via reference).
  - Logic change: JournalEntry will now have 3+ lines (Split).
- **InventoryMovement**:
  - New type `RETURN` or existing `IN` with `reference type: RETURN`.

## 4. Validations

- `taxAmount` + `subtotal` MUST equal `amount` (total).
- If `taxRate` > 0, `taxAmount` must be > 0.
