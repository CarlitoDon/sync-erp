# Frontend Improvements Analysis

> **Date:** December 29, 2025  
> **Branch:** 038-feature-expenses  
> **Status:** Analysis Complete  
> **Spec:** [specs/039-frontend-improvements/](../specs/039-frontend-improvements/)

---

## Coverage Summary

| Item | Priority | Status | Spec Reference |
|------|----------|--------|----------------|
| Missing Error Boundaries | 🔴 High | ✅ Covered | US1 (T003-T006) |
| `window.prompt()` replacement | 🔴 High | ✅ Covered | US2 (T007-T018) |
| Inline Loading Spinners | 🟠 Medium | ✅ Covered | US5 (T029-T034) |
| Route-Level Code Splitting | 🟡 Lower | ✅ Covered | US3 (T019-T025) |
| tRPC `staleTime` | 🟡 Lower | ✅ Covered | US4 (T026-T028) |
| Suppliers/Customers duplication | 🟠 Medium | ❌ Out of Scope | - |
| PurchaseOrders/SalesOrders form logic | 🟠 Medium | ❌ Out of Scope | - |
| "Please select company" message | 🟠 Medium | ❌ Not Covered | Quick win |
| Raw Input elements | 🟠 Medium | ❌ Not Covered | Quick win |
| Consolidate PageHeader | 🟡 Lower | ❌ Out of Scope | - |
| Limited Memoization | 🟡 Lower | ❌ Not Covered | Future |
| React Hook Form integration | 🟢 Future | ❌ Out of Scope | - |
| DataTable component | 🟢 Future | ❌ Out of Scope | - |
| Accessibility audit | 🟢 Future | ❌ Out of Scope | - |

---

## Executive Summary

The frontend codebase shows good foundational patterns (tRPC integration, shared UI components, context-based state management) but has several areas for improvement including code duplication, missing error boundaries, inconsistent patterns, and accessibility gaps.

---

## 🔴 Critical Issues

### 1. Missing Error Boundaries ✅ COVERED (US1)

**Impact:** High | **Files Affected:** All pages | **Spec:** US1 (T003-T006)

No `ErrorBoundary` component exists in the codebase. If any component throws, the entire app crashes.

**Recommendation:**
- Create a global `ErrorBoundary` component wrapping the router
- Add feature-specific error boundaries around complex data-fetching components

**Implementation:**
```tsx
// apps/web/src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Something went wrong</h1>
            <p className="text-gray-600 mt-2">{this.state.error?.message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

### 2. Use of `window.prompt()` (10+ occurrences) ✅ COVERED (US2)

**Impact:** High | **Files Affected:** | **Spec:** US2 (T007-T018)

| File | Usage |
|------|-------|
| `features/procurement/pages/GoodsReceiptDetail.tsx` | Close order reason |
| `features/procurement/pages/PurchaseOrderDetail.tsx` | Cancel/close reason |
| `features/sales/pages/SalesOrderDetail.tsx` | Cancel/close reason |
| `features/accounting/pages/BillDetail.tsx` | Void reason |
| `features/accounting/pages/InvoiceDetail.tsx` | Void reason |
| `features/accounting/pages/PaymentDetail.tsx` | Void reason |

**Problems:**
- Not accessible (screen readers cannot interact)
- Not styled consistently with app
- Blocks main thread
- Returns `null` on cancel (easy to miss)

**Recommendation:**
Create a `usePrompt()` hook similar to existing `useConfirm()`:

```tsx
// apps/web/src/components/ui/PromptModal.tsx
const reason = await prompt({ 
  title: 'Close Order', 
  message: 'Please enter a reason:',
  placeholder: 'Enter reason...',
  required: true 
});
if (reason) {
  // User submitted
}
```

---

## 🟠 Code Duplication

### 1. Suppliers & Customers Pages (~95% duplicate) ❌ OUT OF SCOPE

**Files:**
- `features/procurement/pages/Suppliers.tsx`
- `features/sales/pages/Customers.tsx`

Both pages have nearly identical structure with only label differences.

**Recommendation:**
Create a generic `PartnerListPage` component:

```tsx
// features/common/pages/PartnerListPage.tsx
interface PartnerListPageProps {
  type: 'SUPPLIER' | 'CUSTOMER';
  label: string;
  labelPlural: string;
  basePath: string;
}

export function PartnerListPage({ type, label, labelPlural, basePath }: PartnerListPageProps) {
  // Shared implementation
}

// Usage in routes:
<Route path="suppliers" element={
  <PartnerListPage type="SUPPLIER" label="Supplier" labelPlural="Suppliers" basePath="/suppliers" />
} />
<Route path="customers" element={
  <PartnerListPage type="CUSTOMER" label="Customer" labelPlural="Customers" basePath="/customers" />
} />
```

**Note:** There's already a `usePartnerMutations` hook that partially addresses mutation logic sharing.

---

### 2. PurchaseOrders & SalesOrders Form Logic ❌ OUT OF SCOPE

**Files:**
- `features/procurement/pages/PurchaseOrders.tsx`
- `features/sales/pages/SalesOrders.tsx`

Both share:
- Same `ItemInput` interface
- Same `formData` state structure
- Same `calculateTotals()` function
- Same item add/remove handlers
- Same form structure with minor label differences

**Recommendation:**
Extract shared order form logic:

```tsx
// hooks/useOrderForm.ts
export function useOrderForm<T extends OrderType>() {
  const [items, setItems] = useState<ItemInput[]>([]);
  const [currentItem, setCurrentItem] = useState<ItemInput>(initialItem);
  
  const addItem = useCallback(() => { /* ... */ }, []);
  const removeItem = useCallback((index: number) => { /* ... */ }, []);
  const calculateTotals = useCallback(() => { /* ... */ }, [items]);
  
  return { items, currentItem, setCurrentItem, addItem, removeItem, totals };
}

// components/OrderItemEditor.tsx
export function OrderItemEditor({ products, onAddItem, currentItem, setCurrentItem }) {
  // Shared item editing UI
}
```

---

### 3. Inline Loading Spinners (20+ occurrences) ✅ COVERED (US5)

**Spec:** US5 (T029-T034)

**Pattern found:**
```tsx
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
```

**Issue:** `LoadingSpinner` component exists at `components/ui/LoadingSpinner.tsx` but isn't used consistently.

**Action:** Replace all inline spinners with:
```tsx
import { LoadingState } from '@/components/ui';
if (loading) return <LoadingState />;
```

---

### 4. "Please select a company" Message (10+ occurrences) ❌ NOT COVERED

**Status:** Quick win for future iteration

**Pattern found:**
```tsx
if (!currentCompany) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-500">Please select a company first.</p>
    </div>
  );
}
```

**Recommendation:**
1. Handle at `ProtectedRoute` level (redirect to company selection)
2. Or create `<NoCompanySelected />` component

---

### 5. Raw Input Elements (14+ occurrences) ❌ NOT COVERED

**Status:** Quick win for future iteration

**Pattern found:**
```tsx
<input
  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500..."
/>
```

**Issue:** `Input` component exists at `components/ui/input.tsx` but isn't used consistently.

**Action:** Replace raw inputs with shared component:
```tsx
import { Input } from '@/components/ui';
<Input label="Name" required value={name} onChange={...} />
```

---

## 🟡 Performance Optimization

### 1. No Route-Level Code Splitting ✅ COVERED (US3)

**File:** `app/AppRouter.tsx` | **Spec:** US3 (T019-T025)

All 30+ page components are eagerly imported, resulting in a large initial bundle.

**Recommendation:**
```tsx
import { lazy, Suspense } from 'react';
import { LoadingState } from '@/components/ui';

// Lazy load feature pages
const PurchaseOrders = lazy(() => import('@/features/procurement/pages/PurchaseOrders'));
const SalesOrders = lazy(() => import('@/features/sales/pages/SalesOrders'));

// In routes
<Route path="purchase-orders" element={
  <Suspense fallback={<LoadingState />}>
    <PurchaseOrders />
  </Suspense>
} />
```

**Effort:** Medium | **Impact:** Significant bundle size reduction

---

### 2. Limited Memoization ❌ NOT COVERED

**Status:** Future optimization

**Only 10 occurrences** of `useMemo`/`useCallback`/`React.memo` across the codebase.

**Components that would benefit:**
- `OrderItemsTable` - renders large lists
- `OrderListTable` - table rows re-render on parent state
- Complex list item renderers

---

### 3. tRPC Missing `staleTime` ✅ COVERED (US4)

**File:** `lib/trpcProvider.tsx` | **Spec:** US4 (T026-T028)

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      // Missing: staleTime
    },
  },
});
```

**Recommendation:**
```typescript
staleTime: 30 * 1000, // 30 seconds - prevents unnecessary refetches
```

---

## 🟡 Inconsistent Patterns

### 1. Two Different `PageHeader` Components ❌ OUT OF SCOPE

| File | Props | Features |
|------|-------|----------|
| `components/ui/PageHeader.tsx` | `badges`, `subtitle` | For detail pages |
| `components/layout/PageLayout.tsx` | `description` | For list pages |

**Recommendation:**
Consolidate into one component:

```tsx
interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;      // For detail pages
  description?: string;      // For list pages
  badges?: ReactNode;        // Status badges
  actions?: ReactNode;       // Action buttons
  showBackButton?: boolean;  // Optional back navigation
}
```

---

### 2. Inconsistent Form Reset Patterns ❌ OUT OF SCOPE

**Status:** Will be addressed with react-hook-form integration

**Pattern A** (Suppliers.tsx):
```tsx
const resetForm = () => { setFormData({...}); };
const handleClose = () => { setIsModalOpen(false); resetForm(); };
```

**Pattern B** (PurchaseOrders.tsx):
```tsx
const handleClose = () => {
  setIsModalOpen(false);
  setFormData({...});
  setPaymentConfig({...});
  setCurrentItem({...});
};
```

**Recommendation:**
Standardize with a custom hook or adopt `react-hook-form`.

---

### 3. Mixed Query Enable Patterns ❌ NOT COVERED

**Status:** Low priority, consider standardizing in future

```tsx
// Pattern A - with initialData
{ enabled: !!currentCompany?.id, initialData: [] }

// Pattern B - without initialData  
{ enabled: !!id && !!currentCompany?.id }
```

**Impact:** Different loading behaviors across pages.

---

## 🟢 Accessibility Issues ❌ OUT OF SCOPE (except PromptModal)

> **Note:** PromptModal (US2) includes full accessibility: ARIA attributes, focus trap, Escape key handling

### 1. Limited ARIA Attributes

Only **13 occurrences** of `aria-*` attributes. Missing from:
- Tables (no `scope` on `<th>`, no `<caption>`)
- Form modals (inconsistent `aria-labelledby`)
- Status badges (should announce to screen readers)
- Loading states

### 2. Keyboard Navigation Gaps

- `FormModal` doesn't trap focus
- `ConfirmModal` doesn't handle Escape key
- Dropdowns lack keyboard focus indicators

---

## 🟢 Missing Abstractions ❌ OUT OF SCOPE

### 1. No Form Validation Library

Forms use manual validation with `required` attributes. No schema-based validation despite having Zod schemas in `@sync-erp/shared`.

**Recommendation:**
Integrate `react-hook-form` + `@hookform/resolvers/zod`:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreatePartnerSchema, CreatePartnerInput } from '@sync-erp/shared';

const form = useForm<CreatePartnerInput>({
  resolver: zodResolver(CreatePartnerSchema),
  defaultValues: { name: '', email: '' }
});
```

---

### 2. No Generic DataTable Component

Multiple pages implement their own table markup.

**Recommendation:**
```tsx
<DataTable
  columns={columns}
  data={suppliers}
  emptyMessage="No suppliers found"
  onRowClick={(row) => navigate(`/suppliers/${row.id}`)}
  loading={isLoading}
/>
```

---

### 3. Missing FormField Component

Repeated pattern:
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
  <input className="..." />
  {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
</div>
```

**Recommendation:**
```tsx
<FormField label="Name" required error={errors.name}>
  <Input {...register('name')} />
</FormField>
```

---

## 📋 Prioritized Action Items

| # | Priority | Issue | Effort | Status | Spec |
|---|----------|-------|--------|--------|------|
| 1 | 🔴 High | Add `ErrorBoundary` | Low | ✅ Covered | US1 |
| 2 | 🔴 High | Create `usePrompt()` hook | Medium | ✅ Covered | US2 |
| 3 | 🟠 Medium | Consolidate Partner pages | Medium | ❌ Out of Scope | - |
| 4 | 🟠 Medium | Use `LoadingSpinner` consistently | Low | ✅ Covered | US5 |
| 5 | 🟠 Medium | Use `Input` component consistently | Low | ❌ Not Covered | - |
| 6 | 🟡 Lower | Add route code splitting | Medium | ✅ Covered | US3 |
| 7 | 🟡 Lower | Consolidate `PageHeader` | Low | ❌ Out of Scope | - |
| 8 | 🟡 Lower | Add `staleTime` to tRPC | Low | ✅ Covered | US4 |
| 9 | 🟢 Future | Integrate react-hook-form + zod | High | ❌ Out of Scope | - |
| 10 | 🟢 Future | Create `DataTable` component | High | ❌ Out of Scope | - |
| 11 | 🟢 Future | Add accessibility improvements | Medium | ❌ Out of Scope | - |

---

## Implementation Order Suggestion

### Phase 1: Quick Wins (1-2 days)
1. Add `ErrorBoundary`
2. Add `staleTime` to tRPC
3. Replace inline loading spinners

### Phase 2: UX Improvements (3-5 days)
4. Create `usePrompt()` hook and replace `window.prompt`
5. Consolidate `PageHeader` components
6. Add route code splitting

### Phase 3: Code Quality (1 week)
7. Consolidate Partner pages
8. Extract `useOrderForm()` hook
9. Use `Input` component consistently

### Phase 4: Future Enhancements
10. Integrate react-hook-form
11. Create `DataTable` component
12. Accessibility audit and fixes

---

## Related Files Reference

| Component | Path |
|-----------|------|
| tRPC Client | `apps/web/src/lib/trpc.ts` |
| tRPC Provider | `apps/web/src/lib/trpcProvider.tsx` |
| App Router | `apps/web/src/app/AppRouter.tsx` |
| UI Components | `apps/web/src/components/ui/` |
| Layout Components | `apps/web/src/components/layout/` |
| Hooks | `apps/web/src/hooks/` |
| Contexts | `apps/web/src/contexts/` |
