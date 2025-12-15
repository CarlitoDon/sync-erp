---
trigger: always_on
---

<!--
MEMORY SYNC REPORT
Version: 0.0.0 -> 1.0.0 (Initial Structure)
Added Sections:
- Project Overview
- Key Decisions Log
- Known Issues & Workarounds
- Frequently Used Patterns
Removed Sections:
- None
Last Updated: 2025-12-15
-->

# Project Memory

**Version**: 1.0.0 | **Last Updated**: 2025-12-15

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
