<!--
SYNC IMPACT REPORT
Version: 1.9.0 -> 1.10.0 (Minor - Added Modular Parity & Performance Principles)
Modified Principles:
- None
Added Sections:
- X. Modular Parity (Symmetry)
- XI. Performance by Design (Preventing N+1)
Removed Sections:
- None
Templates requiring updates:
- plan-template.md (✅ updated - added Principle X/XI checks)
- spec-template.md (✅ no changes needed)
- tasks-template.md (✅ no changes needed)
Follow-up TODOs:
- None
-->

# Sync ERP Constitution

## Core Principles (11 Total)

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

### III. Layered Backend (Controller → Service → Repository)

| Layer      | Location           | Responsibility               | Can Import          |
| ---------- | ------------------ | ---------------------------- | ------------------- |
| Controller | `src/controllers`  | HTTP, validation, formatting | Service             |
| Service    | `src/services`     | Business logic               | Repository          |
| Repository | `src/repositories` | Data access                  | `packages/database` |

### IV. Multi-Tenant Isolation

- ALL queries MUST scope by `companyId` via `X-Company-Id` header.
- NO cross-company data access allowed.

### V. Frontend Architecture & Patterns

**Structure**:

- `src/features/[domain]/` - Business logic (components, hooks, services, types)
- `src/components/ui/` - Generic UI atoms only (NO business logic)
- `src/hooks/`, `src/services/`, `src/utils/` - App-wide shared utilities

**Mandatory Patterns**:
| Pattern | Implementation | Forbidden |
|---------|----------------|-----------|
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

**Problem Prevented**: Zod strips unknown fields silently. If frontend sends a field not in schema, backend receives `undefined`.

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

- **Mirror Implementation**: Related domains (e.g., Sales ↔ Procurement, AR ↔ AP) MUST implement equivalent features in pairs.
- **Cognitive Consistency**: Use identical naming patterns, file structures, and UI layouts for symmetric workflows.
- **Check**: "If I build 'Create Invoice from SO', does 'Create Bill from PO' exist?"

### XI. Performance by Design (Preventing N+1)

- **Backend Optimization**: Repositories MUST support eager loading (`include` or joins) to provide related data in a single query (e.g., `Order` with `Invoices`).
- **Forbidden**: Frontend MUST NOT fetch individual related records inside a loop or based on list iteration.
- **404 Handling**: Avoid patterns where missing 1:1 relations trigger error toasts. Prefer silent checks or eager loaded `null` values.

## Project Structure

```text
sync-erp/
├── apps/
│   ├── web/src/                    # Vite + React
│   │   ├── app/                    # Routes, providers
│   │   ├── components/ui/          # Generic atoms
│   │   ├── features/[domain]/      # Business domains
│   │   └── hooks/, services/, utils/
│   └── api/src/                    # Express + TS
│       ├── controllers/, services/, repositories/
│       └── modules/[domain]/
├── packages/
│   ├── database/prisma/            # Schema + PrismaClient
│   └── shared/src/                 # Types, validators
├── turbo.json                      # Build orchestration
└── .specify/                       # SpecKit workflows
```

## Governance

- **Authority**: This Constitution supersedes all other preferences.
- **Amendments**: Require PR + team consensus.
- **Compliance**: Code reviews MUST verify principle adherence.
- **Tooling**: `npm` + `turbo` + `vite` (frontend) + `tsc` (backend).

**Version**: 1.10.0 | **Ratified**: 2025-12-08 | **Last Amended**: 2025-12-15
