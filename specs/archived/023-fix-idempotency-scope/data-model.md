# Data Model: Fix Idempotency Key Scope

**Feature**: 023-fix-idempotency-scope  
**Date**: 2025-12-16

---

## Entity Changes

### IdempotencyKey (Modified)

```prisma
model IdempotencyKey {
  id        String            @id          // Client retry key
  companyId String                         // Tenant isolation
  scope     IdempotencyScope               // INVOICE_POST, PAYMENT_CREATE
  entityId  String?                        // NEW: The domain object ID
  status    IdempotencyStatus              // PROCESSING, COMPLETED, FAILED
  response  Json?                          // Cached response
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  company Company @relation(...)

  @@index([companyId])
  @@index([status, updatedAt])
  @@unique([companyId, scope, entityId])   // NEW: Prevent scope collision
}
```

### Field Definitions

| Field     | Type              | Required           | Description                                   |
| --------- | ----------------- | ------------------ | --------------------------------------------- |
| id        | String            | Yes                | Client-provided retry key (backward compat)   |
| companyId | String            | Yes                | Tenant ID for multi-tenant isolation          |
| scope     | IdempotencyScope  | Yes                | Operation type (INVOICE_POST, PAYMENT_CREATE) |
| entityId  | String            | **NEW** (nullable) | The ID of the entity being operated on        |
| status    | IdempotencyStatus | Yes                | Current lock state                            |
| response  | Json              | No                 | Cached response for completed operations      |

### Constraints

| Constraint  | Fields                         | Purpose                                        |
| ----------- | ------------------------------ | ---------------------------------------------- |
| Primary Key | `id`                           | Unique key lookup                              |
| Unique      | `(companyId, scope, entityId)` | **NEW**: Prevent same operation on same entity |
| Index       | `(companyId)`                  | Tenant queries                                 |
| Index       | `(status, updatedAt)`          | Zombie cleanup                                 |

---

## State Transitions

```
NEW KEY
   │
   ▼
┌─────────────┐
│  PROCESSING │ ←─── lock() called
└─────────────┘
   │         │
   │ success │ failure
   ▼         ▼
┌────────┐ ┌────────┐
│COMPLETED│ │ FAILED │ ←─── can be deleted for retry
└────────┘ └────────┘
```

---

## Validation Rules

1. **Scope Mismatch**: If existing key has different scope → 409 Conflict
2. **Company Mismatch**: If existing key has different companyId → 409 Conflict
3. **Entity Mismatch**: If existing key has entityId AND it differs → 409 Conflict
4. **Zombie Lock**: If PROCESSING and age > 5 minutes → Delete and allow retry
5. **Completed Key**: If COMPLETED → Return cached response

---

## Migration Notes

- `entityId` is **nullable** for backward compatibility
- Old keys (without entityId) will still work but won't enforce entity binding
- Unique constraint only enforces when entityId is NOT NULL
