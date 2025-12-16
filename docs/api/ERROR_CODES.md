# API Error Codes Contract

**Version:** 1.0.0  
**Last Updated:** 2025-12-16

This document defines all error codes used by the Sync ERP API and how frontend should handle them.

---

## Error Response Format

All API errors follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [...]  // Optional, for validation errors
  }
}
```

---

## Error Codes Reference

### Validation Errors (HTTP 400)

| Code               | Description                        | When Thrown             | Frontend Handling                            |
| ------------------ | ---------------------------------- | ----------------------- | -------------------------------------------- |
| `VALIDATION_ERROR` | Request body failed Zod validation | Invalid form data       | Show field-level errors from `details` array |
| `INVALID_INPUT`    | Semantic validation failed         | e.g., negative quantity | Show toast with message                      |

**Example `details` for VALIDATION_ERROR:**

```json
{
  "details": [
    { "path": "email", "message": "Invalid email format" },
    { "path": "quantity", "message": "Must be positive" }
  ]
}
```

---

### Authentication Errors (HTTP 401/403)

| Code            | Description                      | When Thrown         | Frontend Handling                |
| --------------- | -------------------------------- | ------------------- | -------------------------------- |
| `UNAUTHORIZED`  | No valid token                   | Missing/expired JWT | Redirect to login                |
| `INVALID_TOKEN` | Token malformed                  | Tampered token      | Clear storage, redirect to login |
| `FORBIDDEN`     | Authenticated but not authorized | Missing permission  | Show "Access Denied" page        |

---

### Resource Errors (HTTP 404/409)

| Code             | Description             | When Thrown                      | Frontend Handling                    |
| ---------------- | ----------------------- | -------------------------------- | ------------------------------------ |
| `NOT_FOUND`      | Resource doesn't exist  | GET/PUT/DELETE on missing entity | Show "Not Found" or redirect to list |
| `CONFLICT`       | Resource state conflict | Concurrent modification          | Show "Please refresh and try again"  |
| `ALREADY_EXISTS` | Duplicate unique field  | e.g., duplicate SKU              | Show specific field error            |

---

### Business Logic Errors (HTTP 400/422)

| Code                        | Description               | When Thrown              | Frontend Handling                        |
| --------------------------- | ------------------------- | ------------------------ | ---------------------------------------- |
| `INSUFFICIENT_STOCK`        | Not enough inventory      | Ship more than available | Show stock warning, suggest max quantity |
| `INVALID_STATUS_TRANSITION` | Illegal state change      | e.g., VOID → PAID        | Disable invalid action buttons           |
| `INVOICE_ALREADY_PAID`      | Duplicate payment attempt | Pay fully-paid invoice   | Show "Already Paid" badge                |

---

### Domain Policy Errors (HTTP 400)

| Code                       | Description           | When Thrown                           | Frontend Handling                 |
| -------------------------- | --------------------- | ------------------------------------- | --------------------------------- |
| `SHAPE_PENDING`            | Company shape not set | Any operation without shape           | Redirect to onboarding            |
| `SHAPE_ALREADY_SET`        | Shape is immutable    | Attempt to change shape               | Hide shape selector after set     |
| `OPERATION_NOT_ALLOWED`    | Policy blocks action  | e.g., Service company doing inventory | Hide/disable the feature entirely |
| `INVALID_STATE_TRANSITION` | Workflow violation    | Skip required step                    | Show proper workflow guidance     |

---

### Server Errors (HTTP 500)

| Code             | Description             | When Thrown                 | Frontend Handling                     |
| ---------------- | ----------------------- | --------------------------- | ------------------------------------- |
| `INTERNAL_ERROR` | Unexpected server error | Unhandled exception         | Show generic error, log to monitoring |
| `DATABASE_ERROR` | DB operation failed     | Connection/constraint error | Retry with backoff, then show error   |

---

### Idempotency Errors (HTTP 409)

| Code                   | Description                | When Thrown                  | Frontend Handling                      |
| ---------------------- | -------------------------- | ---------------------------- | -------------------------------------- |
| `IDEMPOTENCY_CONFLICT` | Request already processing | Concurrent duplicate request | Show "Processing..." and wait          |
| `IDEMPOTENCY_CACHED`   | Already completed          | Retry after success          | Use cached response (same as original) |

---

## Idempotency Header

For operations that support idempotency:

```http
POST /api/invoices/:id/post
X-Idempotency-Key: <uuid-v4>
```

**Behavior:**

- First request: Executes and caches response
- Retry with same key: Returns cached response
- Different key: New execution

**Recommended key format:**

```
{userId}:{entityId}:{action}:{timestamp}
```

---

## Frontend Implementation Guide

### 1. Global Error Handler

```typescript
// utils/apiErrorHandler.ts
import { ERROR_CODES } from '@sync-erp/shared';

export function handleApiError(error: ApiError) {
  switch (error.code) {
    case ERROR_CODES.UNAUTHORIZED:
    case ERROR_CODES.INVALID_TOKEN:
      // Clear auth and redirect
      authStore.logout();
      router.push('/login');
      break;

    case ERROR_CODES.FORBIDDEN:
      toast.error('You do not have permission for this action');
      break;

    case ERROR_CODES.NOT_FOUND:
      router.push('/404');
      break;

    case ERROR_CODES.VALIDATION_ERROR:
      // Let form handle field errors
      return error.details;

    case ERROR_CODES.INSUFFICIENT_STOCK:
      toast.warning(error.message);
      break;

    default:
      toast.error(error.message || 'An error occurred');
  }
}
```

### 2. Form Validation Errors

```typescript
// hooks/useFormErrors.ts
export function mapApiErrorsToForm(details: ValidationDetail[]) {
  const errors: Record<string, string> = {};
  for (const detail of details) {
    errors[detail.path] = detail.message;
  }
  return errors;
}
```

### 3. Idempotent Requests

```typescript
// services/invoice.service.ts
import { v4 as uuid } from 'uuid';

export async function postInvoice(invoiceId: string) {
  const idempotencyKey = `${userId}:${invoiceId}:post:${Date.now()}`;

  return api.post(`/invoices/${invoiceId}/post`, null, {
    headers: { 'X-Idempotency-Key': idempotencyKey },
  });
}
```

---

## Error Code Constants

Import from shared package:

```typescript
import { ERROR_CODES, DomainErrorCodes } from '@sync-erp/shared';

// ERROR_CODES - HTTP/general errors
// DomainErrorCodes - Business policy errors
```

---

## Version History

| Version | Date       | Changes               |
| ------- | ---------- | --------------------- |
| 1.0.0   | 2025-12-16 | Initial documentation |
