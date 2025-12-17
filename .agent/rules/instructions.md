# AI Agent Instructions for Sync ERP

> Multi-tenant ERP system • Vite + React (frontend) • Express + TypeScript (backend) • Prisma (ORM)

## Architecture Overview

```text
sync-erp/
├── apps/
│   ├── web/              # Vite + React + Tailwind + React Query-like hooks
│   │   └── src/features/ # Domain-driven feature folders (components, services, pages)
│   └── api/              # Express + TS backend
│       └── src/modules/  # Domain-driven modules (5-layer architecture)
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
3.  **Five Layers**: Route → Controller → Service → Policy/Rules → Repository (never skip layers).
4.  **Module Parity**: Related domains (Sales/Procurement) must mirror implementation logic.
5.  **Performance**: Use backend joins (`include`) over frontend loops to avoid N+1 issues.
6.  **Build Check**: Run `npx tsc --noEmit` before marking tasks complete.

## Backend Patterns (apps/api)

### Five-Layer Module Structure

```text
apps/api/src/modules/[domain]/
├── [domain].controller.ts  # HTTP Boundary: Req/Res, Validation. No Business Logic.
├── [domain].service.ts     # Orchestrator: The "Why". Combines Rules + Policy + Repo.
├── [domain].policy.ts      # Shape Constraints: "Can this run?" Based on BusinessShape.
├── [domain].repository.ts  # Data Access: Prisma queries. Scoped by companyId.
└── rules/
    └── *.ts                # Pure Business Logic: Stateless, unit testable. No I/O.
```

| Layer      | Responsibility                                  | Can Import                |
| :--------- | :---------------------------------------------- | :------------------------ |
| Route      | URL → Controller mapping. No logic.             | Controller, Middleware    |
| Controller | HTTP boundary, Zod validation, response format. | Service                   |
| Service    | Orchestrator. Combines Rules + Policy + Repo.   | Policy, Rules, Repository |
| Policy     | Shape constraints ("Can this shape do X?")      | Shared Constants          |
| Rules      | Pure business logic. Stateless. Unit testable.  | None (Pure)               |
| Repository | Data access. Query, Transaction.                | `packages/database`       |

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

### Saga Pattern (Multi-Module Transactions)

For operations that span multiple modules with permanent side effects (e.g., Invoice Posting → Stock + Accounting):

```typescript
// apps/api/src/services/InvoicePostingSaga.ts
// Use compensating actions for rollback, NOT deletion
// Mock the Saga in integration tests, NOT underlying repositories
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
// Fetcher automatically re-runs when company context changes
const { data, loading, refresh } = useCompanyData(
  (companyId) => partnerService.list(companyId),
  [] // initial value
);
```

### API Action (Mutations)

```typescript
import { apiAction } from '../../../utils/apiAction';

const handleSubmit = async (data: CreatePartnerInput) => {
  const result = await apiAction(() => partnerService.create(data), {
    successMessage: 'Partner created!',
  });
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

## Testing Patterns

### Vitest 4.x Mock Hoisting

```typescript
// Use function() pattern for vi.mock() factories - Vitest 4.x strict hoisting
vi.mock('../services/InvoicePostingSaga', () => ({
  InvoicePostingSaga: function () {
    return mockSagaInstance;
  },
}));
```

### Integration Tests for Sagas

```typescript
// Mock the Saga orchestrator, NOT the underlying repositories
// Sagas are tested in isolation; integration tests trust them
```

## Essential Commands

| Action         | Command                          |
| :------------- | :------------------------------- |
| **Start Dev**  | `npm run dev` (starts both apps) |
| **Type Check** | `npx tsc --noEmit` (Crucial!)    |
| **Run Tests**  | `npm run test` (Vitest)          |
| **Build**      | `npm run build`                  |
| **Lint**       | `npm run lint`                   |
| **DB Studio**  | `npm run db:studio`              |
| **DB Migrate** | `npm run db:migrate`             |

## Don'ts

- ❌ **No `any`**: Use precise types or Zod schemas.
- ❌ **No `window.confirm`**: Use `useConfirm()` hook.
- ❌ **No direct `toast`**: Use `apiAction()` helper.
- ❌ **No `this` in services**: Use standalone functions to ensure safety in hooks.
- ❌ **No Client-Side Joins**: Use `prisma.order.findMany({ include: { items: true } })`.
- ❌ **No Manual API Types**: Use `z.infer<typeof Schema>` for shared DTOs.
- ❌ **No Logic in Controller**: Controllers only validate + delegate to Service.
- ❌ **No I/O in Rules**: Rules are pure functions, no database/API calls.

## Key Files Reference

| Purpose               | File                                      |
| :-------------------- | :---------------------------------------- |
| **Constitution**      | `.agent/rules/constitution.md`            |
| **API Entry**         | `apps/api/src/index.ts`                   |
| **Shared Validators** | `packages/shared/src/validators/index.ts` |
| **Shared Types**      | `packages/shared/src/types/index.ts`      |
| **Prisma Schema**     | `packages/database/prisma/schema.prisma`  |
| **API Action Util**   | `apps/web/src/utils/apiAction.ts`         |
| **Shape Guard**       | `apps/api/src/middlewares/shapeGuard.ts`  |
