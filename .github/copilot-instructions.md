# GitHub Copilot Instructions for Sync ERP

Workspace-aware guide for AI agents building the Sync ERP multi-tenant ERP system. Focus on **multi-tenant isolation**, **idempotency**, **DI container patterns**, and **tRPC integration**.

**Quick Workspaces:**
- **sync-erp**: Main ERP monorepo (API, Web frontend, Bot service)
- **santi-living**: Astro + tRPC client consuming sync-erp API (ecommerce + ERP integration)

## Project Overview

Sync ERP is a **multi-tenant ERP system** built as **Turborepo monorepo** with strict company-level data isolation. The system is consumed by specialized external services (e.g., santi-living ecommerce) via tRPC client integration.

**Tech Stack:**
- **Backend**: Express.js + tRPC v11 + Prisma (PostgreSQL) + Vitest + Superjson (Date serialization)
- **Frontend**: React 18 + React Router + tRPC React Query + Tailwind CSS 4 + Vite
- **External Clients**: Astro, Next.js can consume via `@trpc/client` (examples: santi-living)
- **Shared**: Zod (auto-generated from Prisma + manual validators), TypeScript types

## Critical Patterns & Anti-Patterns

### 1. Multi-Tenant Isolation (CRITICAL - Data Leak Risk)

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

**tRPC Router pattern** (uses DI container to resolve services):

```typescript
// apps/api/src/trpc/routers/partner.router.ts
import { container, ServiceKeys } from '../../modules/common/di';

const partnerService = container.resolve<PartnerService>(ServiceKeys.PARTNER_SERVICE);

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

**Service pattern** (business logic, receives dependencies via constructor):

```typescript
// Services receive dependencies via DI - registered in register.ts
export class PartnerService {
  constructor(private readonly repository: PartnerRepository) {}
  
  async create(companyId: string, data: CreatePartnerInput): Promise<Partner> {
    return this.repository.create({ ...data, companyId });
  }
}
```

**DI Container** (lazy singleton, registered on app startup):

```typescript
// apps/api/src/modules/common/di/register.ts
container.register(ServiceKeys.PARTNER_SERVICE, () => 
  new PartnerService(container.resolve(ServiceKeys.PARTNER_REPOSITORY))
);

// In routers - resolve service instance
const partnerService = container.resolve<PartnerService>(ServiceKeys.PARTNER_SERVICE);
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
├── lib/trpcProvider.tsx     # TRPCProvider with QueryClient
├── types/api.ts             # Re-exported types from tRPC inference
├── features/{domain}/       # Co-locate pages, components
│   ├── pages/              # Domain-specific pages
│   └── components/         # Domain-specific components
├── components/
│   ├── ui/                 # Reusable atoms (StatusBadge, FormModal, etc.)
│   ├── layout/             # PageLayout, PageHeader
│   └── forms/              # Form components (PaymentModeSelector)
├── hooks/                  # Global hooks (useApiAction)
├── contexts/               # AuthContext, CompanyContext, SidebarContext
├── utils/                  # formatCurrency, formatDate
└── app/                    # AppRouter, AppProviders
```

**Data fetching with tRPC** (auto-typed, auto-invalidates):

```typescript
// Queries - always check company context
const { data: partners, isLoading } = trpc.partner.list.useQuery(
  { type: 'SUPPLIER' },
  { enabled: !!currentCompany?.id }  // Disable when no company
);

// Mutations - invalidate on success
const utils = trpc.useUtils();
const createMutation = trpc.partner.create.useMutation({
  onSuccess: () => utils.partner.list.invalidate(),
});
```

**API action helper** (for error handling with toast):

```typescript
import { apiAction } from '@/hooks/useApiAction';
const result = await apiAction(() => createMutation.mutateAsync(data), 'Created!');
```

**Type imports** (prefer `@/types/api` over `@sync-erp/shared` for entities):

```typescript
// ✅ Good - types inferred from tRPC
import type { Partner, Invoice, CreatePartnerInput } from '@/types/api';

// ✅ Good - enums/schemas still from shared (not inferable)
import { PaymentTermsSchema, OrderStatusSchema } from '@sync-erp/shared';
```

**Confirmation dialogs** (never use `window.confirm`):

```typescript
import { useConfirm } from '@/components/ui/ConfirmModal';
const confirm = useConfirm();
const proceed = await confirm({ message: 'Delete this?', variant: 'danger' });
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

### UI Components

Reusable components in [apps/web/src/components/ui/](apps/web/src/components/ui/):

| Component | Usage |
|-----------|-------|
| `PageHeader` | Detail page headers with back button, title, badges, actions |
| `StatusBadge` | Color-coded status for orders/invoices/documents |
| `FormModal` | Modal wrapper with title and backdrop |
| `ConfirmModal` + `useConfirm()` | Promise-based confirmation dialogs |
| `LoadingState` / `EmptyState` | Loading spinner and empty list placeholders |
| `OrderListTable` | Generic table for PO/SO lists with actions |

**Page layout pattern:**

```tsx
import { PageContainer, PageHeader } from '@/components/layout/PageLayout';

export default function MyPage() {
  return (
    <PageContainer>
      <PageHeader 
        title="Page Title" 
        actions={<Button>Action</Button>} 
      />
      {/* content */}
    </PageContainer>
  );
}
```

### Formatting Utilities

Use `@/utils/format` for consistent display:

```typescript
import { formatCurrency, formatDate } from '@/utils/format';
formatCurrency(100000); // "Rp 100.000" (IDR)
formatDate(new Date()); // "29 Desember 2025"
```

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

## Advanced Patterns

### 4. Idempotency (Request Deduplication)

Critical for creating orders, payments, and financial transactions where retry safety is required:

```typescript
// Backend: Define scope in tRPC router meta
export const purchaseRouter = router({
  create: protectedProcedure
    .meta({ idempotencyScope: IdempotencyScope.PURCHASE_ORDER })
    .input(CreatePurchaseOrderSchema)
    .mutation(async ({ ctx, input }) => {
      // IdempotencyMiddleware automatically handles: 
      // 1. Checks idempotencyKey (from request header)
      // 2. Returns cached response if duplicate detected
      // 3. Stores result for future retries
      return poService.create(ctx.companyId, input);
    }),
});

// Frontend: Pass idempotency key on critical mutations
const mutation = trpc.purchase.create.useMutation();
await mutation.mutateAsync(data, {
  idempotencyKey: `po-${Date.now()}-${Math.random()}`,
});
```

### 5. Business Shape Constraints

Companies have `businessShape` (PENDING, TRADING, SERVICE, HYBRID) controlling allowed features:

```typescript
// shapedProcedure blocks PENDING companies (not yet activated)
export const inventoryRouter = router({
  adjustStock: shapedProcedure.input(...).mutation(...), // Blocks PENDING
});

// Policy enforces rules
RentalPolicy.ensureCanRent(shape); // SERVICE companies cannot rent
PurchaseOrderPolicy.ensureCanPurchaseGoods(shape); // SERVICE cannot buy physical goods
```

### 6. Webhook Integration Pattern

External services (santi-living) receive real-time updates via webhooks:

```typescript
// Backend: RentalWebhookService notifies santi-living of inventory changes
// When rental order is confirmed → webhook sent to registered integration
// When rental returns → inventory updated, webhook to santi-living

// Webhook payload includes companyId, integrationId, eventType, data
// Receiver validates signature and processes state changes
```

### 7. Audit Logging (Auto via Prisma Middleware)

All mutations logged automatically:

```typescript
// Every create/update/delete triggers AuditLog record
prisma.auditLog.create({
  action: 'CREATE',
  entityType: 'PURCHASE_ORDER',
  companyId,
  userId,
  changes: { before: null, after: createdOrder },
});
```

## Multi-Workspace Development

### sync-erp (Main Monorepo)
- **API**: Express + tRPC, runs on port 3001
- **Web**: React frontend, runs on port 5173
- **Bot**: Standalone service for background jobs
- **Shared package**: Re-exported types, enums, validators
- **Database package**: Prisma client, migrations, seed scripts

### santi-living (External Consumer)
- Astro frontend consuming sync-erp via tRPC client
- ERP Sync Service (`apps/erp-service`) calls sync-erp APIs
- Separate webhook handling for rental updates
- Bot Service for WhatsApp order processing
- Uses `@trpc/client` with configured endpoint

**Development workflow**:
```bash
# Terminal 1: Start sync-erp (api + web + bot)
cd sync-erp && npm run dev

# Terminal 2: Start santi-living
cd santi-living && npm run dev

# Now both systems communicate:
# - santi-living frontend calls sync-erp API via tRPC
# - santi-living erp-service syncs orders and inventory
```

## Multi-Workspace Development

### sync-erp (Main Monorepo)
- **API**: Express + tRPC, runs on port 3001
- **Web**: React frontend, runs on port 5173
- **Bot**: Standalone service for background jobs
- **Shared package**: Re-exported types, enums, validators
- **Database package**: Prisma client, migrations, seed scripts

### santi-living (External Consumer)
- Astro frontend consuming sync-erp via tRPC client
- ERP Sync Service (`apps/erp-service`) calls sync-erp APIs
- Separate webhook handling for rental updates
- Bot Service for WhatsApp order processing
- Uses `@trpc/client` with configured endpoint

**Development workflow**:
```bash
# Terminal 1: Start sync-erp (api + web + bot)
cd sync-erp && npm run dev

# Terminal 2: Start santi-living
cd santi-living && npm run dev

# Now both systems communicate:
# - santi-living frontend calls sync-erp API via tRPC
# - santi-living erp-service syncs orders and inventory
```

## Implementation Quick Reference

### Adding a New Domain Feature

**1. Database Layer**
- Edit `packages/database/prisma/schema.prisma` (add models, enums)
- Run `npm run db:generate` (creates client + Zod schemas)

**2. Validation**
- Manual schemas in `packages/shared/src/validators/{domain}.ts` (override generated Zod)
- Export from `packages/shared/src/index.ts`

**3. Backend Service Layer**
```typescript
// apps/api/src/modules/{domain}/{domain}.repository.ts
export class PartnerRepository {
  async findByCompany(companyId: string) {
    return prisma.partner.findMany({ where: { companyId } });
  }
}

// apps/api/src/modules/{domain}/{domain}.service.ts
export class PartnerService {
  constructor(private repo: PartnerRepository) {}
  
  async create(companyId: string, data: CreatePartnerInput) {
    return this.repo.create({ ...data, companyId });
  }
}

// Register in apps/api/src/modules/common/di/register.ts
container.register(ServiceKeys.PARTNER_REPOSITORY, () => new PartnerRepository());
container.register(ServiceKeys.PARTNER_SERVICE, () => 
  new PartnerService(container.resolve(ServiceKeys.PARTNER_REPOSITORY))
);
```

**4. API Router**
```typescript
// apps/api/src/trpc/routers/partner.router.ts
import { container, ServiceKeys } from '../../modules/common/di';
const service = container.resolve(ServiceKeys.PARTNER_SERVICE);

export const partnerRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => service.list(ctx.companyId)),
  
  create: protectedProcedure
    .meta({ idempotencyScope: IdempotencyScope.PARTNER })
    .input(CreatePartnerSchema)
    .mutation(async ({ ctx, input }) => service.create(ctx.companyId, input)),
});

// Aggregate in apps/api/src/trpc/router.ts
export const appRouter = router({
  partner: partnerRouter,
  // ...
});
```

**5. Frontend**
```typescript
// apps/web/src/features/partner/pages/PartnerList.tsx
import { trpc } from '@/lib/trpc';

export default function PartnerList() {
  const utils = trpc.useUtils();
  const { data: partners } = trpc.partner.list.useQuery();
  const createMutation = trpc.partner.create.useMutation({
    onSuccess: () => utils.partner.list.invalidate(),
  });
  
  return (
    <PageContainer>
      <PageHeader title="Partners" />
      {/* render partners */}
    </PageContainer>
  );
}

// Add route in apps/web/src/app/AppRouter.tsx
<Route path="/partners" element={<PartnerList />} />
```

## Business Domain Patterns

### Procure-to-Pay (P2P)
- Purchase Order → Bill → Payment flow
- Uses `shapedProcedure` (blocks PENDING companies)
- Automatic journal entries for GL integration
- Idempotency required on payment mutations

### Sales Orders & Invoicing
- Sales Order → Invoice (optional) → Payment collection
- Inventory allocated when SO created
- Automatic invoice generation or manual
- Deposit handling for upfront payments

### Rental Business
- Rental Items with tiered pricing (daily/weekly/monthly)
- Rental Orders → Deposits → Tracking → Returns
- Damage assessments and reconciliation
- Real-time inventory unit tracking per rental

### Cash & Bank
- Cash transactions and bank reconciliation
- Account mappings (company accounts, GL integration)
- Transaction rules and payment modes
- Balance reporting and reconciliation

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "No registration found for SERVICE_KEY" | Service not registered in `register.ts` | Add registration in `container.register(ServiceKeys.XXX, ...)` |
| Cross-tenant data visible | Missing `companyId` filter in query | Add `where: { companyId }` to ALL Prisma queries |
| Type errors on tRPC inference | Frontend types out of sync | Run `npm run db:generate` in sync-erp (regenerates API types) |
| Idempotency not working | Missing `.meta({ idempotencyScope: ... })` | Add meta to mutation router definition |
| Business shape validation ignored | Using `protectedProcedure` instead | Change to `shapedProcedure` for inventory/order mutations |

## Testing Patterns

**Unit Test** (mock repository):
```typescript
describe('PartnerService', () => {
  it('should create partner', async () => {
    const mockRepo = { create: vi.fn() };
    const service = new PartnerService(mockRepo as any);
    await service.create('company-1', { name: 'Acme' });
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'company-1', name: 'Acme' })
    );
  });
});
```

**Integration Test** (real DB):
```typescript
describe('P2P Full Cycle', () => {
  it('should complete po -> bill -> payment', async () => {
    const result = await trpc.purchase.create.mutate(
      { name: 'PO-001', items: [...] },
      { ctx: { companyId: 'test-co', userId: 'user-1' } }
    );
    expect(result.id).toBeDefined();
  });
});
```

## Common Pitfalls

1. **Forgetting `companyId` filter** → Cross-tenant data leak (CRITICAL)
2. **Using wrong procedure type** → `protectedProcedure` for most ops, `shapedProcedure` for inventory/orders
3. **Forgetting `db:generate`** → After Prisma schema changes, regenerates client AND Zod schemas
4. **Direct Prisma in services** → Use repository layer for data access
5. **Not invalidating tRPC cache** → Call `utils.{router}.invalidate()` after mutations
6. **Missing idempotency on write operations** → Use `meta: { idempotencyScope: ... }` for order/payment mutations
7. **Not checking `businessShape`** → Some features blocked for PENDING or SERVICE companies
8. **Assuming localhost URLs in webhooks** → Use `WEBHOOK_BASE_URL` env var (Railway sets this to public domain)

## Feature Development Checklist

**Backend:**
- [ ] Add tRPC router in `apps/api/src/trpc/routers/{domain}.router.ts`
- [ ] Register router in `apps/api/src/trpc/router.ts`
- [ ] Create service with constructor DI for dependencies
- [ ] Register service in `apps/api/src/modules/common/di/register.ts`
- [ ] Add `ServiceKeys` constant in `container.ts`
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

Feature specs are in `specs/{###}-{feature-name}/`:
- **spec.md**: User stories, requirements, edge cases
- **data-model.md**: Prisma schema changes
- **tasks.md**: Breakdown with parallel opportunities marked `[P]`
- **plan.md**: Technical implementation details

When implementing features, always check these files first for context.
