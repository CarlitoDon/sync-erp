# AI Agent Instructions for Sync ERP

> Multi-tenant ERP system • Vite + React (frontend) • Express + TypeScript (backend) • Prisma (ORM)

## Architecture Overview

```text
sync-erp/
├── apps/
│   ├── web/              # Vite + React + Tailwind + React Query-like hooks
│   │   └── src/features/ # Domain-driven feature folders (components, services, pages)
│   └── api/              # Express + TS backend
│       └── src/modules/  # Domain-driven modules (controller, service, repository)
├── packages/
│   ├── shared/           # Zod schemas (validators), shared types
│   └── database/         # Prisma client, migrations, seeds
└── turbo.json            # Build orchestration
```

**Data Flow**: `web → HTTP → api → repository → database`
**Dependency Rule**: Apps import from packages, never the reverse.

## Critical Rules (From Constitution)

1.  **Schema-First**: Add fields to `packages/shared/src/validators/*.ts` BEFORE implementing frontend/backend.
2.  **Multi-Tenant**: ALL queries MUST scope by `companyId` (from `X-Company-Id` header).
3.  **Three Layers**: Controller → Service → Repository (never skip layers).
4.  **Module Parity**: Related domains (Sales/Procurement) must mirror implementation logic.
5.  **Performance**: Use backend joins (`include`) over frontend loops to avoid N+1 issues.
6.  **Build Check**: Run `npx tsc --noEmit` before marking tasks complete.

## Backend Patterns (apps/api)

### Three-Layer Module Structure

```text
apps/api/src/modules/[domain]/
├── [domain].controller.ts  # HTTP handling, Zod validation, Response formatting
├── [domain].service.ts     # Business logic, Transaction management
└── [domain].repository.ts  # Prisma data access (Scoped by companyId)
```

### Controller Pattern

```typescript
// apps/api/src/modules/partner/partner.controller.ts
create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!; // Always extract
    const validated = CreatePartnerSchema.parse(req.body); // Zod validation
    const result = await this.service.create(companyId, validated);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error); // Global error handler
  }
};
```

### Repository Pattern (Prisma)

```typescript
// apps/api/src/modules/partner/partner.repository.ts
async findAll(companyId: string): Promise<Partner[]> {
  // ALWAYS scope by companyId
  return prisma.partner.findMany({ where: { companyId } });
}
```

## Frontend Patterns (apps/web)

### Feature Structure

```text
apps/web/src/features/[domain]/
├── components/   # Domain-specific UI components
├── pages/        # Route page components
└── services/     # API service definitions
```

### Data Fetching (Hooks)

```typescript
// apps/web/src/hooks/useCompanyData.ts
// Fetcher automatically re-runs when company context changes
const { data, loading, refresh } = useCompanyData(
  (companyId) => partnerService.list(companyId),
  [] // initial value
);
```

### API Action (Mutations)

```typescript
// apps/web/src/utils/apiAction.ts
import { apiAction } from '../../../utils/apiAction';

const handleSubmit = async (data: CreatePartnerInput) => {
  const result = await apiAction(
    () => partnerService.create(data),
    { successMessage: 'Partner created!' }
  );
  if (result) refresh();
};
```

## Shared Library Patterns (packages/shared)

### Schema Definition (Target)

**Location**: `packages/shared/src/validators/index.ts`

```typescript
// 1. Define Zod Schema
export const CreatePartnerSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['CUSTOMER', 'SUPPLIER']),
});

// 2. Export Inferred Type (preferred over manual interface)
export type CreatePartnerInput = z.infer<typeof CreatePartnerSchema>;
```

> **Note**: Legacy manual interfaces exist in `packages/shared/src/types`. For NEW DTOs, strictly use Zod inference.

## Essential Commands

| Action | Command |
| :--- | :--- |
| **Start Dev** | `npm run dev` (starts both apps) |
| **Type Check** | `npx tsc --noEmit` (Crucial!) |
| **Run Tests** | `npm run test` (Vitest) |
| **Build** | `npm run build` |
| **Lint** | `npm run lint` |
| **DB Studio** | `npm run db:studio` |
| **DB Migrate** | `npm run db:migrate` |

## Don'ts

-   ❌ **No `any`**: Use precise types or Zod schemas.
-   ❌ **No `window.confirm`**: Use `useConfirm()` hook.
-   ❌ **No direct `toast`**: Use `apiAction()` helper.
-   ❌ **No `this` in services**: Use standalone functions to ensure safety in hooks.
-   ❌ **No Client-Side Joins**: valid: `prisma.order.findMany({ include: { items: true } })`.
-   ❌ **No Manual API Types**: Use `z.infer<typeof Schema>` for shared DTOs.

## Key Files Reference

| Purpose | File |
| :--- | :--- |
| **Constitution** | `.agent/rules/constitution.md` |
| **API Entry** | `apps/api/src/index.ts` |
| **Shared Validators** | `packages/shared/src/validators/index.ts` |
| **Shared Types** | `packages/shared/src/types/index.ts` |
| **Prisma Schema** | `packages/database/prisma/schema.prisma` |
| **API Action Util** | `apps/web/src/utils/apiAction.ts` |
