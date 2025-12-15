---
trigger: always_on
---

<!--
MEMORY SYNC REPORT
Version: 1.0.1 -> 1.0.2 (Patch - Added N+1/Parity Decisions)
Added Sections:
- None
Modified Sections:
- Key Decisions Log (added N+1 and Parity entries)
Removed Sections:
- None
Last Updated: 2025-12-15
-->

# Project Memory

**Version**: 1.0.2 | **Last Updated**: 2025-12-15

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

---

## Update Guidelines

1. **Version Bump**: MAJOR.MINOR.PATCH following semver
   - MAJOR: Structure changes, section removals
   - MINOR: New sections, significant entries
   - PATCH: Entry updates, typo fixes

2. **Adding Decisions**: Add at TOP of Key Decisions Log with date

3. **Sync Report**: Update HTML comment at top when modifying

4. **Constitution Sync**: Memory complements constitution, does not duplicate it
