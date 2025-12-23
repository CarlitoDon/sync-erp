---
trigger: model_decision
---

# AI Agent Instructions for Sync ERP

## Architecture Overview

Sync ERP is a **Multi-Tenant Monorepo** using the "Apple-Like Standard" (Rigid State Machines, Config-Hidden).

- **Frontend**: Vite + React + tRPC (`apps/web`)
- **Backend**: Express + tRPC + TypeScript (`apps/api`)
- **Database**: PostgreSQL + Prisma (`packages/database`)
- **Shared**: Zod Schemas + Constants (`packages/shared`)

### 4-Layer Backend Architecture (tRPC)

All business logic resides in `apps/api/src/trpc/modules/`:

1. **Router** (`*.router.ts`): tRPC procedures, input validation (Zod), context passing. **NO business logic.**
2. **Service** (`*.service.ts`): Orchestration ("Why"). Importing `prisma` here is **FORBIDDEN**.
3. **Policy** (`*.policy.ts`): Pure business constraints. **NO DB access.**
4. **Repository** (`*.repository.ts`): Data access ("How"). **Sole owner of `prisma` imports.**

## Key Patterns

### 1. Schema-First Development (Constitution II)

Every API field **MUST** start in `packages/shared`.

```typescript
// 1. Define in packages/shared/src/generated/zod/index.ts (AUTO-GENERATED) or validators
import { OrderStatusSchema } from '../generated/zod/index.js'; // ✅ Import derived types

// 2. Use in tRPC Router
export const router = t.router({
  create: protectedProcedure
    .input(CreateOrderSchema) // ✅ Validated by shared schema
    .mutation(...)
});
```

### 2. Service Purity (Constitution VIII)

Services orchestrate but never touch the DB directly.

```typescript
// ✅ Correct: Orchestration only
async createBill(data: CreateBillInput) {
  const order = await this.repo.findOrder(data.orderId);
  BillPolicy.ensureOrderReady(order); // 🔒 Policy Check
  return this.repo.create(data);      // 💾 Repo Call
}

// ❌ Incorrect: Direct DB access
async createBill(data) {
  if (order.status !== 'CONFIRMED') throw Error(); // ❌ Policy leak
  return prisma.bill.create({ ... });              // ❌ DB leak
}
```

### 3. Integration Testing Standards (Constitution XVII)

Business flows must be tested end-to-end in a single block.

```typescript
// test/integration/p2p-flow.test.ts
it('Full P2P Flow', async () => {
  const order = await createOrder();
  await confirmOrder(order.id);
  await receiveGoods(order.id); // GRN
  await createBill(order.id); // Bill
});
```

## Development Workflow

- **Build**: `npm run build` (Runs Turbo build for all packages)
- **Database**: `npm run db:generate` (Generates Prisma Client & Zod Schemas)
  - _Note_: This auto-patches Zod types to fix `decimal.js` issues.
- **Test**: `npm test` (Runs Vitest for all apps)
- **Lint**: `npx tsc --noEmit` (The ultimate source of truth)

## Do's and Don'ts

| Category    | Do                                      | Don't                                       |
| :---------- | :-------------------------------------- | :------------------------------------------ |
| **Enums**   | Import from `generated/zod`             | Hardcode `z.enum(['A', 'B'])` in validators |
| **Logic**   | Put business rules in `*.policy.ts`     | Put rules in Routers or Repositories        |
| **Decimal** | Use `Decimal.js` for math               | Use JS `number` (floats) for money          |
| **Files**   | Check `grep` for imports after creating | Leave "orphan" files unused                 |
| **Context** | Read related files before editing       | Blindly edit based on filename alone        |

## Key Files Reference

- **Constitution**: `.agent/rules/constitution.md` (The Law)
- **Memory**: `.agent/rules/memory.md` (Decisions & Patterns)
- **Shared Schemas**: `packages/shared/src/generated/zod/index.ts`
- **tRPC Context**: `apps/api/src/trpc/trpc.ts`
