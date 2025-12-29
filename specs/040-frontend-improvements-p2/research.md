# Research: Frontend Code Quality & Performance Improvements (Phase 2)

**Feature Branch**: `040-frontend-improvements-p2`  
**Created**: December 29, 2025  
**Status**: Draft

## Current State Analysis

### 1. Partner Pages Duplication

**Files analyzed:**
- `apps/web/src/features/procurement/pages/Suppliers.tsx`
- `apps/web/src/features/sales/pages/Customers.tsx`

**Duplication assessment: ~95%**

| Feature | Suppliers.tsx | Customers.tsx |
|---------|--------------|---------------|
| Partner list query | `trpc.partner.list.useQuery({ type: 'SUPPLIER' })` | `trpc.partner.list.useQuery({ type: 'CUSTOMER' })` |
| Create modal | Same structure | Same structure |
| Edit modal | Same structure | Same structure |
| Delete mutation | `usePartnerMutations()` | `usePartnerMutations()` |
| Form fields | name, email, phone, address | name, email, phone, address |
| Empty state | Same | Same |
| Loading state | Same | Same |

**Existing abstraction:** `usePartnerMutations` hook handles CRUD mutations, but page structure is duplicated.

---

### 2. Order Forms Duplication

**Files analyzed:**
- `apps/web/src/features/procurement/pages/PurchaseOrders.tsx`
- `apps/web/src/features/sales/pages/SalesOrders.tsx`

**Shared patterns found:**

```typescript
// Both files define identical ItemInput interface
interface ItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  notes: string;
}

// Both files have identical calculateTotals function
const calculateTotals = () => {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * 0.11;
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
};

// Both files have identical addItem handler
const handleAddItem = () => {
  if (!currentItem.productId) return;
  setItems([...items, currentItem]);
  setCurrentItem(initialItem);
};

// Both files have identical removeItem handler
const handleRemoveItem = (index: number) => {
  setItems(items.filter((_, i) => i !== index));
};
```

**Differences:**
- Partner field label (Supplier vs Customer)
- tRPC mutation (purchaseOrder.create vs salesOrder.create)
- Route navigation after create

---

### 3. "Please select company" Occurrences

**Search results: 10+ occurrences**

```bash
grep -r "Please select a company" apps/web/src/
```

| File | Current Implementation |
|------|----------------------|
| `features/procurement/pages/Suppliers.tsx` | Inline div with message |
| `features/procurement/pages/PurchaseOrders.tsx` | Inline div with message |
| `features/procurement/pages/PurchaseOrderDetail.tsx` | Inline div with message |
| `features/sales/pages/Customers.tsx` | Inline div with message |
| `features/sales/pages/SalesOrders.tsx` | Inline div with message |
| `features/sales/pages/SalesOrderDetail.tsx` | Inline div with message |
| `features/inventory/pages/Products.tsx` | Inline div with message |
| `features/inventory/pages/Inventory.tsx` | Inline div with message |
| `features/inventory/pages/GoodsReceipts.tsx` | Inline div with message |
| `features/accounting/pages/Bills.tsx` | Inline div with message |

**Current pattern:**
```tsx
if (!currentCompany) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-500">Please select a company first.</p>
    </div>
  );
}
```

---

### 4. Raw Input Elements

**Search results: 14+ occurrences**

```bash
grep -r '<input' apps/web/src/features/ --include="*.tsx" | wc -l
```

**Files with raw inputs:**
- `features/procurement/pages/Suppliers.tsx` (4 inputs)
- `features/sales/pages/Customers.tsx` (4 inputs)
- `features/procurement/pages/PurchaseOrders.tsx` (multiple)
- `features/sales/pages/SalesOrders.tsx` (multiple)
- `features/inventory/pages/Products.tsx` (multiple)

**Existing Input component:**
- Location: `apps/web/src/components/ui/input.tsx`
- Current props: label, error, className, id
- Not used consistently across codebase

---

### 5. PageHeader Components

**Two components found:**

| Component | Location | Props |
|-----------|----------|-------|
| PageHeader | `components/ui/PageHeader.tsx` | title, subtitle, badges, actions, showBackButton |
| PageHeader | `components/layout/PageLayout.tsx` | title, description, actions |

**Usage patterns:**
- Detail pages use `components/ui/PageHeader.tsx` with badges
- List pages use `components/layout/PageLayout.tsx` with description
- Some pages use neither (inline implementation)

---

### 6. Memoization Opportunities

**Current usage:**
```bash
grep -r "useMemo\|useCallback\|React.memo" apps/web/src/ --include="*.tsx" | wc -l
# Result: ~10 occurrences
```

**Components that would benefit:**

| Component | Current Issue | Recommended Fix |
|-----------|--------------|-----------------|
| `OrderListTable` | Row re-render on parent state | `React.memo` on row component |
| `OrderItemsTable` | Table re-renders on form changes | `React.memo` + `useCallback` for handlers |
| List filters | Recalculated on every render | `useMemo` for filter options |
| `formatCurrency` calls in loops | Repeated calculations | `useMemo` for formatted values |

---

## Existing Patterns to Leverage

### usePartnerMutations Hook
```typescript
// Already exists - handles create, update, delete with optimistic updates
const { createMutation, updateMutation, deleteMutation } = usePartnerMutations();
```

### EmptyState Component
```typescript
// Already exists - can be used in NoCompanySelected
import { EmptyState } from '@/components/ui';
```

### LoadingState Component
```typescript
// Already exists - consistent loading UI
import { LoadingState } from '@/components/ui';
```

---

## Implementation Recommendations

### Priority Order

1. **US3: NoCompanySelected** (Quick win, ~1 hour)
   - Create component
   - Replace 10+ occurrences

2. **US4: Input Consistency** (Quick win, ~2 hours)
   - Enhance existing Input component
   - Replace raw inputs

3. **US5: PageHeader Consolidation** (Medium, ~2 hours)
   - Merge two components
   - Update imports

4. **US1: PartnerListPage** (Medium, ~4 hours)
   - Create generic component
   - Replace Suppliers.tsx and Customers.tsx

5. **US2: useOrderForm** (Medium, ~4 hours)
   - Extract shared logic
   - Create OrderItemEditor
   - Update PurchaseOrders and SalesOrders

6. **US6: Memoization** (Low priority, ~3 hours)
   - Profile first to identify actual bottlenecks
   - Add React.memo to table rows
   - Add useMemo/useCallback where beneficial

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Partner pages have hidden differences | Low | Medium | Review both files thoroughly before consolidating |
| Order forms diverge in future | Medium | Low | Keep hook generic, allow page-specific overrides |
| Input component doesn't fit all cases | Low | Low | Support className override and raw input escape hatch |
| Memoization causes bugs | Low | Low | Test thoroughly, profile to confirm benefit |

---

## References

- [React.memo documentation](https://react.dev/reference/react/memo)
- [useMemo documentation](https://react.dev/reference/react/useMemo)
- [useCallback documentation](https://react.dev/reference/react/useCallback)
- [Existing frontend-improvements.md](../../docs/frontend-improvements.md)
