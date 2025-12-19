# Quickstart: Fix Idempotency Key Scope

**Feature**: 023-fix-idempotency-scope  
**Branch**: `023-fix-idempotency-scope`

---

## Problem

Current idempotency keys are arbitrary strings. A client can reuse the same key for different entities, causing cached responses to be returned for the wrong operation.

## Solution

Add `entityId` field to IdempotencyKey with composite unique constraint.

---

## Implementation Checklist

### 1. Schema Migration

```bash
# Add entityId to schema.prisma
# packages/database/prisma/schema.prisma

# Run migration
cd packages/database
npx prisma migrate dev --name add_idempotency_entity_id
```

### 2. Update IdempotencyService

```typescript
// apps/api/src/modules/common/services/idempotency.service.ts

// Change signature
async lock(key: string, companyId: string, scope: IdempotencyScope, entityId: string)

// Add validation in lock()
if (existing.entityId && existing.entityId !== entityId) {
  throw new Error('Idempotency key entity mismatch');
}

// Update create()
data: { id: key, companyId, scope, entityId, status: PROCESSING }
```

### 3. Update Callers

```typescript
// InvoiceService.post()
await this.idempotencyService.lock(
  idempotencyKey,
  companyId,
  'INVOICE_POST',
  id
);

// PaymentService.create()
await this.idempotencyService.lock(
  idempotencyKey,
  companyId,
  'PAYMENT_CREATE',
  data.invoiceId
);
```

### 4. Add Tests

```typescript
// t013_idempotency.test.ts
it('should throw on entity mismatch', async () => {
  // existing key with entityId = 'entity-A'
  await expect(
    service.lock('key-1', 'co-1', 'TEST', 'entity-B')
  ).rejects.toThrow(/entity mismatch/);
});
```

---

## Verification

```bash
# Run unit tests
cd apps/api && npm test -- --grep "idempotency"

# TypeScript check
npx tsc --noEmit

# Build
npm run build
```
