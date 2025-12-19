---
trigger: model_decision
---

<!--
MEMORY SYNC REPORT
Version: 1.3.0 -> 1.4.0 (Minor - Layer Responsibility Principles)
Added Sections:
- Key Decision: Layer Responsibility (Dumb Controller/Repository)
Modified Sections:
- None
Removed Sections:
- None
Last Updated: 2025-12-18
-->

# Project Memory

**Version**: 1.4.0 | **Last Updated**: 2025-12-18

## Overview

| Property     | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| Project      | Sync ERP                                                      |
| Type         | Multi-Tenant Enterprise Resource Planning                     |
| Stack        | Vite + React (Frontend), Express + TS (Backend), Prisma (ORM) |
| Constitution | v1.9.0 (see `.agent/rules/constitution.md`)                   |

---

### [2025-12-18] Layer Responsibility Principles (Dumb Controller/Repository)

**Decision**: Established clear boundaries for layer responsibilities:

| Layer      | Knows about                         | Must NOT know about                          |
| ---------- | ----------------------------------- | -------------------------------------------- |
| Controller | HTTP, auth, DTO                     | Business rules                               |
| Service    | Use case, state rules, policy, saga | SQL, table shape                             |
| Repository | Persistence, queries, locks         | State machine, policy, saga, business intent |
| Policy     | Business constraints                | DB, transactions                             |

**Key Rule**: Repository knows _how_ to talk to the database, not _why_ a write is allowed.

**Repository MAY do**: SQL shape, atomic guards (`balance: { gte: amount }`), optimistic concurrency, row locking, aggregate-safe updates.

**Repository MUST NOT do**: State logic, policy checks, intent branching, saga orchestration.

**Mental Test**: "If I move from Prisma to raw SQL, would this logic still make sense here?" Yes → repository. No → service/policy.

**Rationale**: Prevents business logic leakage and maintains testability.
**Reference**: Constitution Principle VIII (Service Purity)

### [2025-12-18] Business Flow & Integrity Standards (Phase 1 Ready)

**Decision**: Consolidated 6 key standards for system correctness:

1. **Integration Priority**: Integration tests are **MANDATORY** for all business flows (Constitution XVII).
2. **API Seeding**: Use `./scripts/seed-via-api.sh` for transactions to ensure side effects (Sagas, Journals).
3. **Prerequisite Check**: Documents must validate preconditions (Bills need GRN, Invoices need SO).
4. **Service Purity**: Services MUST NOT import `prisma`. Use Repository layer only.
5. **Data Validation**: Verify Chart of Accounts (e.g. 2105) before journal creation.
6. **Policy Ownership**: Business rules (e.g. stock validation) belong in `Policy`, not `Repository`.

### [2025-12-16] Integration & Quality Safeguards

**Decision**: Established 4 tactical safeguards for Phase 1 transition:

1. **Saga Testing**: Mock the Saga orchestrator, not individual repositories, in integration tests.
2. **Vitest Hoisting**: Use `function() { return mockInstance }` pattern for `vi.mock()`.
3. **Phase 0 Close**: Gate review approved logic/config changes but remains watchful of `BusinessShape` flatness.
4. **Case A1 Prevention**: Verify all new files (Policy/Rules) are actually imported/linked; no orphans.

### [2025-12-15] Interface & Architectural Consistency

**Decision**: Unified UI/UX and Backend patterns:

1. **Shared Components**: Extract common UI (e.g. `RecordPaymentModal`) to `components/shared/`.
2. **Backend-First Linking**: Use DB `include`/joins for related data instead of client-side loops (N+1 removal).
3. **Module Symmetries**: Sales/Procurement and AP/AR must mirror implementation naming and structure.
4. **Schema-First**: All new fields must exist in Zod schema first (Constitution Principle IX).
5. **Standalone Services**: Frontend services use standalone functions to stay callback-safe (no `this`).

---

## Known Issues & Workarounds

> Persistent issues that need workarounds. Mark RESOLVED when fixed.

| Issue                                                | Status   | Workaround                                                                                                           |
| ---------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| Old orders have subtotal-only `totalAmount`          | KNOWN    | Only new orders include tax                                                                                          |
| IDE lint may be stale                                | KNOWN    | Use `npx tsc --noEmit` as source of truth                                                                            |
| **Dev server always running during development**     | NOTE     | User runs `Dev: Start All` and `TypeScript: Watch` in separate terminals. Do NOT try to start dev server yourself.   |
| **Case A1: Orphan files created but not integrated** | KNOWN    | After creating any new file, grep for imports to verify it's actually used. Check `grep -r "import.*filename" apps/` |
| **Account 2105 was missing from seed**               | RESOLVED | Added to `packages/database/prisma/seed.ts` - always verify accounts exist before creating journal entries           |

---

## Frequently Used Patterns

### Global Patterns Index

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
// Pattern: useConfirm
const proceed = await confirm.show({ title: 'Delete?', danger: true });
```
<!-- slide -->
```typescript
// Pattern: Vitest 4.x Mock
vi.mock('../svc', () => ({ Svc: () => mockInstance }));
```
````

### Business Flow Prerequisite (Implementation)

```typescript
// Service validates via Policy before Repo action
async createFromPO(companyId: string, data: CreateBillInput) {
  const order = await this.repository.findOrder(data.orderId, companyId);
  BillPolicy.ensureOrderReadyForBill(order);
  const grnCount = await this.inventoryRepository.countByOrderReference(companyId, data.orderId, 'IN');
  BillPolicy.ensureGoodsReceived(grnCount);
  return this.repository.create({ ...data, companyId });
}
```

---

## Update Guidelines

1. **Version Bump**: MAJOR.MINOR.PATCH following semver
   - MAJOR: Structure changes, section removals
   - MINOR: New sections, significant entries
   - PATCH: Entry updates, typo fixes

2. **Adding Decisions**: Add at TOP of Key Decisions Log with date

3. **Sync Report**: Update HTML comment at top when modifying

4. **Constitution Sync**: Memory complements constitution, does not duplicate it