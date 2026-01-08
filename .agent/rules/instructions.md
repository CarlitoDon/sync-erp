# AI Agent Instructions for Sync ERP

## Architecture Overview

Sync ERP is a **Multi-Tenant ERP Monorepo** using the "Apple-Like Standard" (Rigid State Machines, Config-Hidden).

```text
sync-erp/
├── apps/
│   ├── web/          # React + Vite + tRPC Client
│   └── api/          # Express + tRPC + TypeScript
├── packages/
│   ├── database/     # Prisma ORM + PostgreSQL
│   ├── shared/       # Zod Schemas + Types + Constants
│   └── eslint-plugin # Custom lint rules
```

**Tech Stack:**

- **Frontend**: Vite + React + tRPC React Query + Tailwind CSS 4
- **Backend**: Express + tRPC + Prisma + Vitest
- **Shared**: Auto-generated Zod schemas from Prisma + Manual validators

---

## 4-Layer Backend Architecture

All business logic is in `apps/api/src/modules/{domain}/`:

| Layer          | File Pattern      | Responsibility                                  | MUST NOT Do                    |
| :------------- | :---------------- | :---------------------------------------------- | :----------------------------- |
| **Router**     | `*.router.ts`     | tRPC procedures, Zod input validation           | Business logic, DB access      |
| **Service**    | `*.service.ts`    | Orchestration, Policy checks, Saga coordination | Import `prisma`, SQL knowledge |
| **Policy**     | `*.policy.ts`     | Pure business constraints ("can this run?")     | DB access, transactions        |
| **Repository** | `*.repository.ts` | Data access, Prisma queries, locks              | State logic, policy checks     |

### Procedure Types (in `apps/api/src/trpc/trpc.ts`)

- `publicProcedure` – No auth (health, auth endpoints)
- `authenticatedProcedure` – userId only (profile, company list)
- `protectedProcedure` – userId + companyId (most operations)
- `shapedProcedure` – Protected + active businessShape (blocks PENDING companies)

---

## Key Patterns

### 1. Schema-First Development (Constitution II)

Every API field **MUST** start in `packages/shared`:

```typescript
// ✅ Import generated enum schemas
import { OrderStatusSchema, PaymentTermsSchema } from '@sync-erp/shared';

// ✅ Use in tRPC Router
export const orderRouter = router({
  create: protectedProcedure
    .input(CreateOrderSchema)  // From packages/shared/src/validators/
    .mutation(async ({ ctx, input }) => { ... })
});
```

**❌ NEVER hardcode enums:**

```typescript
// ❌ Wrong
z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']);

// ✅ Correct
import { OrderStatusSchema } from '@sync-erp/shared';
```

### 2. Service Purity (Constitution III-A)

Services orchestrate but **NEVER** touch DB directly:

```typescript
// ✅ Correct: Service uses Policy + Repository
async createBill(ctx: Context, data: CreateBillInput) {
  const order = await this.orderRepo.findById(data.orderId);
  BillPolicy.ensureOrderConfirmed(order);  // 🔒 Policy
  return this.billRepo.create(data);        // 💾 Repository
}

// ❌ Wrong: Direct Prisma in Service
async createBill(data) {
  if (order.status !== 'CONFIRMED') throw Error();  // Policy leak
  return prisma.bill.create({ ... });               // DB leak
}
```

### 3. Multi-Tenant Isolation (CRITICAL)

**ALL queries MUST be scoped by `companyId`:**

```typescript
// tRPC context provides companyId from X-Company-Id header
const { companyId } = ctx;
prisma.product.findMany({ where: { companyId } }); // ALWAYS filter
```

### 4. DI Container Pattern

Services are resolved via DI container:

```typescript
// In router file
import { container, ServiceKeys } from '../../modules/common/di';
const partnerService = container.resolve<PartnerService>(
  ServiceKeys.PARTNER_SERVICE
);

// In router procedure
return partnerService.list(ctx.companyId, input?.type);
```

### 5. Integration Testing (Constitution XVII)

Business flows MUST be tested end-to-end in a **single `it()` block**:

```typescript
// ✅ Correct: Single block for complete flow
it('Full P2P Flow: PO → GRN → Bill → Payment', async () => {
  const order = await createOrder();
  await confirmOrder(order.id);
  await receiveGoods(order.id);
  const bill = await createBill(order.id);
  await postBill(bill.id);
  await recordPayment(bill.id);
});

// ❌ Wrong: Split across multiple it() blocks
```

---

## Development Workflow

```bash
# Development
npm run dev              # Start both api (3001) and web (5173)
npm run typecheck        # Full monorepo TypeScript check

# Database (after schema changes)
npm run db:generate      # Generates Prisma Client + Zod Schemas
npm run db:push          # Push schema to DB (dev only)
npm run db:migrate       # Production-safe migrations
npm run db:seed          # Seed with test data
npm run db:reseed:full   # Full reset + seed + API seed script

# Testing
npm run test             # All unit tests (Vitest)
npm run test:integration # Integration tests (real DB)

# Linting (Source of Truth)
npx tsc --noEmit         # Trust this over IDE hints
```

---

## Do's and Don'ts

| Category      | ✅ Do                                       | ❌ Don't                               |
| :------------ | :------------------------------------------ | :------------------------------------- |
| **Enums**     | Import from `@sync-erp/shared` generated    | Hardcode `z.enum(['A', 'B'])`          |
| **Logic**     | Put business rules in `*.policy.ts`         | Put rules in Routers or Repositories   |
| **DB Access** | Repository only imports `prisma`            | Service imports `prisma`               |
| **Decimal**   | Use `Decimal.js` for financial math         | Use JS `number` (floats) for money     |
| **Tests**     | Integration tests with real DB              | Mock repositories in integration tests |
| **Files**     | Grep for imports after creating files       | Leave orphan/unused files              |
| **Context**   | Read related files (outline) before editing | Blindly edit based on filename alone   |
| **Confirm**   | Use `useConfirm()` hook                     | Use `window.confirm()`                 |
| **Toast**     | Use `apiAction()` helper                    | Call `toast()` directly                |

---

## Key Files Reference

| Purpose               | File                                                  |
| :-------------------- | :---------------------------------------------------- |
| **Constitution**      | `.agent/rules/constitution.md` (The Law)              |
| **Memory**            | `.agent/rules/memory.md` (Decisions & Patterns)       |
| **tRPC Base**         | `apps/api/src/trpc/trpc.ts`                           |
| **tRPC Main Router**  | `apps/api/src/trpc/router.ts`                         |
| **DI Container**      | `apps/api/src/modules/common/di/`                     |
| **Shared Schemas**    | `packages/shared/src/generated/zod/index.ts`          |
| **Manual Validators** | `packages/shared/src/validators/`                     |
| **Prisma Schema**     | `packages/database/prisma/schema.prisma`              |
| **Frontend tRPC**     | `apps/web/src/lib/trpc.ts`                            |
| **Feature Specs**     | `specs/{number}-{name}/` (spec.md, plan.md, tasks.md) |

---

## Common Pitfalls

1. **Forgetting `companyId` filter** → Cross-tenant data leak (CRITICAL)
2. **Using wrong procedure type** → `protectedProcedure` for most ops, `shapedProcedure` for inventory/orders
3. **Forgetting `db:generate`** → After Prisma schema changes, regenerates client AND Zod schemas
4. **Direct Prisma in services** → Use repository layer for data access
5. **Not invalidating tRPC cache** → Call `utils.{router}.invalidate()` after mutations
6. **IDE lint stale** → Trust `npx tsc --noEmit` over IDE hints
