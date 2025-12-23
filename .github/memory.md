---
trigger: model_decision
---

<!--
MEMORY SYNC REPORT
Version: 1.5.1 -> 1.5.2 (Patch - Compression)
Added Sections: None
Modified Sections:
- Architecture: Merged tRPC and Layer Responsibility decisions
- Issues: Removed resolved items
Removed Sections:
- Redundant table rows
Last Updated: 2025-12-23
-->

# Project Memory

**Version**: 1.5.2 | **Last Updated**: 2025-12-23

## Overview

| Property     | Value                                                                       |
| ------------ | --------------------------------------------------------------------------- |
| Project      | Sync ERP                                                                    |
| Type         | Multi-Tenant Enterprise Resource Planning                                   |
| Stack        | Vite + React + tRPC (Frontend), Express + tRPC + TS (Backend), Prisma (ORM) |
| Constitution | v3.3.0 (see `.agent/rules/constitution.md`)                                 |

---

### [2025-12-23] No Hardcoded Enums

**Decision**: Do NOT hardcode enum schemas in `validators/`. **Use generated schemas** from `packages/shared/src/generated/zod/index.ts`.
**Examples**: ❌ `z.enum(['SALES'])` → ✅ `import { OrderTypeSchema } ...`
**Rationale**: Single source of truth from Prisma schema (Principle IX).

### [2025-12-23] Architecture: tRPC & Layer Boundaries

**Decision**: Replaced Express Controllers with tRPC Routers. Established strict 4-Layer Architecture:

| Layer       | Responsibility                    | Must NOT do                   |
| ----------- | --------------------------------- | ----------------------------- |
| **Router**  | tRPC procedures, Zod validation   | Business logic                |
| **Service** | Use cases, state rules, policies  | SQL, direct DB access         |
| **Policy**  | Pure business constraints         | DB access, transactions       |
| **Repo**    | Usage of Prisma/SQL, optimization | State logic, intent branching |

**Key Rules**:

1. **Frontend**: Use tRPC hooks (`trpc.invoice.list.useQuery`) instead of custom fetchers.
2. **Repo**: Knows _how_ to persist (SQL), not _why_ (Policy).
3. **Service**: Purity is mandatory (no `prisma` imports).

### [2025-12-18] Business Flow Standards

1. **Integration Priority**: MANDATORY for all business flows (Constitution XVII).
2. **API Seeding**: Use `./scripts/seed-via-api.sh` for reliable side-effect testing.
3. **Preconditions**: Documents must validate precursors (Bill needs GRN).
4. **Data Integrity**: Validate reference data (e.g. Accounts) before writing.

### [2025-12-16] Quality & Testing Safeguards

1. **Saga Testing**: Mock the orchestrator in integration tests, not the repos.
2. **Vitest**: Use `function() { return mockInstance }` for hoisting.
3. **Imports**: Verify no "orphan" files after creation (Case A1 prevention).

---

## Known Issues & Workarounds

| Issue                                       | Status | Workaround                             |
| :------------------------------------------ | :----- | :------------------------------------- |
| Old orders have subtotal-only `totalAmount` | KNOWN  | Only new orders include tax            |
| IDE lint may be stale                       | KNOWN  | Trust `npx tsc --noEmit`               |
| **Dev server always running**               | NOTE   | Do NOT start manually.                 |
| **Orphan files (Case A1)**                  | KNOWN  | Grep imports after creating new files. |

---

## Frequently Used Patterns

````carousel
```typescript
// Pattern: apiAction
const ok = await apiAction(() => svc.create(data), 'Created!');
if (ok) refresh();
```
<!-- slide -->
```typescript
// Pattern: useCompanyData
const { data, loading, refresh } = useCompanyData(() => svc.list(), []);
```
<!-- slide -->
```typescript
// Pattern: Vitest 4.x Mock
vi.mock('../svc', () => ({ Svc: () => mockInstance }));
```
<!-- slide -->
```typescript
// Pattern: Policy Check in Service
async createFromPO(id, data) {
  const order = await this.repo.find(id);
  BillPolicy.ensureOrderReady(order); // Logic here
  return this.repo.create(data);
}
```
````

## Update Guidelines

1. **Version Bump**: MAJOR.MINOR.PATCH
2. **Add Decisions**: At TOP with date.
3. **Sync**: Copy to `.agent/rules/memory.md` after edit.
