# AI Agent Instructions for Sync ERP

> Multi-tenant ERP system • Vite + React (frontend) • Express + TypeScript (backend) • Prisma (ORM)

## Architecture Overview

```text
sync-erp/
├── apps/
│   ├── web/              # Vite + React frontend (:5173)
│   └── api/              # Express + TS backend (:3001)
├── packages/
│   ├── shared/           # Zod schemas, shared types
│   └── database/         # Prisma client, migrations
└── turbo.json            # Build orchestration
```

**Data Flow**: `web → HTTP → api → repository → database`  
**Dependency Rule**: Apps import from packages, never the reverse.

## Critical Rules (From Constitution)

1. **Schema-First**: Add fields to `packages/shared/src/validators/*.ts` BEFORE implementing frontend/backend
2. **Multi-Tenant**: ALL queries MUST scope by `companyId` (from `X-Company-Id` header)
3. **Three Layers**: Controller → Service → Repository (never skip layers)
4. **Build Check**: Run `npx tsc --noEmit` before marking tasks complete

## Backend Patterns

### Three-Layer Module Structure

```text
apps/api/src/modules/[domain]/
├── [domain].controller.ts  # HTTP handling, Zod validation
├── [domain].service.ts     # Business logic
└── [domain].repository.ts  # Prisma data access
```

### Controller Pattern (validation + response)

```typescript
// apps/api/src/modules/partner/partner.controller.ts
create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;  // Always extract
    const validated = CreatePartnerSchema.parse(req.body);  // Zod validation
    const result = await this.service.create(companyId, validated);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);  // Let error middleware handle
  }
};
```

### Service Pattern (business logic)

```typescript
// apps/api/src/modules/partner/partner.service.ts
async create(companyId: string, data: CreatePartnerInput): Promise<Partner> {
  return this.repository.create({ companyId, ...data });
}
```

### Repository Pattern (Prisma)

```typescript
// apps/api/src/modules/partner/partner.repository.ts
import { prisma, type Partner, Prisma } from '@sync-erp/database';

async findAll(companyId: string): Promise<Partner[]> {
  return prisma.partner.findMany({ where: { companyId } });
}
```

## Frontend Patterns

### Data Fetching Hook

```typescript
const { data, loading, refresh } = useCompanyData(
  (companyId) => partnerService.list(companyId),
  []  // initial value
);
```

### API Action with Toast

```typescript
import { apiAction } from '../utils/apiAction';

const result = await apiAction(
  () => partnerService.create(data),
  { successMessage: 'Partner created!' }
);
if (result) { refresh(); }
```

### Confirmation Dialog

```typescript
const confirm = useConfirm();
const proceed = await confirm.show({
  title: 'Delete Partner?',
  message: 'This cannot be undone.',
  danger: true,
});
if (proceed) { await partnerService.delete(id); }
```

### Service Pattern (Callback-Safe)

```typescript
// ✅ Use standalone functions
export const partnerService = { list, create };
async function list(companyId: string) { ... }

// ❌ NEVER use 'this' (breaks when passed to hooks)
export const partnerService = {
  async list() { this.x; }  // 'this' context lost!
};
```

## Shared Validators

Location: `packages/shared/src/validators/index.ts`

```typescript
// Define schema first
export const CreatePartnerSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['CUSTOMER', 'SUPPLIER']),
  email: z.string().email().optional(),
});

// Export inferred type (NEVER manual interfaces)
export type CreatePartnerInput = z.infer<typeof CreatePartnerSchema>;
```

After modifying validators:
```bash
cd packages/shared && npm run build
```

## Essential Commands

| Action | Command |
|--------|---------|
| Dev (both apps) | `npm run dev` |
| TypeScript check | `npx tsc --noEmit` |
| Build all | `npm run build` |
| Run tests | `npm run test` |
| Unit tests only | `npm run test:unit --workspace=@sync-erp/api` |
| Prisma studio | `npm run db:studio` |
| Generate Prisma | `npm run db:generate` |
| Migrate DB | `npm run db:migrate` |

## Don'ts

- ❌ Import Prisma directly in `apps/` (use repository layer)
- ❌ Define manual TypeScript interfaces for API types (use `z.infer<>`)
- ❌ Call `toast()` directly (use `apiAction()` helper)
- ❌ Use `window.confirm()` (use `useConfirm()` hook)
- ❌ Skip `companyId` in queries (multi-tenant violation)
- ❌ Use `this` in frontend services (context lost in hooks)

## Key Files Reference

| Purpose | File |
|---------|------|
| Constitution | `.agent/rules/constitution.md` |
| Project Memory | `.agent/rules/memory.md` |
| Zod Validators | `packages/shared/src/validators/index.ts` |
| API Entry | `apps/api/src/index.ts` |
| Three-Layer Example | `apps/api/src/modules/partner/` |
| Frontend Hook | `apps/web/src/hooks/useCompanyData.ts` |
| API Action Helper | `apps/web/src/utils/apiAction.ts` |
