---
trigger: always_on
---

<!--
MEMORY SYNC REPORT
Version: 1.0.4 -> 1.0.5 (Patch - Added Case A1 Issue)
Added Sections:
- None
Modified Sections:
- Known Issues & Workarounds (added Case A1)
Removed Sections:
- None
Last Updated: 2025-12-16
-->

# Project Memory

**Version**: 1.0.5 | **Last Updated**: 2025-12-16

## Overview

| Property | Value |
|----------|-------|
| Project | Sync ERP |
| Type | Multi-Tenant Enterprise Resource Planning |
| Stack | Vite + React (Frontend), Express + TS (Backend), Prisma (ORM) |
| Constitution | v1.9.0 (see `.agent/rules/constitution.md`) |

---

## Key Decisions Log

> Decisions that affect future development. Add new entries at top.

### [2025-12-16] Case A1 Prevention - Complete Integration Check

**Decision**: When creating new files (especially Policy, Rules, Services), ALWAYS verify they are actually imported and used somewhere. Never create "orphan" files.
**Rationale**: Case A1 discovered where `sales.policy.ts` and `procurement.policy.ts` were created with tests but never imported in any service. Files exist but provide no value until integrated.
**Reference**: Implementation Completeness

### [2025-12-15] UI Consistency via Shared Components

**Decision**: Same UI actions MUST use shared components. Extract common UI (e.g., RecordPaymentModal) to `components/shared/`.
**Rationale**: Case A1 exposed duplicate payment forms across 4 files evolving independently. Shared components ensure "change once, update everywhere" and Steve Jobs-level consistency.
**Reference**: See `docs/LEARNINGS.md` for full Design System Manifesto.

### [2025-12-15] Backend-First Data Linking (Avoid N+1)

**Decision**: Use backend DB joins (`include`) for related data (e.g., Invoices on Order) instead of client-side loops.
**Rationale**: Eliminates "N+1" fetch performance issues and prevents 404 errors on missing optional relations.
**Reference**: Performance Best Practice

### [2025-12-15] Module Parity

**Decision**: Implement related modules (Sales/Procurement, Finance AP/AR) as implementation pairs (Symmetry).
**Rationale**: Reduces cognitive load and ensures consistent UX/DX. If feature exists in Module A, it should exist in Mirror Module B.
**Reference**: UI/UX Consistency

### [2025-12-15] DRY Principle

**Decision**: Apply DRY (Don't Repeat Yourself) - extract common logic into shared utilities/hooks.
**Rationale**: Reduces code duplication, improves maintainability, centralizes bug fixes.
**Reference**: N/A (general best practice)

### [2025-12-15] Schema-First Development

**Decision**: All new API fields MUST be added to Zod schema first.
**Rationale**: Zod strips unknown fields silently. taxRate bug was caused by this.
**Reference**: Constitution Principle IX

### [2025-12-08] Callback-Safe Services

**Decision**: Frontend services use standalone functions, not `this`.
**Rationale**: `useCompanyData` hook extracts method reference, losing `this` context.
**Reference**: Constitution Principle VII

---

## Known Issues & Workarounds

> Persistent issues that need workarounds. Mark RESOLVED when fixed.

| Issue | Status | Workaround |
|-------|--------|------------|
| Old orders have subtotal-only `totalAmount` | KNOWN | Only new orders include tax |
| IDE lint may be stale | KNOWN | Use `npx tsc --noEmit` as source of truth |
| **Dev server always running during development** | NOTE | User runs `Dev: Start All` and `TypeScript: Watch` in separate terminals. Do NOT try to start dev server yourself. |
| **Case A1: Orphan files created but not integrated** | KNOWN | After creating any new file, grep for imports to verify it's actually used. Check `grep -r "import.*filename" apps/` |

---

## Frequently Used Patterns

### API Action (Success Toast + Error Handling)

```typescript
const result = await apiAction(
  () => myService.create(data),
  'Item created!'
);
if (result) { /* success */ }
```

### Data Fetching with Company Context

```typescript
const { data, loading, refresh } = useCompanyData(
  () => myService.list(),
  initialValue
);
```

### Confirmation Dialog

```typescript
const confirm = useConfirm();
const proceed = await confirm.show({
  title: 'Delete Item?',
  message: 'This action cannot be undone.',
  danger: true,
});
if (proceed) { /* delete */ }
```

### Case A1 Prevention Check

```bash
# After creating any new file, verify it's imported somewhere
grep -r "import.*filename" apps/
# If no results, the file is orphaned and needs integration
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
