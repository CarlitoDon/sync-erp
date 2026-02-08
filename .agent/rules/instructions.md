# AI Agent Instructions for Sync ERP

## Architecture Overview

```text
apps/web ─tRPC→ apps/api ─Repository→ packages/database
    ↓               ↓                       ↓
packages/shared ←── packages/shared ←── (Prisma types)
```

**Monorepo Stack**:

- **Build**: Turbo + NPM Workspaces
- **Frontend**: `apps/web` (Vite + React + tRPC client)
- **Backend**: `apps/api` (Express + tRPC + TypeScript)
- **Shared**: `packages/shared` (Zod schemas, types, domain objects)
- **Database**: `packages/database` (Prisma ORM)

---

## Key Patterns

### 1. tRPC Router + DI Container

Backend modules use tRPC routers that resolve services via DI container:

```typescript
// apps/api/src/trpc/routers/partner.router.ts
import { container, ServiceKeys } from '../../modules/common/di';

const partnerService = container.resolve<PartnerService>(
  ServiceKeys.PARTNER_SERVICE
);

export const partnerRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({ type: z.nativeEnum(PartnerType).optional() })
        .optional()
    )
    .query(({ ctx, input }) =>
      partnerService.list(ctx.companyId, input?.type)
    ),

  create: protectedProcedure
    .input(CreatePartnerSchema)
    .mutation(({ ctx, input }) =>
      partnerService.create(ctx.companyId, input)
    ),
});
```

### 2. Layered Module Architecture

Each domain in `apps/api/src/modules/[domain]/` follows:

| Layer          | File              | Responsibility                      |
| :------------- | :---------------- | :---------------------------------- |
| **Service**    | `*.service.ts`    | Orchestration, Policy checks, "Why" |
| **Policy**     | `*.policy.ts`     | Business constraints, no DB access  |
| **Rules**      | `rules/*.ts`      | Pure business logic, stateless      |
| **Repository** | `*.repository.ts` | Prisma queries, no business logic   |

### 3. Schema-First Development

All API contracts start in `packages/shared/src/validators/`:

```typescript
// packages/shared/src/validators/partner.ts
export const CreatePartnerSchema = z.object({...});
export type CreatePartnerInput = z.infer<typeof CreatePartnerSchema>;
```

After modifying schemas: `cd packages/shared && npm run build`

### 4. Frontend State Projection

- UI components in `apps/web/src/features/[domain]/`
- Use `apiAction()` helper for mutations with automatic toast
- Use `useConfirm()` hook for dialogs (never `window.confirm()`)
- Use tRPC hooks with company context: `{ enabled: !!currentCompany?.id }`

---

## Development Commands

| Command                   | Purpose                       |
| :------------------------ | :---------------------------- |
| `npm run dev`             | Start all dev servers (Turbo) |
| `npm run typecheck`       | Type check all packages       |
| `npm run typecheck:watch` | Watch mode typecheck          |
| `npm run test`            | Run all tests                 |
| `npm run db:migrate`      | Run Prisma migrations         |
| `npm run db:seed`         | Seed database                 |
| `npm run db:studio`       | Open Prisma Studio            |

---

## Do's and Don'ts

### ✅ DO

- Read `.agent/rules/constitution.md` before architectural changes
- Use DI container to resolve services in routers
- Use Zod schemas from `@sync-erp/shared` for validation
- Verify `npx tsc --noEmit` returns zero errors
- Check running `typecheck:watch` terminal for errors
- Use `apiAction()` for mutations, `useConfirm()` for dialogs

### ❌ DON'T

- Put business logic in routers or repositories
- Use `any` type — use strict Zod schemas
- Import Prisma directly in Service layer
- Skip Policy checks before repository operations
- Call repository from router (always go through service)
- Use `window.confirm()` or direct `toast()` calls

---

## Key File References

| Purpose               | Path                                     |
| :-------------------- | :--------------------------------------- |
| **Constitution**      | `.agent/rules/constitution.md`           |
| **Project Memory**    | `.agent/rules/memory.md`                 |
| **Prisma Schema**     | `packages/database/prisma/schema.prisma` |
| **Shared Validators** | `packages/shared/src/validators/`        |
| **tRPC Routers**      | `apps/api/src/trpc/routers/`             |
| **Domain Modules**    | `apps/api/src/modules/[domain]/`         |
| **DI Container**      | `apps/api/src/modules/common/di/`        |
| **Frontend Features** | `apps/web/src/features/[domain]/`        |
