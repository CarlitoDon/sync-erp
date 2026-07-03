# Audit Trail

> **Status:** Adopted · **Date:** 2026-07-02
> **Context:** Grilling Session #7 — bagaimana perubahan data penting dicatat dan dilacak.

## Architecture

Dua sistem audit terpisah:

### 1. Business AuditLog (`AuditLog`)

Mencatat business action di level domain. Direkam **sebelum** saga/transaksi dieksekusi (FR-010.1).

```ts
interface AuditLog {
  id: string
  companyId: string       // tenant scope
  actorId: string         // user yang melakukan
  action: AuditLogAction  // enum operasi bisnis
  entityType: EntityType  // tipe entitas
  entityId: string        // ID entitas
  businessDate: Date      // tanggal bisnis (bukan createdAt)
  payloadSnapshot: Json?  // snapshot state saat action
  correlationId: string?  // trace ID untuk saga
  cashTransactionId: string?  // link ke transaksi kas
}
```

### 2. AuthAuditLog (`AuthAuditLog`)

Mencatat authentication/security event:

```ts
interface AuthAuditLog {
  userId: string?
  email: string
  action: AuthAuditAction
  correlationId: string?
  ipAddress: string?
  userAgent: string?
  metadata: Json?
}
```

## Flow

```
Service method
  │  recordAudit({ companyId, actorId, action, entityType, ... })
  │     ← BEFORE saga/transaksi (FR-010.1)
  ▼
audit-log.repository.ts
  │  prisma.auditLog.create(...)
  ▼
PostgreSQL AuditLog table
  (tenant-scoped via companyId + RLS)
```

### Idempotency Check

```ts
// Cek apakah action sudah pernah direkam (duplicate guard)
const alreadyAudited = await hasAuditedAction(
  companyId, action, entityId, correlationId
);
if (alreadyAudited) {
  // skip — jangan rekam ulang
}
```

## Coverage

| Module | Contoh Actions |
|---|---|
| **Inventory** | RETURN created, SHIPMENT created, GRN posted |
| **Sales** | Sales Order confirmed, shipped, invoiced |
| **Procurement** | Purchase Order created, received |
| **Rental** | Order lifecycle, item assigned, returned, payment, settlement |
| **Auth** | Login success, login failed, logout, password change |
| **Document** | Document number generation |

## Schema

```prisma
model AuditLog {
  id                String           @id @default(uuid())
  companyId         String
  actorId           String
  action            AuditLogAction
  entityType        EntityType
  entityId          String
  businessDate      DateTime
  payloadSnapshot   Json?
  correlationId     String?
  cashTransactionId String?
  company           Company          @relation(...)

  @@index([companyId, action])
  @@index([entityId])
  @@index([businessDate])
  @@index([correlationId])
}
```

Dengan index pada: `(companyId, action)`, `entityId`, `businessDate`, `correlationId`.

## Gap Analysis

| ✅ Ada | ❌ Belum Ada |
|---|---|
| Dual audit system (auth + business) | **Automatic audit via Prisma middleware** — semua create/update/delete otomatis terecord (tidak perlu manual per service) |
| FR-010.1 compliance (record BEFORE saga) | **Audit viewer UI** — interface untuk search/filter audit trail per tenant |
| Idempotency check | **Immutable audit store** — audit bisa dihapus via API (tidak ada soft-delete/protect) |
| Correlation ID tracing | **Change diff** — payloadSnapshot hanya snapshot, bukan diff (sebelum→sesudah) |
| Tenant-scoped via companyId | **Retention policy** — auto-purge audit logs > X bulan |
| Index by entity + action |  |

## Recommendations

1. **Prisma middleware audit** — alternatif: gunakan Prisma `$use` middleware untuk auto-record semua `create`/`update`/`delete` tanpa manual `recordAudit()` di setiap service
2. **Immutable audit** — tambah `@@allow(createOnly)` atau mekanisme soft-delete untuk mencegah audit log dihapus/tampered
3. **Change diff** — simpan `payloadBefore` dan `payloadAfter` agar bisa lihat perubahan spesifik
4. **Audit viewer** — API endpoint untuk UI admin: filter by company, entity, action, date range

## Related

- [Tenant Isolation](./tenant-isolation.md)
- [Error Boundaries](./error-boundaries.md)
- `apps/api/src/modules/common/audit/` — service + repository
- `apps/api/src/modules/auth/auth-audit.service.ts`
- `packages/database/prisma/schema.prisma` (model AuditLog, AuthAuditLog)
- Requirement: FR-010.1
