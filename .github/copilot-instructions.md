# Copilot Instructions for Sync ERP

## Project Overview

Sync ERP is a **multi-tenant ERP system** built as a **Turborepo monorepo** with TypeScript. The MVP covers Sales, Finance/Accounting, Purchasing, and Inventory with strict company-level data isolation.

**Tech Stack:**

- **Backend**: Express.js + Prisma (PostgreSQL) + Vitest
- **Frontend**: React 18 + React Router + Tailwind CSS 4 + Vite
- **Shared**: Zod validation schemas and TypeScript types

## Architecture Fundamentals

### 1. Multi-Tenant Isolation (CRITICAL)

**ALL backend queries MUST be scoped by `companyId`:**

```typescript
// Request headers contain: X-Company-Id
const companyId = req.context.companyId; // Set by authMiddleware
prisma.product.findMany({ where: { companyId } }); // ALWAYS filter
```

**Auth flow:**

- Session cookie (`sessionId`) validates user identity
- `X-Company-Id` header (set by frontend) validates company membership
- `authMiddleware` populates `req.context.userId` and `req.context.companyId`
- Use `optionalAuthMiddleware` for routes like `/api/companies` (no companyId required)

### 2. Backend: 3-Layer Architecture

**Every domain follows Controller → Service → Repository:**

```
apps/api/src/modules/{domain}/
├── {domain}.controller.ts   # HTTP handling, Zod validation
├── {domain}.service.ts      # Business logic only
└── {domain}.repository.ts   # Prisma data access only
```

**Controller pattern:**

```typescript
create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const validated = CreatePartnerSchema.parse(req.body);
    const result = await this.service.create(companyId, validated);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error); // Let errorHandler middleware respond
  }
};
```

**Service pattern** (business logic, NO HTTP):

```typescript
async create(companyId: string, data: CreatePartnerDto): Promise<Partner> {
  // Validate business rules
  const existing = await this.repository.findByName(companyId, data.name);
  if (existing) throw ConflictError('Partner name exists');
  return this.repository.create({ ...data, companyId });
}
```

**Repository pattern** (ONLY Prisma calls):

```typescript
async findByName(companyId: string, name: string): Promise<Partner | null> {
  return prisma.partner.findFirst({ where: { companyId, name } });
}
```

### 3. Frontend: Feature-Based Structure

```
apps/web/src/
├── features/{domain}/        # Co-locate pages, components, services
│   ├── pages/               # Domain-specific pages
│   ├── components/          # Domain-specific components
│   └── services/            # Axios API clients
├── components/ui/           # Reusable UI atoms (no business logic)
├── hooks/                   # Global hooks (useCompanyData, useApiAction)
├── contexts/                # AuthContext, CompanyContext
└── app/                     # AppRouter, AppProviders
```

**Data fetching pattern** (auto-refreshes on company change):

```typescript
const { data, loading, refresh } = useCompanyData(
  (companyId) => partnerService.list(companyId),
  [] // initial value
);
```

**API action with toast** (global error handling via Axios interceptor):

```typescript
const result = await apiAction(() => partnerService.create(data), {
  successMessage: 'Partner created!',
});
if (result) refresh();
```

**Confirmation dialogs** (never use `window.confirm`):

```typescript
const confirm = useConfirm();
const proceed = await confirm.show({
  title: 'Delete Partner?',
  message: 'This cannot be undone.',
  danger: true,
});
```

## Developer Workflows

### Database Commands

```bash
# From repo root (delegates to @sync-erp/database)
npm run db:generate   # Prisma client generation (after schema changes)
npm run db:push       # Push schema to DB (dev only, no migrations)
npm run db:migrate    # Create and apply migration (production-safe)
npm run db:seed       # Seed database with test data
npm run db:studio     # Open Prisma Studio GUI
```

### Development

```bash
npm run dev           # Starts both api (3001) and web (5173)
npm run dev:api       # API only
npm run dev:web       # Web only
npm run typecheck     # Validate TypeScript across monorepo
```

### Testing Strategy

**Backend tests:**

- **Unit tests** (`test/unit/**`): Mock repository layer, test services
- **Integration tests** (`test/integration/**`): Real DB, test full flows
- Run with separate configs: `npm run test:unit` / `npm run test:integration`

**Frontend tests:**

- **Component tests**: `@testing-library/react` with `renderWithContext` helper
- **Hook tests**: `renderHook` from `@testing-library/react`
- Mock contexts (AuthContext, CompanyContext) via `test/mocks/hooks.mock.ts`

```bash
npm run test                              # All tests (uses Vitest)
npm run test --workspace=@sync-erp/api    # Backend only
npm run test --workspace=@sync-erp/web    # Frontend only
npm run test:coverage                     # With coverage report
```

### Test Mocking Patterns

**Backend service tests** (mock repositories):

```typescript
vi.mock('../../../src/modules/product/product.repository', () => ({
  ProductRepository: vi
    .fn()
    .mockImplementation(() => mockProductRepository),
}));
```

**Frontend page tests** (mock contexts):

```typescript
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));
```

## Project-Specific Conventions

### Validation

- Backend: Use **Zod schemas** in controllers (from `@sync-erp/shared`)
- Frontend: Use **React Hook Form** + Zod resolver
- Share schemas via `packages/shared/src/validators/`

### Error Handling

- Backend: Throw custom errors (`ConflictError`, `NotFoundError`) → caught by `errorHandler` middleware
- Frontend: Axios interceptor shows toast for all errors → use `apiAction()` helper

### Routing

- Backend: Routes in `apps/api/src/routes/` bind controllers
- Frontend: Centralized in `apps/web/src/app/AppRouter.tsx` with `ProtectedRoute` wrapper

### State Management

- **No Redux/Zustand**: Use React Context (`AuthContext`, `CompanyContext`)
- **Company context** persists to `localStorage` (auto-restore on reload)

### Styling

- **Tailwind CSS 4** with `@tailwindcss/vite` plugin
- No inline styles, use utility classes
- Consistent spacing (`space-y-4`, `gap-4`) and colors (`primary-600`, `gray-500`)

## Key Files Reference

| Purpose            | File                                                                             |
| ------------------ | -------------------------------------------------------------------------------- |
| Auth middleware    | [apps/api/src/middlewares/auth.ts](apps/api/src/middlewares/auth.ts)             |
| API entry point    | [apps/api/src/index.ts](apps/api/src/index.ts)                                   |
| Prisma schema      | [packages/database/prisma/schema.prisma](packages/database/prisma/schema.prisma) |
| Frontend router    | [apps/web/src/app/AppRouter.tsx](apps/web/src/app/AppRouter.tsx)                 |
| Data fetching hook | [apps/web/src/hooks/useCompanyData.ts](apps/web/src/hooks/useCompanyData.ts)     |
| Shared types       | [packages/shared/src/types/](packages/shared/src/types/)                         |

## Common Pitfalls

1. **Forgetting `companyId` filter** → Cross-tenant data leak (CRITICAL)
2. **Direct Prisma in services** → Violates 3-layer architecture
3. **Manual `try-catch` in frontend** → Use Axios interceptor + `apiAction()`
4. **Using `window.confirm`** → Use `useConfirm()` hook instead
5. **Forgetting `db:generate`** → After Prisma schema changes, must regenerate client

## Feature Development Checklist

**Backend:**

- [ ] Repository methods filter by `companyId`
- [ ] Service contains only business logic (no HTTP, no Prisma)
- [ ] Controller validates with Zod schemas
- [ ] Unit tests mock repository layer
- [ ] Integration tests use real DB

**Frontend:**

- [ ] Use `useCompanyData` for fetching
- [ ] Use `apiAction()` for mutations
- [ ] Use `useConfirm()` for destructive actions
- [ ] Co-locate in `features/{domain}/`
- [ ] Test with mocked contexts

## Spec-Driven Development

Feature specs are in `specs/###-feature-name/`:

- **spec.md**: User stories, requirements, edge cases
- **data-model.md**: Prisma schema changes
- **tasks.md**: Breakdown with parallel opportunities marked `[P]`
- **plan.md**: Technical implementation details

When implementing features, always check these files first for context.
