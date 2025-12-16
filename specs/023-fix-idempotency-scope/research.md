# Research: Fix Idempotency Key Scope

**Feature**: 023-fix-idempotency-scope  
**Date**: 2025-12-16

---

## 1. Current Implementation Analysis

### IdempotencyKey Schema (Current)

```prisma
model IdempotencyKey {
  id        String            @id  // Client-provided key (arbitrary string)
  companyId String
  scope     IdempotencyScope
  status    IdempotencyStatus
  response  Json?
  createdAt DateTime
  updatedAt DateTime

  @@index([companyId])
  @@index([status, updatedAt])
}
```

**Problem**: `id` is arbitrary, allowing same key to match different entities.

### IdempotencyService.lock() (Current)

```typescript
async lock(key: string, companyId: string, scope: IdempotencyScope)
```

**Problem**: Caller provides the `key`. No entity binding.

---

## 2. Decision: Key Generation Strategy

| Option | Approach                                      | Pros                  | Cons                   |
| ------ | --------------------------------------------- | --------------------- | ---------------------- |
| A      | Composite `id = scope:entityId:companyId`     | Simple, deterministic | Changes key format     |
| B      | Keep `id`, add `entityId` column + constraint | Backward compatible   | More schema changes    |
| C      | Server generates key from request hash        | No entity tracking    | Brittle, hard to debug |

**Decision**: **Option B** — Add `entityId` column with composite unique constraint.

**Rationale**:

- Backward compatible with existing keys (old keys lack entityId validation)
- Clear separation: `id` = client retry key, `entityId` = domain object binding
- Enables DB-level enforcement via unique constraint

---

## 3. Schema Changes Required

```prisma
model IdempotencyKey {
  id        String            @id
  companyId String
  scope     IdempotencyScope
  entityId  String?           // NEW: nullable for backward compat
  status    IdempotencyStatus
  response  Json?
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([status, updatedAt])
  @@unique([companyId, scope, entityId])  // NEW: prevent scope+entity collision
}
```

---

## 4. Service API Changes

### New Method Signature

```typescript
// Before
async lock(key: string, companyId: string, scope: IdempotencyScope)

// After
async lock(
  key: string,
  companyId: string,
  scope: IdempotencyScope,
  entityId: string  // NEW: required
)
```

### New Validation Logic

```typescript
// If existing key found, validate entityId matches
if (existing.entityId && existing.entityId !== entityId) {
  throw new Error(
    'Idempotency key scope mismatch: entityId conflict'
  );
}
```

---

## 5. Migration Strategy

1. **Phase 1**: Add nullable `entityId` column (no breaking change)
2. **Phase 2**: Update all callers to pass entityId (InvoiceService, PaymentService)
3. **Phase 3**: Add unique constraint `(companyId, scope, entityId)`
4. **Phase 4**: (Future) Make entityId required, deprecate arbitrary keys

---

## 6. Test Coverage Gaps

### Existing Tests

- `t013_idempotency.test.ts` — Basic lock/complete/scope mismatch
- `t014_invoice_idempotency.test.ts` — Invoice posting idempotency
- `t015_payment_idempotency.test.ts` — Payment idempotency

### New Tests Required

- **Entity Mismatch Test**: Same key, different entityId → 409 Conflict
- **Backward Compat Test**: Old key (no entityId) still works
- **Unique Constraint Test**: Two different keys for same entity → only one succeeds

---

## 7. Affected Files

| File                                                          | Change Type                     |
| ------------------------------------------------------------- | ------------------------------- |
| `packages/database/prisma/schema.prisma`                      | Add entityId, unique constraint |
| `apps/api/src/modules/common/services/idempotency.service.ts` | New lock signature, validation  |
| `apps/api/src/modules/accounting/services/invoice.service.ts` | Pass invoiceId as entityId      |
| `apps/api/src/modules/accounting/services/payment.service.ts` | Pass invoiceId as entityId      |
| `apps/api/test/unit/modules/common/t013_idempotency.test.ts`  | Add entity mismatch test        |
