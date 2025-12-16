<!--
SYNC IMPACT REPORT
Version: 2.2.0 -> 2.2.1 (PATCH - Restored Schema-First Example)
Modified Principles:
- IX. Schema-First Development (Restored Example and Rationale)
Added Sections:
- None
Removed Sections:
- None
Templates requiring updates:
- None
Follow-up TODOs:
- None
-->

# Sync ERP Constitution

> "Simplicity is the ultimate sophistication."

## Core Principles (17 Total)

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

| Layer          | Location                      | Responsibility                                             | Can Import                |
| :------------- | :---------------------------- | :--------------------------------------------------------- | :------------------------ |
| **Route**      | `src/routes/*.ts`             | **Dump Adapter**: Maps URL → Controller. No Logic.         | Controller, Middleware    |
| **Controller** | `src/modules/*/controller.ts` | **HTTP Boundary**: Req/Res, Validation. No Business Logic. | Service                   |
| **Service**    | `src/modules/*/service.ts`    | **Orchestrator**: The "Why". Combines Rules + Repo.        | Policy, Rules, Repository |
| **Rules**      | `src/modules/*/rules/*.ts`    | **Pure Business Logic**: Stateless, Unit Testable.         | None (Pure)               |
| **Policy**     | `src/modules/*/policy.ts`     | **Shape Constraints**: "Can this run?"                     | Shared Constants          |
| **Repository** | `src/modules/*/repository.ts` | **Data Access**: Query, Transaction. No Rules.             | `packages/database`       |

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
4.  **Tests as Spec**: Every feature MUST have accompanying tests.

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

**Version**: 2.2.1 | **Ratified**: 2025-12-08 | **Last Amended**: 2025-12-16
