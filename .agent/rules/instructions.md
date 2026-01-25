---
trigger: model_decision
description: berisi instruksi dalam mengerjakan pengembangan aplikasi
---

# AI Agent Instructions for Sync ERP

## Architecture Overview

Sync ERP is a strict monorepo following a specific dependency flow and layered architecture.

**Structure:**

- **Monorepo**: Turbo + NPM Workspaces.
- **Frontend**: `apps/web` (Vite + React). Pure state projection.
- **Backend**: `apps/api` (Node.js + Express + Prisma). Layered architecture.
- **Shared**: `packages/shared` (Zod schemas, types). The source of truth for contracts.
- **Database**: `packages/database` (Prisma schema). The source of truth for data shape.

**Dependency Flow:**
`apps/web` -> `apps/api` -> `packages/shared` <- `packages/database`

## Key Patterns

### 1. Schema-First Development

All API contracts start in `packages/shared`.

- Define Zod schema in `packages/shared/src/validators/`.
- Export inferred type: `export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;`.
- Rebuild shared: `cd packages/shared && npm run build`.
- Import in Frontend and Backend from `@sync-erp/shared`.

### 2. Layered Backend Architecture

Every module in `apps/api/src/modules/[domain]/` MUST follow this layer responsibility:

| Layer          | File              | Responsibility                                                    |
| -------------- | ----------------- | ----------------------------------------------------------------- |
| **Controller** | `*.controller.ts` | HTTP Boundary. Validates input. Calls Service. No business logic. |
| **Service**    | `*.service.ts`    | Orchestration. Calls Policy, Rules, Repository. "Why".            |
| **Rules**      | `rules/*.ts`      | Pure business logic. Stateless. Testable.                         |
| **Policy**     | `*.policy.ts`     | Business constraints (e.g. "Can this run?"). No DB access.        |
| **Repository** | `*.repository.ts` | Data Access. "How". Typesafe Prisma queries. No business logic.   |

**Example Service Method (The Golden Flow):**

```typescript
async createOrder(input: CreateOrderInput) {
  // 1. Prepare (Policy/Validation)
  await this.policy.canCreateOrder(input.companyId);

  // 2. Orchestrate (Saga)
  const data = this.rules.prepareOrderPayload(input);

  // 3. Execute (Repository Transaction)
  const order = await this.repo.transaction(async (tx) => {
    return this.repo.create(data, tx);
  });

  // 4. Post-Process (Side Effects)
  await this.events.emit('OrderCreated', order);
  return order;
}
```

### 3. Frontend State Projection

- UI components in `apps/web/src/features/[domain]/` must NOT contain business logic.
- They simply render backend state.
- No direct `axios` calls; use typed API actions.

### 4. Financial Precision

- Use `Decimal.js` for all calculations.
- Use `Decimal` type in Prisma.
- Only convert to `number` for display (`toFixed(2)`) or final assertions.

## Development Workflow

- **Start Dev**: `npm run dev` (Runs API and Web concurrently)
- **Database**:
  - `npm run db:migrate` (Run migrations)
  - `npm run db:seed` (Seed data - check `package.json` for dev/prod variants)
  - `npm run db:studio` (View DB)
- **Testing**: `turbo run test` (Run all tests)
- **Linting**: `turbo run lint`

## Do's and Don'ts

- **DO** use `packages/shared` for all types shared between FE and BE.
- **DO** verify `npx tsc --noEmit` returns zero errors before finishing.
- **DO** use the exact Prisma field names in raw SQL (quoted PascalCase: `"JournalLine"`).
- **DON'T** put business logic in Controllers or Repositories.
- **DON'T** use `any`. Use strict Zod schemas.
- **DON'T** start a task without reading `.agent/rules/constitution.md` if making architectural changes.

## Key Files Reference

- **Constitution**: `.agent/rules/constitution.md` (The Law)
- **Prisma Schema**: `packages/database/prisma/schema.prisma`
- **Shared Validators**: `packages/shared/src/validators/index.ts`
- **API Module Example**: `apps/api/src/modules/rental/`
