# Implementation Plan: Fix Idempotency Key Scope

**Branch**: `023-fix-idempotency-scope` | **Date**: 2025-12-16 | **Spec**: [spec.md](./spec.md)

## Summary

Fix the idempotency key scope bug (Audit B1) that allows cached responses to be returned for wrong entities. Add `entityId` field to `IdempotencyKey` schema with composite unique constraint, and update `IdempotencyService.lock()` to require entity binding.

---

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 20+  
**Primary Dependencies**: Express, Prisma, Vitest  
**Storage**: PostgreSQL (via Prisma)  
**Testing**: Vitest (existing tests at `apps/api/test/unit/modules/common/`)  
**Target Platform**: Linux server (Node.js)  
**Project Type**: Monorepo (turbo)  
**Performance Goals**: N/A (infrastructure fix)  
**Constraints**: Backward compatible with existing keys  
**Scale/Scope**: 3 files modified, 1 migration, 5 tests added

---

## Constitution Check

_GATE: All items relevant to this backend-only change._

- [x] **I. Architecture**: Backend-only change, no frontend impact
- [x] **II. Contracts**: Schema types auto-exported via Prisma
- [x] **III. Backend Layers**: IdempotencyService is infrastructure, not business logic
- [x] **IV. Multi-Tenant**: All keys scoped by `companyId`
- [x] **V. Frontend**: N/A (no frontend changes)
- [x] **VIII. Verification**: Will run `npx tsc --noEmit` and `npm run build`
- [x] **IX. Schema-First**: Prisma schema modified first, types auto-generated
- [x] **X. Parity**: N/A (single infrastructure component)
- [x] **XI. Performance**: No N+1 loops
- [x] **XII. Apple-Standard**: N/A (no user-facing change)
- [x] **XIII. Data Flow**: N/A (infrastructure)
- [x] **XIV-XVII. Human Experience**: N/A (backend only)

---

## Proposed Changes

### 1. Schema Migration

**File**: `packages/database/prisma/schema.prisma`

```diff
model IdempotencyKey {
  id        String            @id
  companyId String
  scope     IdempotencyScope
+ entityId  String?           // NEW: nullable for backward compat
  status    IdempotencyStatus
  response  Json?
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  company Company @relation(...)

  @@index([companyId])
  @@index([status, updatedAt])
+ @@unique([companyId, scope, entityId])  // NEW: prevent collision
}
```

### 2. IdempotencyService Update

**File**: `apps/api/src/modules/common/services/idempotency.service.ts`

**Changes**:

- Add `entityId` parameter to `lock()` method
- Validate entityId matches if existing key has one
- Store entityId in new lock creation

### 3. Caller Updates

**Files**:

- `apps/api/src/modules/accounting/services/invoice.service.ts`
- `apps/api/src/modules/accounting/services/payment.service.ts`

**Changes**: Pass `entityId` (invoiceId) to `lock()` call

### 4. Tests

**File**: `apps/api/test/unit/modules/common/t013_idempotency.test.ts`

**New Tests**:

- Entity mismatch throws 409
- Old key (no entityId) still works
- New key stores entityId

---

## Verification Plan

### Automated Tests

**Existing Tests**:

```bash
cd apps/api && npm test -- --grep "Idempotency"
```

**New Test Cases** (to be added to `t013_idempotency.test.ts`):

| Test                                      | Description                               |
| ----------------------------------------- | ----------------------------------------- |
| `should throw on entity mismatch`         | Same key, different entityId → error      |
| `should accept matching entityId`         | Same key, same entityId → cached response |
| `should work with old keys (no entityId)` | Backward compat                           |

### Build Verification

```bash
# TypeScript check
npx tsc --noEmit

# Full build
npm run build
```

### Migration Test

```bash
cd packages/database
npx prisma migrate dev --name add_idempotency_entity_id
```

---

## Source Structure

```text
packages/database/prisma/
└── schema.prisma                    # [MODIFY] Add entityId + constraint

apps/api/src/modules/
└── common/services/
    └── idempotency.service.ts       # [MODIFY] New lock signature

apps/api/src/modules/accounting/
└── services/
    ├── invoice.service.ts           # [MODIFY] Pass entityId
    └── payment.service.ts           # [MODIFY] Pass entityId

apps/api/test/unit/modules/
└── common/
    └── t013_idempotency.test.ts     # [MODIFY] Add entity mismatch tests
```

---

## Risks & Mitigations

| Risk                    | Mitigation                                             |
| ----------------------- | ------------------------------------------------------ |
| Breaking existing keys  | entityId is nullable; old keys work without validation |
| Migration rollback      | Standard Prisma rollback supported                     |
| Concurrent PR conflicts | Small change footprint, isolated files                 |
