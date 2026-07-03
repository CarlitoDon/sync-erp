# Error Boundaries & System-wide Error Handling

> **Status:** Adopted · **Date:** 2026-07-02
> **Context:** Grilling Session #5 — bagaimana error ditangani dari database hingga response API.

## Architecture

Dual-middleware pipeline pada Express app:

```
Router (throw/next(err))
  │
  ▼
1️⃣ sentryErrorMiddleware          ← capture error ≥500 ke Sentry
  │
  ▼
2️⃣ errorHandler                   ← type dispatcher → response JSON
```

## Error Classes

| Class | File | Status | Digunakan |
|---|---|---|---|
| `AppError` | `middlewares/errorHandler.ts` | Custom (400–500) | Base error class, factory helpers |
| `DomainError` | `packages/shared/src/errors/domain-error.ts` | Custom (default 400) | Business rule violations, policy |
| `ZodError` | zod library | 400 | Input validation |
| Prisma errors | Prisma | 400/404/503 | Constraint, not found, connection |

### AppError

Error utama aplikasi, sudah ada factory helpers:

```ts
NotFoundError(msg)      → AppError(404)
ValidationError(msg)    → AppError(400)
UnauthorizedError(msg)  → AppError(401)
ForbiddenError(msg)     → AppError(403)
ConflictError(msg)      → AppError(409)
```

### DomainError

Untuk business rule violation. Dipanggil dari service layer:

```ts
throw new DomainError(
  'Stock tracking is disabled for Service companies',
  400,
  DomainErrorCodes.OPERATION_NOT_ALLOWED
);
```

### Error Codes

Tabel kode error dari `@sync-erp/shared`:

| Code | Arti |
|---|---|
| `DOMAIN_ERROR` | Default |
| `SHAPE_PENDING` | Company shape belum diset |
| `SHAPE_ALREADY_SET` | Shape sudah di-set sebelumnya |
| `OPERATION_NOT_ALLOWED` | Policy melarang operasi |
| `INSUFFICIENT_STOCK` | Stok tidak mencukupi |
| `INVALID_STATE_TRANSITION` | Status order tidak valid |
| `MUTATION_BLOCKED` | Mutasi diblokir |
| `FORBIDDEN` | Tidak punya akses |

## Error Handler — Type Dispatcher

`middlewares/errorHandler.ts` menggunakan cascade `if/instanceof`:

1. **Prisma known error** (P2002, P2003, P2025, P1001, dst) → dipetakan ke pesan user-friendly
2. **Prisma validation error** (column too long) → 400
3. **Prisma connection error** → 503
4. **ZodError** → 400 dengan detail path + message
5. **AppError** → gunakan `err.statusCode`, `err.code`, `err.details`
6. **Fallback** → 500 generic

Response shape:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "path": "email", "message": "Invalid email" }]
  }
}
```

## Sentry Integration

`middlewares/sentry.ts`:

- Hanya capture error dengan status **≥500**
- Tag: `correlation_id`, `http_status`, `error_code`
- Set user context: `{ id: userId }`
- Set request context: method, path, correlationId, companyId

## Idempotency Guard

`modules/common/services/idempotency.service.ts`:

- Mencegah duplicate processing pada operasi idempoten
- Zombie lock timeout: **5 menit**
- Cek ownership (companyId) + scope mismatch
- Status: `COMPLETED` → return cached response; `PROCESSING` → block atau resume (jika stale)

## Gap Analysis

### ❌ DomainError Tidak Explicitly Handled

`errorHandler` hanya cek `instanceof AppError` dan `ZodError`. **`DomainError` tidak dicek.** Meskipun `DomainError` punya `statusCode`, error akan:

1. Masuk ke `ZodError` check → skip
2. Masuk ke `isAppError` → **false** (karena bukan `AppError`)
3. Masuk ke fallback → **500 generic**

Service layer sudah unwrap `DomainError` dari Prisma transaction wrapper (`cause instanceof DomainError`), tapi error yang sampai ke Express bisa tetap terbungkus.

### ❌ No Domain Error Catalog

`DomainErrorCodes` tersedia tapi tidak ada satu source of truth yang mendaftar semua codes — API client harus trial-and-error.

### ❌ tRPC Error Formatting

Belum ada `formatError` override — error dari tRPC routes menggunakan default formatting, tidak konsisten dengan Express error response shape.

## Recommendations

1. **Add DomainError handling** ke `errorHandler.ts` — cek `domainError instanceof DomainError` sebelum fallback 500
2. **Buat error catalog** — satu file yang mengekspor semua error codes dengan deskripsi, status code, dan contoh
3. **tRPC error formatter** — implement `formatError` di tRPC router agar response shape konsisten dengan Express
4. **Audit sentry filter** — pastikan `DomainError` yang tidak di-handle tidak flood Sentry (filter by code)

## Related

- `apps/api/src/middlewares/errorHandler.ts`
- `apps/api/src/middlewares/sentry.ts`
- `apps/api/src/modules/common/services/idempotency.service.ts`
- `packages/shared/src/errors/domain-error.ts`
