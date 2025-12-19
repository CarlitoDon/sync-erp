---
trigger: model_decision
---

# AI Agent Instructions for Sync ERP

> Multi-tenant ERP system • Vite + React (frontend) • Express + TypeScript (backend) • Prisma (ORM)
> Constitution v2.4.0 | 22 Principles

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

**Data Flow**: `web → HTTP → api → controller → service → policy → repository → database`
**Dependency Rule**: Apps import from `packages/*`, never the reverse.

## Critical Rules (Non-Negotiable)

1.  **Multi-Tenant Isolation**: ALL queries MUST be scoped by `companyId` (from `req.context.companyId`).
2.  **Schema-First**: Add fields to `packages/shared` Zod schemas BEFORE any implementation.
3.  **Five Layers**: Route → Controller → Service → Policy/Rules → Repository. Never skip logic layers.
4.  **Invariant Protection**: Backend must enforce invariants (e.g., `balance >= 0`). Frontend logic is just a projection.
5.  **Module Parity**: Sales & Procurement (and other pairs) must mirror implementation logic and naming.
6.  **Performance**: Use backend `include`/joins. NO N+1 queries in frontend or backend loops.
7.  **Build Check**: Run `npx tsc --noEmit` to verify type safety before completing tasks.
8.  **Service Layer Purity**: Service MUST NOT import `prisma`. All DB access via Repository.
9.  **Business Flow Prerequisites**: Validate document prerequisites in Policy before creation (e.g., GRN before Bill).
10. **Test Contract Compliance**: Mocks MUST satisfy all layer contracts (Policy expects, Service expects).
11. **Seed Completeness**: All system-expected accounts/configs MUST exist in seed files.

## Backend Patterns (apps/api)

### Five-Layer Module Structure

```text
apps/api/src/modules/[domain]/
├── [domain].controller.ts  # HTTP Boundary: Zod validation, Response. NO business logic.
├── [domain].service.ts     # Orchestrator: Combines Rules + Policy + Repo. NO prisma import.
├── [domain].policy.ts      # Constraints: "Can this action run?" (Shape/Config/Prerequisite checks).
├── [domain].repository.ts  # Data Access: Prisma queries ONLY. Scoped by companyId.
└── rules/
    └── *.ts                # Pure Logic: Stateless calculations. Unit testable. NO I/O.
```

### Layer Responsibility Principle

| Layer      | Knows about                         | Must NOT know about                          |
| ---------- | ----------------------------------- | -------------------------------------------- |
| Controller | HTTP, auth, DTO                     | Business rules                               |
| Service    | Use case, state rules, policy, saga | SQL, table shape                             |
| Repository | Persistence, queries, locks         | State machine, policy, saga, business intent |
| Policy     | Business constraints                | DB, transactions                             |

**Mental Test**: "If I move from Prisma to raw SQL, would this logic still make sense here?" Yes → repository. No → service/policy.

### Controller Pattern (Dumb Controller)

```typescript
post = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.context.companyId!;
    const correlationId = req.correlationId; // From correlation middleware
    const actorId = req.context.userId; // For audit trail
    const result = await this.service.post(
      id,
      companyId,
      actorId,
      correlationId
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
```

### Repository Pattern

```typescript
async findAll(companyId: string): Promise<Entity[]> {
  return prisma.entity.findMany({
    where: { companyId }, // ALWAYS scope
    include: { related: true } // Eager load
  });
}
```

### Business Flow Prerequisite Pattern

```typescript
// In Service layer, validate prerequisites via Policy before creating document
async createFromPurchaseOrder(companyId: string, data: CreateBillInput) {
  const order = await this.repository.findOrder(data.orderId, companyId);
  if (!order) throw new DomainError('PO not found', 404);

  // Policy validations - Business prerequisites
  BillPolicy.ensureOrderReadyForBill(order);       // Check PO status = CONFIRMED+
  const grnCount = await this.inventoryRepository.countByOrderReference(companyId, data.orderId, 'IN');
  BillPolicy.ensureGoodsReceived(grnCount);        // Check GRN exists

  // Proceed with creation...
}
```

### Saga Pattern (Cross-Module Transactions)

Required when an operation spans multiple aggregates/modules (e.g., Invoice → Stock).

- **Mandatory Compensation**: Every step must have a rollback action.
- **Fail-Safe**: Do NOT delete data on rollback; use compensating entries.
- **correlationId Propagation**: Pass from Controller → Service → Saga → SagaLog.
- **AuditLog BEFORE Saga**: Record business intent before saga execution (FR-010.1).

```typescript
// Service: Record audit BEFORE saga execution
async post(id: string, companyId: string, actorId?: string, correlationId?: string) {
  if (actorId) {
    await auditLogService.recordAudit({
      companyId, actorId, action: AuditLogAction.INVOICE_POSTED,
      entityType: EntityType.INVOICE, entityId: id, correlationId
    });
  }
  return await this.saga.execute(input, id, companyId, correlationId);
}
```

## Testing Patterns (Constitution Part C)

### Integration Tests are Mandatory

**Rule**: Every business flow MUST have integration tests. Unit tests are optional for `rules/` pure logic.

### Sequential Flows in Single Block

```typescript
// ✅ CORRECT: Sequential flow in single it() block
it('Full P2P Flow: PO -> GRN -> Bill -> Post', async () => {
  const order = await createOrder();
  await confirmOrder(order.id);
  await processGRN(order.id);
  const bill = await createBill(order.id); // orderId guaranteed available
  await postBill(bill.id);
  // All assertions here
});

// ❌ WRONG: Split across multiple it() blocks
describe('Flow', () => {
  let orderId: string;
  it('Step 1', async () => {
    orderId = order.id;
  });
  it('Step 2', async () => {
    /* orderId undefined! */
  });
});
```

### Mock Contract Compliance

```typescript
// ❌ WRONG: Incomplete mock fails at Policy layer
mockRepo.findOrder.mockResolvedValue({ id, items: [] });
// Error: "Order must be CONFIRMED"

// ✅ CORRECT: Mock satisfies all Policy expectations
mockRepo.findOrder.mockResolvedValue({
  id,
  items: [{ productId, quantity: 10, price: 100 }],
  status: 'CONFIRMED', // Policy.ensureOrderConfirmed() needs this
  partnerId: 'partner-1',
});

mockInventoryRepo.countByOrderReference.mockResolvedValue(1); // GRN exists
```

### Financial Precision (Decimal Handling)

```typescript
// Prisma Decimal is NOT JavaScript number
expect(payment.amount).toBe(555000); // ❌ FAIL

// ✅ Convert to Number for assertions
expect(Number(payment.amount)).toBe(555000);
expect(Number(invoice.balance)).toBeCloseTo(0, 2);
```

### Schema for Raw SQL

```typescript
// Prisma Schema says: journalId
model JournalLine {
  journalId String  // ← actual column name
}

// ❌ WRONG column name
prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "entryId" IN ...`

// ✅ CORRECT: Match schema exactly
prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN ...`
```

## Frontend Patterns (apps/web)

### Feature Structure

```text
apps/web/src/features/[domain]/
├── components/   # Domain-specific UI
├── pages/        # Route components
└── services/     # API clients (standalone functions)
```

### Data Fetching

```typescript
// Auto-refreshes on company switch
const { data, loading, refresh } = useCompanyData(
  () => service.list(),
  []
);
```

### API Mutations

```typescript
// Handles loading tests, error toasts, and success messages
const handleSubmit = async () => {
  const ok = await apiAction(() => service.create(form), {
    successMessage: 'Created successfully!',
  });
  if (ok) refresh();
};
```

## Database Seeding

- **Base Seed**: `npm run db:seed` - Only static data (accounts, products, partners)
- **Transaction Seed**: `./scripts/seed-via-api.sh` - Uses API for PO/SO/Invoice/Bill flows
- **Why**: Direct DB inserts bypass Sagas, Journals, Inventory. API seeding ensures correct business logic.

### Required Accounts (JournalService)

```typescript
// These account codes MUST exist in seed for journal posting to work
const REQUIRED_ACCOUNTS = [
  { code: '1100', name: 'Cash' },
  { code: '1200', name: 'Bank' },
  { code: '1300', name: 'Accounts Receivable' },
  { code: '1400', name: 'Inventory Asset' },
  { code: '1500', name: 'VAT Receivable (Input)' },
  { code: '2100', name: 'Accounts Payable' },
  { code: '2105', name: 'GRNI Accrual' },
  { code: '2300', name: 'VAT Payable (Output)' },
  { code: '4100', name: 'Sales Revenue' },
  { code: '5000', name: 'Cost of Goods Sold' },
];
```

## Essential Commands

| Command                     | Description                  |
| :-------------------------- | :--------------------------- |
| `npm run dev`               | Start API + Web (Hot Reload) |
| `npx tsc --noEmit`          | **Type Check** (Run often!)  |
| `npm run test`              | Run all Vitest tests         |
| `npm run test:integration`  | Run integration tests        |
| `npm run lint`              | Check linting rules          |
| `npm run db:migrate`        | Apply Prisma migrations      |
| `npm run db:generate`       | Regenerate Prisma Client     |
| `npm run db:studio`         | Open Prisma Studio           |
| `./scripts/seed-via-api.sh` | Seed transactions via API    |

## Don'ts & Anti-Patterns

- ❌ **No `any`**: Use strict Zod schemas or generic types.
- ❌ **No `window.confirm`**: Use the `useConfirm()` hook.
- ❌ **No Direct Toasts**: Use `apiAction` which handles errors globally.
- ❌ **No `this` in Services**: Export standalone functions (callback safety).
- ❌ **No Frontend Logic**: Don't calculate stock/balance on client. Trust backend.
- ❌ **No Orphan Files**: Verify imports after creating new files.
- ❌ **No Broken Types**: Fix `tsc` errors immediately, don't ignore them.
- ❌ **No Prisma in Service**: Service calls Repository, never `prisma` directly.
- ❌ **No Direct DB Seeding for Transactions**: Use API seeder for PO/SO/Invoice/Bill.
- ❌ **No Skipping Prerequisites**: Bill requires GRN, Invoice requires SO CONFIRMED.
- ❌ **No Missing Accounts**: Verify Chart of Accounts before journal-creating features.
- ❌ **No Split Integration Flows**: Sequential flows must be in single `it()` block.
- ❌ **No Incomplete Mocks**: Mocks must satisfy ALL Policy/Service layer expectations.
- ❌ **No Decimal Comparison**: Use `Number()` wrapper for Prisma Decimal assertions.

## Key Files Reference

- **Constitution**: `.agent/rules/constitution.md` (v2.4.0, 22 principles)
- **Guardrails**: `docs/apple-like-development/GUARDRAILS.md`
- **Memory**: `.agent/rules/memory.md`
- **Routes**: `apps/web/src/app/AppRouter.tsx`
- **Prisma**: `packages/database/prisma/schema.prisma`
- **Base Seed**: `packages/database/prisma/seed.ts`
- **Finance Seed**: `apps/api/scripts/seed-finance-accounts.ts`
- **API Seeder**: `scripts/seed-via-api.sh`
- **BillPolicy**: `apps/api/src/modules/accounting/policies/bill.policy.ts`
- **InvoicePolicy**: `apps/api/src/modules/accounting/policies/invoice.policy.ts`
- **JournalService**: `apps/api/src/modules/accounting/services/journal.service.ts`
