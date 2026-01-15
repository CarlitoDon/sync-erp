---
trigger: model_decision
---

<!--
MEMORY SYNC REPORT
Version: 2.0.0 (MAJOR - Full Rewrite)
Added Sections:
- Reorganized Key Decisions with clearer categories
- Updated Patterns with current tRPC usage
- Added DI Container pattern
- Added tRPC invalidation pattern
Modified Sections:
- All sections rewritten for clarity
Removed Sections:
- Obsolete useCompanyData pattern (replaced by tRPC hooks)
Last Updated: 2026-01-08
-->

# Project Memory

**Version**: 2.0.0 | **Last Updated**: 2026-01-08

## Overview

| Property     | Value                                                                       |
| ------------ | --------------------------------------------------------------------------- |
| Project      | Sync ERP                                                                    |
| Type         | Multi-Tenant Enterprise Resource Planning                                   |
| Stack        | Vite + React + tRPC (Frontend), Express + tRPC + TS (Backend), Prisma (ORM) |
| Constitution | v3.3.0 (see `.agent/rules/constitution.md`)                                 |

---

## Key Decisions Log

### [2026-01-15] Multi-Tenant API Authentication

**Decision**: External integrations MUST use `apiKeyProcedure` with Bearer token authentication.
**Pattern**:

```typescript
// Router: use apiKeyProcedure for external APIs
createOrder: apiKeyProcedure.input(schema).mutation(({ ctx }) => {
  // ctx.companyId injected from validated API key
  return service.create(ctx.companyId, input);
});
```

**Database**: `ApiKey` model stores bcrypt-hashed keys with permissions, webhookUrl, rate limits.
**Rationale**: Enables secure multi-tenant access without exposing user sessions.
**Reference**: Constitution III (Security)

### [2026-01-15] Row-Level Security for Data Isolation

**Decision**: All business tables use RLS with `company_isolation` policy.
**Pattern**:

```typescript
// Set context before queries
import { withCompanyContext } from '@sync-erp/database';
await withCompanyContext(ctx.companyId, async () => {
  return prisma.rentalOrder.findMany(); // RLS filters automatically
});
```

**Rationale**: Guarantees tenant data isolation at database level.
**Reference**: Constitution IX (Data Integrity)

### [2026-01-09] Check TypeScript Watch for Type Errors

**Decision**: Always check the `TypeScript: Watch` terminal (list process id first and then check the terminal) when needing to verify type correctness.
**Rationale**: `npm run build` might not capture all type errors or might be slower. The watch terminal provides real-time feedback.
**Reference**: Core Workflow

### [2026-01-08] DI Container for Service Resolution

**Decision**: All services MUST be resolved via DI container in routers.
**Pattern**:

```typescript
import { container, ServiceKeys } from '../../modules/common/di';
const service = container.resolve<MyService>(ServiceKeys.MY_SERVICE);
```

**Rationale**: Enables testability and decouples router from service instantiation.
**Reference**: Constitution III (Layered Architecture)

### [2025-12-23] No Hardcoded Enums

**Decision**: Do NOT hardcode enum schemas in `validators/`. **Use generated schemas** from `packages/shared/src/generated/zod/index.ts`.
**Examples**: ❌ `z.enum(['SALES'])` → ✅ `import { OrderTypeSchema } ...`
**Rationale**: Single source of truth from Prisma schema.
**Reference**: Constitution II (Type System & Contracts)

### [2025-12-23] Architecture: 4-Layer Backend

**Decision**: Strict 4-Layer Architecture with tRPC Routers replacing Express Controllers:

| Layer          | File              | Responsibility                  | MUST NOT Do                   |
| -------------- | ----------------- | ------------------------------- | ----------------------------- |
| **Router**     | `*.router.ts`     | tRPC procedures, Zod validation | Business logic, DB access     |
| **Service**    | `*.service.ts`    | Orchestration, Policy checks    | Import `prisma`               |
| **Policy**     | `*.policy.ts`     | Pure business constraints       | DB access, transactions       |
| **Repository** | `*.repository.ts` | Prisma queries, locks           | State logic, intent branching |

**Reference**: Constitution III-A (Dumb Controller / Dumb Repository)

### [2025-12-18] Business Flow Standards

**Decision**: All business flows require:

1. **Integration Tests**: MANDATORY, in single `it()` block (Constitution XVII)
2. **API Seeding**: Use `./scripts/seed-via-api.sh` for side-effect testing
3. **Preconditions**: Documents must validate precursors (Bill needs GRN)
4. **Data Integrity**: Validate reference data (e.g., Accounts) before writing

**Reference**: Constitution XVII (Integration Test as Tracked Tasks)

### [2025-12-16] Quality & Testing Safeguards

**Decision**:

1. **Integration Testing**: Mock the orchestrator (Service), not repositories
2. **Vitest Mocking**: Use `function() { return mockInstance }` for hoisting
3. **Orphan Prevention**: Always grep for imports after creating new files

**Reference**: Constitution XV (Test Contract Compliance)

---

## Known Issues & Workarounds

| Issue                                       | Status | Workaround                            |
| :------------------------------------------ | :----- | :------------------------------------ |
| Old orders have subtotal-only `totalAmount` | KNOWN  | Only new orders include tax           |
| IDE lint may be stale                       | KNOWN  | Trust `npx tsc --noEmit`              |
| Dev server always running                   | NOTE   | Do NOT start manually                 |
| Orphan files (Case A1)                      | KNOWN  | Grep imports after creating new files |

---

## Frequently Used Patterns

### apiAction (Frontend Mutations)

Use for all API mutations with automatic toast feedback:

```typescript
import { apiAction } from '@/hooks/useApiAction';

const handleSubmit = async () => {
  const result = await apiAction(
    () => createMutation.mutateAsync(data),
    'Created successfully!'
  );
  if (result) {
    utils.myRouter.list.invalidate(); // Invalidate cache
  }
};
```

### useConfirm (Confirmation Dialogs)

**NEVER use `window.confirm()`**:

```typescript
import { useConfirm } from '@/components/ui/ConfirmModal';

const confirm = useConfirm();

const handleDelete = async () => {
  const proceed = await confirm({
    title: 'Delete Item',
    message: 'This action cannot be undone.',
    variant: 'danger',
  });
  if (proceed) {
    await deleteMutation.mutateAsync(id);
  }
};
```

### tRPC Query with Company Context

Always check company context before enabling queries:

```typescript
const { data, isLoading } = trpc.partner.list.useQuery(
  { type: 'SUPPLIER' },
  { enabled: !!currentCompany?.id } // Disable when no company
);
```

### tRPC Mutation with Cache Invalidation

Always invalidate related queries after mutations:

```typescript
const utils = trpc.useUtils();

const createMutation = trpc.partner.create.useMutation({
  onSuccess: () => {
    utils.partner.list.invalidate(); // Invalidate list
    utils.partner.get.invalidate(); // Invalidate detail
  },
});
```

### DI Container Resolution (Backend Router)

Resolve services from container, never instantiate directly:

```typescript
import { container, ServiceKeys } from '../../modules/common/di';

const partnerService = container.resolve<PartnerService>(
  ServiceKeys.PARTNER_SERVICE
);

export const partnerRouter = router({
  list: protectedProcedure
    .input(
      z.object({ type: PartnerTypeSchema.optional() }).optional()
    )
    .query(({ ctx, input }) =>
      partnerService.list(ctx.companyId, input?.type)
    ),
});
```

### Policy Check in Service

Services MUST check policies before repository operations:

```typescript
async createBill(ctx: Context, data: CreateBillInput) {
  const order = await this.orderRepo.findById(data.orderId);
  BillPolicy.ensureOrderConfirmed(order);   // 🔒 Policy
  BillPolicy.ensureNotOverBilled(order);    // 🔒 Policy
  return this.billRepo.create(data);         // 💾 Repository
}
```

### Vitest Mock with Function Factory

Use function factory for proper hoisting:

```typescript
vi.mock('../services/partner.service', () => ({
  PartnerService: function () {
    return mockPartnerService;
  },
}));
```

---

## Update Guidelines

1. **Version Bump**: MAJOR (breaking), MINOR (new sections), PATCH (entries)
2. **Add Decisions**: At TOP of Key Decisions Log with date `[YYYY-MM-DD]`
3. **Sync Command**: `cp .github/memory.md .agent/rules/memory.md`
