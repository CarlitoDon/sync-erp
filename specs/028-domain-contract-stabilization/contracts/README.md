# API Contracts: Domain Contract Stabilization

**Format**: Zod Schemas (Code-First)
**Location**: `packages/shared/src/validators/`

## 1. Schema Updates

### 1.1 Financial Commands

The following schemas must be updated to include `businessDate`:

#### `InvoicePostSchema`

```typescript
z.object({
  id: z.string().uuid(),
  businessDate: z.date().optional(), // Defaults to new Date() if omitted
});
```

#### `CreatePaymentSchema`

```typescript
z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  method: PaymentMethodSchema,
  businessDate: z.date().optional(), // Defaults to new Date() if omitted
  reference: z.string().optional(),
});
```

#### `CreateJournalSchema` (System Internal)

```typescript
z.object({
  // ... existing fields
  date: z.date(), // MUST be provided explicitly by caller (Service)
});
```

## 2. Defaulting Strategy (Controller Layer)

Controllers will inject `new Date()` if `businessDate` is missing from the request body **BEFORE** passing to Service.

```typescript
// Controller Example
const input = {
  ...req.body,
  businessDate: req.body.businessDate
    ? new Date(req.body.businessDate)
    : new Date(),
};
await service.post(input);
```

**Guardrail G5**: `businessDate` is never implicit in the Service layer. It is always an explicit argument.
