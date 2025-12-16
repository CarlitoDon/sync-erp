# API Contract: Idempotency Service

**Feature**: 023-fix-idempotency-scope  
**Date**: 2025-12-16

---

## Internal Service API

This feature modifies an internal service API, not a REST endpoint.

### IdempotencyService.lock()

```typescript
/**
 * Acquire idempotency lock for an operation
 *
 * @param key - Client-provided retry key
 * @param companyId - Tenant ID
 * @param scope - Operation type (INVOICE_POST, PAYMENT_CREATE)
 * @param entityId - The entity being operated on (invoiceId, paymentId, etc.)
 * @returns { saved: boolean, response?: T }
 * @throws Error if scope mismatch, company mismatch, or entity mismatch
 */
async lock<T>(
  key: string,
  companyId: string,
  scope: IdempotencyScope,
  entityId: string
): Promise<{ saved: boolean; response?: T }>
```

### Error Responses

| Error                                               | HTTP Code | Condition                                |
| --------------------------------------------------- | --------- | ---------------------------------------- |
| `Idempotency key scope mismatch: expected ${scope}` | 409       | Key exists with different scope          |
| `Idempotency key ownership mismatch`                | 409       | Key exists for different company         |
| `Idempotency key entity mismatch`                   | 409       | **NEW**: Key exists for different entity |
| `Request with this key is currently processing`     | 409       | Key is PROCESSING (non-stale)            |

---

## Caller Contract Changes

### InvoiceService.post()

```typescript
// Before
await this.idempotencyService.lock(
  idempotencyKey,
  companyId,
  'INVOICE_POST'
);

// After
await this.idempotencyService.lock(
  idempotencyKey,
  companyId,
  'INVOICE_POST',
  id
);
//                                                                          ^^^
//                                                                     invoiceId
```

### PaymentService.create()

```typescript
// Before
await this.idempotencyService.lock(
  idempotencyKey,
  companyId,
  'PAYMENT_CREATE'
);

// After
await this.idempotencyService.lock(
  idempotencyKey,
  companyId,
  'PAYMENT_CREATE',
  data.invoiceId
);
//                                                                             ^^^^^^^^^^^^^^^
//                                                                         target invoice
```
