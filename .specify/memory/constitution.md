<!--
SYNC IMPACT REPORT
Version: 2.5.0 -> 2.5.1 (PATCH - Expanded Dumb Repository Guidance)
Modified Principles:
- III-A. Dumb Controller / Dumb Repository (Expanded with code examples, anti-patterns, Apple framing)
Added Sections:
- None (expansion of existing)
Removed Sections:
- None
Templates requiring updates:
- plan-template.md ✅ (already has III-A check)
- spec-template.md ✅ (no changes needed)
- tasks-template.md ✅ (no changes needed)
Follow-up TODOs:
- Update instructions.md with expanded Dumb Repository examples
Last Updated: 2025-12-18
-->

# Sync ERP Constitution

> "Simplicity is the ultimate sophistication."

## Core Principles (22 Total)

---

### Part A: Technical Architecture

### I. Architecture & Dependency Flow

```text
apps/web ─HTTP→ apps/api ─Repository→ packages/database
    ↓               ↓                       ↓
packages/shared ←── packages/shared ←── (Prisma types)
```

- **Frontend ↔ Backend**: `apps/web` MUST interact with `apps/api` via HTTP/REST only.
- **Database Access**: ONLY `packages/database` imports Prisma. Backend uses Repository pattern.
- **Dependency Direction**: `apps/` → `packages/shared` → `packages/database`. No cycles.
- **Workspace Links**: Use `workspace:*` protocol for internal dependencies.

### II. Shared Type Contracts

- **Single Source**: Types flow from Prisma → `packages/shared` → both apps.
- **Runtime Validation**: DTOs in `packages/shared/types` use Zod schemas.
- **Export All**: Validators MUST be re-exported from `packages/shared/src/validators/index.ts`.
- **Type Inference**: Use `z.infer<typeof Schema>` instead of manual interface definitions.

### III. Layered Backend (Route → Controller → Service → Policy → Repository)

| Layer          | Location                      | Responsibility                                                            | Can Import                |
| :------------- | :---------------------------- | :------------------------------------------------------------------------ | :------------------------ |
| **Route**      | `src/routes/*.ts`             | **Dump Adapter**: Maps URL → Controller. No Logic.                        | Controller, Middleware    |
| **Controller** | `src/modules/*/controller.ts` | **HTTP Boundary**: Req/Res, Validation. No Business Logic.                | Service                   |
| **Service**    | `src/modules/*/service.ts`    | **Orchestrator**: The "Why". Combines Rules + Repo.                       | Policy, Rules, Repository |
| **Rules**      | `src/modules/*/rules/*.ts`    | **Pure Business Logic**: Stateless, Integration Testable (Unit optional). | None (Pure)               |
| **Policy**     | `src/modules/*/policy.ts`     | **Shape Constraints**: "Can this run?"                                    | Shared Constants          |
| **Repository** | `src/modules/*/repository.ts` | **Data Access**: Query, Transaction. No Rules.                            | `packages/database`       |

### III-A. Dumb Controller / Dumb Repository Principle

> **Repository knows _how_ to talk to the database, not _why_ a write is allowed.**

**Layer Responsibility Map**:

| Layer      | Knows about                         | Must NOT know about                          |
| ---------- | ----------------------------------- | -------------------------------------------- |
| Controller | HTTP, auth, DTO                     | Business rules                               |
| Service    | Use case, state rules, policy, saga | SQL, table shape                             |
| Repository | Persistence, queries, locks         | State machine, policy, saga, business intent |
| Policy     | Business constraints                | DB, transactions                             |

Repository sits **below** business intent.

#### What "Dumb Repository" Actually Means

It does **not** mean CRUD-only. It means **no branching based on business meaning**.

**Repository MAY do**:

- SQL shape optimization
- Atomic guards (`balance: { gte: amount }`)
- Optimistic concurrency
- Row locking (`SELECT ... FOR UPDATE`)
- Aggregate-safe updates
- Transaction client support (`tx?: Prisma.TransactionClient`)

**Correct Example** (Technical Integrity, not Business Logic):

```typescript
decreaseBalanceWithGuard(
  invoiceId: string,
  amount: number,
  tx?: Prisma.TransactionClient
) {
  return (tx || prisma).invoice.update({
    where: {
      id: invoiceId,
      balance: { gte: amount }  // Atomic guard - technical integrity
    },
    data: {
      balance: { decrement: amount }
    }
  });
}
```

#### Repository MUST NOT Do

**❌ State Logic**:

```typescript
if (invoice.status !== 'POSTED') throw new Error('...');
```

**❌ Policy Checks**:

```typescript
if (company.shape === 'SERVICE') throw new Error('...');
```

**❌ Intent Branching**:

```typescript
if (paymentType === 'REFUND') { ... } else { ... }
```

**❌ Saga Orchestration**:

```typescript
try {
  updateInvoice();
  createJournal();
} catch {
  compensate();
}
```

The moment repository starts asking "should I do this?", the boundary is lost.

#### Controller vs Repository Comparison

| Aspect                    | Controller | Repository |
| ------------------------- | ---------- | ---------- |
| Owns business rules       | ❌         | ❌         |
| Owns data shape           | ❌         | ✅         |
| Knows HTTP                | ✅         | ❌         |
| Knows DB                  | ❌         | ✅         |
| Can enforce atomic guards | ❌         | ✅         |

**Controller is dumb about domain.**
**Repository is dumb about intent.**

#### Common Mistakes to Avoid

**Mistake 1: "Just one small check"**

```typescript
if (invoice.status === 'PAID') throw new Error('...');
```

This spreads domain rules everywhere. Later you will miss one path.

**Mistake 2: "Helper logic"**

```typescript
createPaymentAndUpdateInvoice(); // Repository as service in disguise
```

**Mistake 3: Policy leaking downward**

```typescript
if (!policy.canPay(invoice)) return null;
```

Policy must never depend on persistence.

#### Mental Test

Before adding logic to repository, ask:

> "If tomorrow I move from Prisma to raw SQL, would this logic still make sense here?"

- **Yes** → It may belong in Repository
- **No** → It belongs in Service or Policy

#### Apple-Like Framing

> Repositories are **mechanics**, not **judges**.
> They ensure the engine doesn't explode.
> They never decide where the car is allowed to go.

### IV. Multi-Tenant Isolation

- ALL queries MUST scope by `companyId` via `X-Company-Id` header.
- NO cross-company data access allowed.

### V. Frontend Architecture & Patterns

**Structure**:

- `src/features/[domain]/` - Business logic (components, hooks, services, types)
- `src/components/ui/` - Generic UI atoms only (NO business logic)

**Refined Rules**:

- **No Local Logic**: Frontend components MUST NOT calculate derived business state.
- **State Projection**: UI purely renders the `backendState` and reacts to `HTTP 200/400`.

**Mandatory Patterns**:
| Pattern | Implementation | Forbidden |
|---------|----------------|-----------|
| State Projection | UI renders usage of `backendState` | Local complex conditionals |
| Error handling | Axios interceptor | Per-page try-catch |
| Success feedback | `apiAction()` helper | Direct `toast()` |
| Confirmation | `useConfirm()` hook | `window.confirm()` |
| Loading states | Hook returns `loading` | Manual flags |

### VI. Systematic Refactoring

1. **Search First**: `grep -r "pattern" apps/ --include="*.tsx"`
2. **Update All**: Change ALL occurrences in single commit
3. **Verify Zero**: Search again to confirm no remaining instances
4. **Commit Often**: One commit per feature, not per session

### VII. Callback-Safe Services

Frontend services MUST use standalone functions, NOT object methods with `this`:

```typescript
// ✅ Correct                    // ❌ Wrong
export const svc = { getData };   export const svc = {
async function getData() {...}      async getData() { this.x }  // 'this' lost!
                                  }
```

### VIII. Build Verification

Before marking ANY task complete:

```bash
npx tsc --noEmit              # TypeScript check (source of truth)
npm run build                 # Full build (before merge)
# If packages/shared modified: cd packages/shared && npm run build
```

Check `typecheck:watch` terminal if running. IDE errors may be stale.

### IX. Schema-First Development

**Problem Prevented**: Zod strips unknown fields silently.

**Workflow** (MUST follow for new API fields):

```text
1. Schema First  → Add field to packages/shared/src/validators/*.ts
2. Export Type   → export type Input = z.infer<typeof Schema>
3. Frontend      → Import type from @sync-erp/shared, NOT manual interface
4. Backend       → Service receives validated data with all fields
5. Rebuild       → cd packages/shared && npm run build
```

**Rules**:
| Rule | Enforcement |
|------|-------------|
| New API field | MUST exist in Zod schema BEFORE frontend/backend code |
| Frontend types | MUST use `z.infer<typeof Schema>` from shared |
| Manual interfaces | FORBIDDEN for API request/response types |
| Schema rebuild | REQUIRED after any schema change |

**Example** (Correct):

```typescript
// packages/shared/src/validators/index.ts
export const CreateOrderSchema = z.object({
  partnerId: z.string().uuid(),
  items: z.array(OrderItemSchema),
  taxRate: z.number().optional(),  // ← Schema first!
});
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

// apps/web - uses shared type
import { CreateOrderInput } from '@sync-erp/shared';
const [form, setForm] = useState<CreateOrderInput>({...});
```

**Rationale**: Prevents silent data loss from Zod stripping unknown fields.

### X. Modular Parity (Symmetry)

- **Mirror Implementation**: Related domains (e.g., Sales ↔ Procurement) MUST implement equivalent features.
- **Cognitive Consistency**: Use identical naming patterns and UI layouts.

### XI. Performance by Design (Preventing N+1)

- **Backend Optimization**: Repositories MUST support eager loading (`include` or joins).
- **Forbidden**: Frontend MUST NOT fetch individual related records inside a loop.
- **404 Handling**: Avoid patterns where missing 1:1 relations trigger error toasts.

### XII. The Apple-Like Standard (Core Tenets)

- **Decision Lives Once**: The "Business Shape" dictates all downstream logic.
- **State > CRUD**: The core system is driven by explicit rigid state machines.
- **Invisible Complexity**: Never ask the user a technical question.
- **No Knobs**: Configuration tables exist but are hidden from the user interface.

### XIII. The Data Flow Standard (Single Direction of Truth)

```text
UI → API → Controller → Service → Rules/Policy → Repository → DB
↑                                                             ↓
└──────────────────────── (Response) ─────────────────────────┘
```

1.  **Frontend Never "Key"**: Frontend is a read-only projection.
2.  **Backend Always Wins**: All decisions happen in Service/Rules.
3.  **Feature = Service + Rule**: Not controller or route.
4.  **Onboarding is Config**: Toggles flags, not logic.

---

### Part B: Human Experience Philosophy

### XIV. Human Interface & Design Philosophy

Our primary goal is to create an application that feels **clear, intuitive, and effortless**.

**Simplicity & Clarity**:

- **Essentialism**: Ruthlessly cut non-essential features and visual noise.
- **Clear Navigation**: Users MUST never wonder "where am I?" or "what do I do next?".
- **Visuals**: Adopt a clean, minimalist aesthetic. Prefer designed lists over generic tables.

**Human-Centered Design**:

- **Emotional Connection**: The app MUST be pleasing to use ("delightful") and feel stable.
- **Simplified Workflows**: Break complex ERP tasks into linear, bite-sized steps (Wizards).
- **Assistance**: Anticipate user needs with smart suggestions.

### XV. Privacy by Design

We treat user data with the same respect as Apple treats personal data.

**Minimization & Transparency**:

- **Opt-In**: Explicitly ask for permission before accessing sensitive interactions.
- **Transparency**: Clearly explain _why_ data is needed.
- **Local Processing**: Where possible, process data on the client side.

**Security**:

- **Access Control**: Strict Role-Based Access Control (RBAC).
- **Encryption**: Sensitive business data MUST be treated as confidential.

### XVI. Engineering Excellence

Apple-like software is not just about looks; it is about how it runs.

**Performance-First**:

- **Responsiveness**: UI MUST remain fluid (60fps). Interactions MUST feel instant.
- **Efficiency**: Background heavy calculations so the main thread never blocks.
- **Instant Launch**: Use optimistic UI updates to make network requests feel instantaneous.

**Architecture & Quality**:

- **Modularity**: Code is organized into strict, decoupled modules.
- **CI/CD**: "Test early, test often." Automated pipelines MUST verify every commit.
- **Maintainability**: Code MUST be clean, readable, and standard-compliant.

### XVII. Development Standards (The Non-Negotiables)

1.  **Zero-Lag Rule**: No interaction MUST freeze the UI.
2.  **Pixel Perfection**: Alignment, spacing, and typography MUST be consistent.
3.  **Battery/Resource Minded**: Avoid unnecessary polling or heavy background scripts.
4.  **Tests as Spec**: Every feature MUST have accompanying tests. **Integration Tests are MANDATORY** for business flows and cross-layer logic. Unit tests are encouraged only for isolated pure logic in `rules/` if beneficial.

---

### Part C: Testing & Data Integrity

### XVIII. Test Contract Compliance

**Principle**: Mock return values MUST satisfy all implicit contracts expected by consuming layers.

**The Problem**:

```typescript
// ❌ Incomplete mock fails at Policy layer
mockRepo.findOrder.mockResolvedValue({ id, items: [] });
// Error: "Order must be CONFIRMED" (Policy expects status field)
```

**The Solution**:

```typescript
// ✅ Complete mock satisfies Policy requirements
mockRepo.findOrder.mockResolvedValue({
  id,
  items: [{ productId, quantity: 10, price: 100 }],
  status: 'CONFIRMED', // Policy.ensureOrderConfirmed() needs this
  partnerId: 'partner-1',
});
```

**Rules**:
| Rule | Enforcement |
|------|-------------|
| Layer contracts | Mock MUST include all fields checked by Policy/Service |
| Dependency mocks | Mock ALL repositories/services that the tested service calls |
| State prerequisites | If Policy checks status, mock MUST return valid status |

**Rationale**: Layered architecture means each layer has expectations from the layer below. Mocks that don't meet these expectations produce false test failures unrelated to the code being tested.

### XIX. Financial Precision (Decimal Handling)

**Principle**: Financial values MUST use Decimal type; convert to Number only for comparisons.

**The Problem**:

```typescript
// JavaScript floating point is imprecise
0.1 + 0.2 === 0.3; // false! (0.30000000000000004)

// Prisma Decimal is an object, not primitive
expect(payment.amount).toBe(555000); // FAIL: Decimal !== number
```

**The Solution**:

```typescript
// ✅ Convert Decimal to Number for assertions
expect(Number(payment.amount)).toBe(555000);
expect(Number(invoice.balance)).toBeCloseTo(0, 2);

// ✅ Use Decimal.js for calculations
const total = Decimal(subtotal).add(tax);
```

**Rules**:
| Context | Use |
|---------|-----|
| Database fields | Prisma `Decimal` type |
| Business calculations | `Decimal.js` library |
| Test assertions | `Number(value)` wrapper |
| Display formatting | `toFixed(2)` after conversion |

**Rationale**: IEEE 754 floating point cannot precisely represent all decimals. Financial systems require exact arithmetic (e.g., 0.1 + 0.2 = 0.3 exactly).

### XX. Integration Test as Tracked Tasks

**Principle**: Integration tests are **first-class tasks** with lifecycle status, not just code sections.

#### Task Status Notation

Integration tests MUST be tracked using status markers:

| Marker | Status      | Meaning                                |
| ------ | ----------- | -------------------------------------- |
| `[ ]`  | TODO        | Test not started, requirements defined |
| `[/]`  | In Progress | Test implementation ongoing            |
| `[x]`  | Finished    | Test passing, reviewed, merged         |

**Example in tasks.md**:

```markdown
### Integration Tests

- [x] P2P Full Cycle: PO → GRN → Bill → Post → Pay
- [/] O2C Full Cycle: SO → Ship → Invoice → Post → Receive
- [ ] Tax Cycle: Purchase with VAT → Reclaim
- [ ] Returns Cycle: Credit Note → Reversal Journal
```

#### Sequential Flow Rule

**Principle**: Sequential business flows MUST be tested in a single test block, not split across multiple `it()` blocks.

**The Problem**:

```typescript
// ❌ Variables don't persist across it() blocks
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

**The Solution**:

```typescript
// ✅ Single block for complete flow
it('Full P2P Flow: PO -> GRN -> Bill -> Post', async () => {
  const order = await createOrder();
  await confirmOrder(order.id);
  await processGRN(order.id);
  const bill = await createBill(order.id); // orderId guaranteed
  await postBill(bill.id);
  // All assertions here
});
```

#### Task Management Rules

| Rule          | Enforcement                                  |
| ------------- | -------------------------------------------- |
| Every feature | MUST have at least one integration test task |
| Task naming   | Use flow notation: `A → B → C`               |
| Status update | Update marker when status changes            |
| Blocking      | `[/]` tasks block feature completion         |
| Review        | `[x]` requires passing CI + code review      |

**Rationale**: Treating integration tests as tracked tasks ensures visibility into test coverage and prevents features from being marked complete without proper testing.

### XXI. Schema is Source of Truth (Raw SQL Alignment)

**Principle**: Raw SQL queries MUST use column names exactly as defined in Prisma schema.

**The Problem**:

```typescript
// Prisma Schema
model JournalLine {
  journalId String  // ← actual column name
}

// ❌ Wrong column name in raw SQL
prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "entryId" IN ...`
// Error: ColumnNotFound
```

**The Solution**:

```typescript
// ✅ Always verify against schema
prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN ...`;
```

**Rules**:
| Rule | Enforcement |
|------|-------------|
| Column names | MUST match Prisma schema exactly |
| Table names | Use quoted PascalCase as defined in schema |
| Prefer ORM | Use `prisma.model.deleteMany()` over raw SQL when possible |
| Raw SQL review | Double-check schema before any `$executeRaw` |

**Rationale**: ORM abstractions can be "leaky". When bypassing Prisma with raw SQL, you lose schema validation and must match database reality exactly.

### XXII. Seed Data Completeness

**Principle**: Seed files MUST include all data that services expect to exist at runtime.

**The Problem**:

```typescript
// JournalService.postInvoice expects these accounts:
lines: [
  { accountCode: '1300' }, // AR
  { accountCode: '4100' }, // Revenue
  { accountCode: '2300' }, // VAT Payable
];
// Error: "System Account code 4100 not found"
```

**The Solution**:

```typescript
// Seed MUST include all expected accounts
const ACCOUNTS = [
  { code: '1100', name: 'Cash' },
  { code: '1200', name: 'Bank' },
  { code: '1300', name: 'AR' },
  { code: '1400', name: 'Inventory' },
  { code: '1500', name: 'VAT Receivable' },
  { code: '2100', name: 'AP' },
  { code: '2105', name: 'GRNI Accrual' },
  { code: '2300', name: 'VAT Payable' },
  { code: '4100', name: 'Revenue' },
  { code: '5000', name: 'COGS' },
];
```

**Rules**:
| Data Type | Seed Location | Used By |
|-----------|---------------|---------|
| Chart of Accounts | `packages/database/prisma/seed.ts` | JournalService |
| System Configs | Base seed | PolicyService, ConfigService |
| Default Roles | Base seed | AuthService |
| Test fixtures | `test/fixtures/` | Integration tests |

**Rationale**: Services often have implicit dependencies on reference data (accounts, configs, roles). Missing seed data causes runtime errors that are hard to debug.

---

## Project Structure

```text
sync-erp/
├── apps/
│   ├── web/src/                    # Vite + React (State Projection)
│   └── api/src/                    # Express + TS (Orchestrator)
│       ├── routes/                 # Dumb Adapters
│       └── modules/[domain]/       # DOMAIN-FIRST STRUCTURE
│           ├── controller.ts       # HTTP Boundary
│           ├── service.ts          # Orchestrator
│           ├── policy.ts           # Shape Constraints
│           ├── rules/              # Pure Logic
│           └── repository.ts       # Data Access
```

## Governance

- **Authority**: This Constitution supersedes all other preferences.
- **Amendments**: Require PR + team consensus.
- **Compliance**: Code reviews MUST verify principle adherence.
- **Tooling**: `npm` + `turbo` + `vite` (frontend) + `tsc` (backend).

**Version**: 2.5.1 | **Ratified**: 2025-12-08 | **Last Amended**: 2025-12-18
