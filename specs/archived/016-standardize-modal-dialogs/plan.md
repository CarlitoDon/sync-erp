# Implementation Plan: Standardize Modal Dialogs

**Branch**: `16-standardize-modal-dialogs` | **Date**: 2025-12-14 | **Spec**: [spec.md](./spec.md)

## Summary

Refactor 6 pages to use modal popup dialogs instead of inline forms for "Create" actions. This is a frontend-only change using existing modal patterns from `AccountsPayable.tsx` and `JournalEntries.tsx`.

**Approach**: Extract modal wrapper pattern, apply to all 6 pages systematically.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18  
**Primary Dependencies**: React, Tailwind CSS  
**Storage**: N/A (no backend changes)  
**Testing**: Vitest + React Testing Library  
**Target Platform**: Web (Vite + React)  
**Project Type**: Monorepo (apps/web)  
**Performance Goals**: Modal open/close < 100ms  
**Constraints**: Must use existing modal pattern (no new dependencies)  
**Scale/Scope**: 6 pages to refactor

## Constitution Check

_GATE: ✅ All checks pass_

- [x] **I. Boundaries**: Frontend only, no backend changes
- [x] **II. Dependencies**: No new dependencies
- [x] **III. Contracts**: Using existing types
- [x] **IV. Layered Backend**: N/A
- [x] **IV. Repository Pattern**: N/A
- [x] **V. Multi-Tenant**: N/A
- [x] **VI. Feature-First**: All changes in `src/features/` directories
- [x] **VII. Systematic Refactoring**: Will grep and verify all instances updated
- [x] **VIII. Global UI Patterns**: Using existing pattern (`apiAction()`, modal behavior)
- [x] **IX. Callback-Safe**: No service changes needed

## Proposed Changes

### Component: Create Reusable Modal Wrapper

#### [NEW] [FormModal.tsx](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/components/ui/FormModal.tsx)

Create reusable modal wrapper component to avoid code duplication:

```typescript
interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}
```

Features:

- Semi-transparent overlay with rgba
- Close on overlay click
- Proper z-index (overlay + relative z-10 on content)
- Scrollable content with max-height
- Consistent styling across all forms

---

### Component: Procurement

#### [MODIFY] [Suppliers.tsx](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/procurement/pages/Suppliers.tsx)

- Replace inline form with `<FormModal>` wrapper
- Change `showForm` → `isModalOpen`
- Keep form fields unchanged

#### [MODIFY] [PurchaseOrders.tsx](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/procurement/pages/PurchaseOrders.tsx)

- Replace inline form with `<FormModal>` wrapper
- Add scrollable modal for complex form

---

### Component: Sales

#### [MODIFY] [Customers.tsx](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/sales/pages/Customers.tsx)

- Replace inline form with `<FormModal>` wrapper

#### [MODIFY] [SalesOrders.tsx](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/sales/pages/SalesOrders.tsx)

- Replace inline form with `<FormModal>` wrapper
- Add scrollable modal for complex form

---

### Component: Inventory

#### [MODIFY] [Products.tsx](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/inventory/pages/Products.tsx)

- Replace inline form with `<FormModal>` wrapper

---

### Component: Finance

#### [MODIFY] [Finance.tsx](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/finance/pages/Finance.tsx)

- Replace inline "Create Account" form with `<FormModal>` wrapper

## Project Structure

```text
apps/web/src/
├── components/
│   └── ui/
│       └── FormModal.tsx        # [NEW] Reusable modal wrapper
└── features/
    ├── procurement/
    │   └── pages/
    │       ├── Suppliers.tsx    # [MODIFY]
    │       └── PurchaseOrders.tsx # [MODIFY]
    ├── sales/
    │   └── pages/
    │       ├── Customers.tsx    # [MODIFY]
    │       └── SalesOrders.tsx  # [MODIFY]
    ├── inventory/
    │   └── pages/
    │       └── Products.tsx     # [MODIFY]
    └── finance/
        └── pages/
            └── Finance.tsx      # [MODIFY]
```

## Verification Plan

### Automated Tests

**Build verification**:

```bash
npm run build
```

### Manual Verification

For each of the 6 pages:

1. Navigate to page
2. Click "Add/Create" button → Modal appears
3. Click overlay → Modal closes
4. Click "Cancel" → Modal closes
5. Fill form and submit → Modal closes, list refreshes

### Grep Verification (Constitution VII)

Before:

```bash
grep -r "showForm && (" apps/web/src/features --include="*.tsx" | wc -l
# Expect: 6
```

After:

```bash
grep -r "showForm && (" apps/web/src/features --include="*.tsx" | wc -l
# Expect: 0
```
