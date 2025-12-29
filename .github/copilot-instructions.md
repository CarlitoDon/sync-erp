# Copilot Instructions for Sync ERP

## Project Overview

Sync ERP is a **multi-tenant ERP system** built as a **Turborepo monorepo** with TypeScript. The MVP covers Sales, Finance/Accounting, Purchasing, and Inventory with strict company-level data isolation.

**Tech Stack:**

- **Backend**: Express.js + **tRPC** + Prisma (PostgreSQL) + Vitest
- **Frontend**: React 18 + React Router + **tRPC React Query** + Tailwind CSS 4 + Vite
- **Shared**: Zod validation schemas (auto-generated from Prisma + manual), TypeScript types

## Architecture Fundamentals

### 1. Multi-Tenant Isolation (CRITICAL)

**ALL backend queries MUST be scoped by `companyId`:**

```typescript
// tRPC context provides companyId from X-Company-Id header
const { companyId } = ctx; // Set by tRPC context from auth middleware
prisma.product.findMany({ where: { companyId } }); // ALWAYS filter
```

**Auth flow:**

- Session cookie (`sessionId`) validates user identity
- `X-Company-Id` header (set by frontend TRPCProvider) validates company membership
- tRPC context receives `userId`, `companyId`, and `businessShape`
- Use `protectedProcedure` (requires auth + company) or `authenticatedProcedure` (auth only)

### 2. Backend: tRPC + Service + Repository

**Backend uses tRPC routers that call services:**

```
apps/api/src/
├── trpc/
│   ├── trpc.ts              # Base procedures (public, authenticated, protected, shaped)
│   ├── router.ts            # Main router aggregating all domain routers
│   ├── context.ts           # Request context with auth info
│   └── routers/             # Domain-specific routers
│       └── {domain}.router.ts
├── modules/{domain}/
│   ├── {domain}.service.ts      # Business logic only
│   ├── {domain}.repository.ts   # Prisma data access only
│   └── {domain}.policy.ts       # Business rules/constraints (optional)
```

**tRPC Router pattern** (replaces controllers):

```typescript
// apps/api/src/trpc/routers/partner.router.ts
export const partnerRouter = router({
  list: protectedProcedure
    .input(z.object({ type: z.nativeEnum(PartnerType).optional() }).optional())
    .query(async ({ ctx, input }) => {
      return partnerService.list(ctx.companyId, input?.type);
    }),

  create: protectedProcedure
    .input(CreatePartnerSchema) // Zod schema from @sync-erp/shared
    .mutation(async ({ ctx, input }) => {
      return partnerService.create(ctx.companyId, input);
    }),
});
```

**Procedure types** (in [apps/api/src/trpc/trpc.ts](apps/api/src/trpc/trpc.ts)):
- `publicProcedure` - No auth required (health, auth endpoints)
- `authenticatedProcedure` - Requires userId only (user profile, company list)
- `protectedProcedure` - Requires userId AND companyId (most business operations)
- `shapedProcedure` - Protected + requires active businessShape (blocks PENDING companies)

**Service pattern** (business logic, NO HTTP, NO Prisma):

```typescript
async create(companyId: string, data: CreatePartnerInput): Promise<Partner> {
  // Business rules enforced here
  return this.repository.create({ ...data, companyId });
}
```

**Policy pattern** (business constraints, used by services):

```typescript
// apps/api/src/modules/procurement/purchase-order.policy.ts
static ensureCanPurchasePhysicalGoods(shape: BusinessShape): void {
  if (shape === BusinessShape.SERVICE) {
    throw new DomainError('Service companies cannot purchase physical goods', 400);
  }
}
```

### 3. Frontend: tRPC + Feature-Based Structure

```
apps/web/src/
├── lib/trpc.ts              # tRPC client setup
├── features/{domain}/       # Co-locate pages, components
│   ├── pages/              # Domain-specific pages
│   └── components/         # Domain-specific components
├── components/ui/          # Reusable UI atoms
├── hooks/                  # Global hooks (useApiAction)
├── contexts/               # AuthContext, CompanyContext
└── app/                    # AppRouter, AppProviders, TRPCProvider
```

**Data fetching with tRPC** (auto-typed, auto-invalidates):

```typescript
// Queries
const { data: partners, isLoading } = trpc.partner.list.useQuery({ type: 'SUPPLIER' });

// Mutations with optimistic updates
const createMutation = trpc.partner.create.useMutation({
  onSuccess: () => {
    utils.partner.list.invalidate(); // Invalidate cache
    toast.success('Partner created!');
  },
});
```

**API action helper** (for error handling):

```typescript
const result = await apiAction(() => createMutation.mutateAsync(data), 'Created!');
```

## Developer Workflows

### Database Commands

```bash
npm run db:generate   # Prisma client + Zod schemas (REQUIRED after schema changes)
npm run db:push       # Push schema to DB (dev only, no migrations)
npm run db:migrate    # Create and apply migration (production-safe)
npm run db:seed       # Seed database with test data
npm run db:studio     # Open Prisma Studio GUI
npm run db:reseed:full # Full reset + seed + API seed script
```

### Development

```bash
npm run dev           # Starts both api (3001) and web (5173)
npm run dev:api       # API only
npm run dev:web       # Web only
npm run typecheck     # Validate TypeScript across monorepo
```

### Testing

```bash
npm run test                              # All tests (Vitest)
npm run test --workspace=@sync-erp/api    # Backend only
npm run test --workspace=@sync-erp/web    # Frontend only
npm run test:integration                  # Integration tests (real DB)
```

**Backend test structure:**
- `test/unit/` - Service tests with mocked repositories
- `test/integration/` - Full flow tests with real DB (e.g., `p2p-full-cycle.test.ts`)
- `test/e2e/` - End-to-end business flow tests

## Project-Specific Conventions

### Validation & Types

- **Zod schemas generated from Prisma** via `zod-prisma-types` → `packages/shared/src/generated/zod/`
- **Manual validators** for API inputs → `packages/shared/src/validators/` (e.g., `p2p.ts`, `finance.ts`)
- **Domain errors** with codes → `packages/shared/src/errors/domain-error.ts`

```typescript
// Using generated enum schemas
import { PaymentTermsSchema } from '@sync-erp/shared';
const input = z.object({ paymentTerms: PaymentTermsSchema.optional().default('NET30') });

// Throwing domain errors
throw new DomainError('Partner not found', 404, DomainErrorCodes.PARTNER_NOT_FOUND);
```

### BusinessShape Constraints

Companies have a `businessShape` (PENDING, TRADING, SERVICE, HYBRID) that controls allowed operations:

```typescript
// Policy enforces shape constraints
PurchaseOrderPolicy.ensureCanPurchasePhysicalGoods(shape);

// Use shapedProcedure for operations requiring active shape
export const purchaseRouter = router({
  create: shapedProcedure.input(...).mutation(...), // Blocks PENDING companies
});
```

### Document Numbering

Auto-generated sequential numbers per company:

```typescript
const orderNumber = await this.documentNumberService.generate(companyId, 'PO'); // → "PO-0001"
```

### State Management

- **React Context** for auth/company (`AuthContext`, `CompanyContext`)
- **tRPC React Query** for server state (automatic caching/invalidation)
- **Company context** persists to `localStorage`, invalidates all queries on change

### Styling

- **Tailwind CSS 4** with `@tailwindcss/vite` plugin
- Consistent spacing (`space-y-4`, `gap-4`) and colors (`primary-600`, `gray-500`)

## Key Files Reference

| Purpose               | File                                                               |
| --------------------- | ------------------------------------------------------------------ |
| tRPC base procedures  | [apps/api/src/trpc/trpc.ts](apps/api/src/trpc/trpc.ts)             |
| Main router           | [apps/api/src/trpc/router.ts](apps/api/src/trpc/router.ts)         |
| tRPC context          | [apps/api/src/trpc/context.ts](apps/api/src/trpc/context.ts)       |
| Auth middleware       | [apps/api/src/middlewares/auth.ts](apps/api/src/middlewares/auth.ts) |
| Prisma schema         | [packages/database/prisma/schema.prisma](packages/database/prisma/schema.prisma) |
| Shared validators     | [packages/shared/src/validators/](packages/shared/src/validators/) |
| Frontend tRPC client  | [apps/web/src/lib/trpc.ts](apps/web/src/lib/trpc.ts)               |
| Frontend router       | [apps/web/src/app/AppRouter.tsx](apps/web/src/app/AppRouter.tsx)   |
| DI Container          | [apps/api/src/modules/common/di/](apps/api/src/modules/common/di/) |

## Common Pitfalls

1. **Forgetting `companyId` filter** → Cross-tenant data leak (CRITICAL)
2. **Using wrong procedure type** → `protectedProcedure` for most ops, `shapedProcedure` for inventory/orders
3. **Forgetting `db:generate`** → After Prisma schema changes, regenerates client AND Zod schemas
4. **Direct Prisma in services** → Use repository layer for data access
5. **Not invalidating tRPC cache** → Call `utils.{router}.invalidate()` after mutations

## Feature Development Checklist

**Backend:**
- [ ] Add tRPC router in `apps/api/src/trpc/routers/{domain}.router.ts`
- [ ] Register router in `apps/api/src/trpc/router.ts`
- [ ] Service methods receive `companyId` as first param
- [ ] Repository methods filter by `companyId`
- [ ] Add Policy class if business rules needed
- [ ] Integration tests in `test/integration/`

**Frontend:**
- [ ] Use `trpc.{router}.{method}.useQuery/useMutation()`
- [ ] Invalidate cache on mutations via `utils.{router}.invalidate()`
- [ ] Co-locate in `features/{domain}/`
- [ ] Add route in `AppRouter.tsx`

## Spec-Driven Development

Feature specs are in `specs/###-feature-name/`:
- **spec.md**: User stories, requirements, edge cases
- **data-model.md**: Prisma schema changes
- **tasks.md**: Breakdown with parallel opportunities marked `[P]`
- **plan.md**: Technical implementation details

When implementing features, always check these files first for context.
