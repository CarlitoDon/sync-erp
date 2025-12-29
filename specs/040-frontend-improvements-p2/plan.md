# Plan: Frontend Code Quality & Performance Improvements (Phase 2)

**Feature Branch**: `040-frontend-improvements-p2`  
**Created**: December 29, 2025  
**Status**: Draft

## Implementation Strategy

### Recommended Order

Implementation follows dependency graph and quick-win prioritization:

```
Phase 1 (Quick Wins - No Dependencies)
├── US3: NoCompanySelected component
├── US4: Input component consistency
└── US5: PageHeader consolidation

Phase 2 (Page Consolidation)
├── US1: PartnerListPage (Suppliers + Customers)
└── US2: useOrderForm (PurchaseOrders + SalesOrders)

Phase 3 (Performance)
└── US6: Memoization optimization
```

---

## Phase 1: Quick Wins (1-2 days)

### US3: NoCompanySelected Component

**Why first**: Zero dependencies, immediate UX improvement, ~1 hour.

**Implementation steps:**
1. Create `NoCompanySelected.tsx` in `components/ui/`
2. Design: Icon + message + optional CTA button
3. Export from `components/ui/index.ts`
4. Replace all 10+ "Please select company" patterns

**File changes:**
- NEW: `apps/web/src/components/ui/NoCompanySelected.tsx`
- MODIFY: `apps/web/src/components/ui/index.ts`
- MODIFY: 10+ feature pages

---

### US4: Input Component Consistency

**Why second**: Builds on existing component, minimal risk.

**Implementation steps:**
1. Review existing `Input` component in `components/ui/input.tsx`
2. Add missing props (helperText, startIcon, endIcon, containerClassName)
3. Find all raw `<input>` elements in feature pages
4. Replace with shared Input component

**File changes:**
- MODIFY: `apps/web/src/components/ui/input.tsx`
- MODIFY: 6+ feature pages with forms

---

### US5: PageHeader Consolidation

**Why third**: Cleans up component library, no behavioral changes.

**Implementation steps:**
1. Analyze both PageHeader components
2. Create unified interface supporting all props
3. Consolidate into `components/layout/PageHeader.tsx`
4. Remove `components/ui/PageHeader.tsx`
5. Update all imports

**File changes:**
- DELETE: `apps/web/src/components/ui/PageHeader.tsx`
- MODIFY: `apps/web/src/components/layout/PageLayout.tsx` (consolidate PageHeader)
- MODIFY: All detail pages using ui/PageHeader

---

## Phase 2: Page Consolidation (3-4 days)

### US1: PartnerListPage

**Why**: Major code deduplication, reduces ~500 lines to ~300 shared.

**Implementation steps:**
1. Create `PartnerListPage` component in `features/common/components/`
2. Extract all shared logic from Suppliers.tsx
3. Parameterize: type, label, labelPlural, basePath
4. Replace Suppliers.tsx with thin wrapper
5. Replace Customers.tsx with thin wrapper
6. Verify all CRUD operations work for both

**File changes:**
- NEW: `apps/web/src/features/common/components/PartnerListPage.tsx`
- MODIFY: `apps/web/src/features/procurement/pages/Suppliers.tsx` (thin wrapper)
- MODIFY: `apps/web/src/features/sales/pages/Customers.tsx` (thin wrapper)

**Shared behavior to extract:**
- Partner list query with type filter
- Create modal with form state
- Edit modal with form state
- Delete confirmation
- Loading/empty states
- Partner card/list rendering

---

### US2: useOrderForm Hook

**Why**: Shared logic for PO and SO forms, ~40% reduction.

**Implementation steps:**
1. Create `useOrderForm` hook in `hooks/`
2. Extract: items state, currentItem state, addItem, removeItem, calculateTotals
3. Create `OrderItemEditor` component for shared item form UI
4. Update PurchaseOrders.tsx to use hook + component
5. Update SalesOrders.tsx to use hook + component
6. Verify calculations and form behavior match

**File changes:**
- NEW: `apps/web/src/hooks/useOrderForm.ts`
- NEW: `apps/web/src/components/forms/OrderItemEditor.tsx`
- MODIFY: `apps/web/src/features/procurement/pages/PurchaseOrders.tsx`
- MODIFY: `apps/web/src/features/sales/pages/SalesOrders.tsx`

**Logic to extract:**
```typescript
interface UseOrderFormReturn {
  items: ItemInput[];
  currentItem: ItemInput;
  setCurrentItem: (item: Partial<ItemInput>) => void;
  addItem: () => void;
  removeItem: (index: number) => void;
  calculateTotals: () => { subtotal, taxAmount, total };
  resetForm: () => void;
}
```

---

## Phase 3: Performance (1-2 days)

### US6: Memoization

**Why last**: Optimization should come after functionality is stable.

**Implementation steps:**
1. Profile app with React DevTools to identify slow components
2. Add React.memo to table row components
3. Add useCallback for handlers passed to child components
4. Add useMemo for expensive calculations (totals, filtered lists)
5. Verify performance improvement with profiler

**Target components:**
- `OrderListTable` row component
- `OrderItemsTable` row component
- `PartnerListPage` card component (after US1)
- Any component receiving callback props

**File changes:**
- MODIFY: `apps/web/src/components/ui/OrderListTable.tsx`
- MODIFY: `apps/web/src/components/ui/OrderItemsTable.tsx`
- MODIFY: Various pages with handlers

---

## Testing Strategy

### Manual Testing Checklist

**US3 - NoCompanySelected:**
- [ ] Visit each feature page without company selected
- [ ] Verify consistent appearance
- [ ] Verify CTA works (if implemented)

**US4 - Input Consistency:**
- [ ] Test all forms submit correctly
- [ ] Verify error states display
- [ ] Check styling matches design

**US5 - PageHeader:**
- [ ] Check all list pages
- [ ] Check all detail pages
- [ ] Verify back button works

**US1 - PartnerListPage:**
- [ ] Create supplier
- [ ] Edit supplier
- [ ] Delete supplier
- [ ] Create customer
- [ ] Edit customer
- [ ] Delete customer
- [ ] Search/filter (if applicable)

**US2 - useOrderForm:**
- [ ] Create PO with multiple items
- [ ] Verify totals calculation
- [ ] Remove item
- [ ] Create SO with multiple items
- [ ] Verify totals calculation
- [ ] Remove item

**US6 - Memoization:**
- [ ] Profile before/after
- [ ] Verify no regression in functionality

---

## Rollback Plan

Each user story is independent. If issues arise:

1. **US3**: Revert to inline "Please select company" patterns
2. **US4**: Revert to raw `<input>` elements
3. **US5**: Keep both PageHeader components
4. **US1**: Revert to separate Suppliers.tsx and Customers.tsx
5. **US2**: Revert to duplicate form logic in pages
6. **US6**: Remove React.memo/useMemo/useCallback

---

## Definition of Done

- [ ] All acceptance scenarios pass manual testing
- [ ] TypeScript compiles without errors
- [ ] No console errors/warnings
- [ ] Build succeeds
- [ ] Code reviewed
- [ ] Branch merged to main
