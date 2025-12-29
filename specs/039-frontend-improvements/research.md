# Research: Frontend Code Quality & Performance Improvements

**Feature**: 039-frontend-improvements  
**Date**: December 29, 2025

---

## R1: ErrorBoundary Implementation Pattern

### Decision
Use class-based React ErrorBoundary component with fallback UI and recovery options.

### Rationale
- React's error boundary API only works with class components (no hook equivalent)
- Must support `static getDerivedStateFromError()` and `componentDidCatch()` lifecycle methods
- Class component is the only way to implement error boundaries in React

### Alternatives Considered
| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Class Component | Official React API, full control | Class syntax | ✅ Chosen |
| react-error-boundary library | Ready-made, hooks-friendly | Extra dependency | ❌ Rejected (unnecessary complexity) |
| No error handling | Zero effort | App crashes | ❌ Rejected |

### Implementation Notes
- Wrap at app level in `App.tsx` or `AppProviders.tsx`
- Consider route-level boundaries for feature isolation
- Log errors for debugging but show user-friendly message

---

## R2: usePrompt Hook Pattern (Based on Existing useConfirm)

### Decision
Replicate `useConfirm()` pattern from `ConfirmModal.tsx` with text input support.

### Rationale
- Existing pattern is proven and understood by team
- Context + Provider pattern allows promise-based API
- Consistent with existing codebase conventions

### Existing Pattern Analysis
```typescript
// From ConfirmModal.tsx
interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

// Hook returns promise
const confirm = (options: ConfirmOptions): Promise<boolean>
```

### New usePrompt Pattern
```typescript
interface PromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
}

// Hook returns promise with string or null
const prompt = (options: PromptOptions): Promise<string | null>
```

### Files to Modify
| File | Action |
|------|--------|
| `components/ui/PromptModal.tsx` | Create (similar to ConfirmModal.tsx) |
| `app/AppProviders.tsx` | Add `<PromptProvider>` |
| `components/ui/index.ts` | Export `usePrompt` |

---

## R3: React Lazy Loading Strategy

### Decision
Lazy load feature-level pages, keep shared components eager.

### Rationale
- Feature pages (30+) are large and not all needed on initial load
- Shared components (Layout, Sidebar) needed immediately
- Auth pages (Login, Register) should load fast for first impression

### Loading Strategy
| Category | Strategy | Reason |
|----------|----------|--------|
| Auth pages | Eager | First user touchpoint |
| Layout/Shell | Eager | Required for all routes |
| Feature pages | Lazy | Load on demand |
| UI components | Eager | Small, reused everywhere |

### Implementation Pattern
```typescript
// Current (eager)
import PurchaseOrders from '@/features/procurement/pages/PurchaseOrders';

// New (lazy)
const PurchaseOrders = lazy(() => import('@/features/procurement/pages/PurchaseOrders'));

// With Suspense
<Suspense fallback={<LoadingState />}>
  <PurchaseOrders />
</Suspense>
```

### Feature Boundaries for Lazy Loading
```
procurement/ → 4 pages (PurchaseOrders, PurchaseOrderDetail, Suppliers, SupplierDetail)
sales/       → 5 pages (SalesOrders, SalesOrderDetail, Customers, CustomerDetail, Quotations)
accounting/  → 10 pages (Invoices, Bills, Payments, Expenses, Journals, etc.)
inventory/   → 6 pages (Products, Inventory, Receipts, Shipments, etc.)
company/     → 3 pages (Companies, CreateCompany, TeamManagement)
admin/       → 1 page (Observability)
```

### Chunk Naming (Vite)
```typescript
// vite.config.ts - Optional for better chunk names
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor': ['react', 'react-dom', 'react-router-dom'],
        'trpc': ['@trpc/client', '@trpc/react-query', '@tanstack/react-query'],
      }
    }
  }
}
```

---

## R4: tRPC Query Stale Time Configuration

### Decision
Set default `staleTime: 30_000` (30 seconds) with per-query overrides.

### Rationale
- Prevents unnecessary refetches when navigating between routes
- 30 seconds is reasonable for ERP data that doesn't change frequently
- Time-sensitive data (e.g., inventory counts) can override with shorter time

### Current Configuration
```typescript
// apps/web/src/lib/trpcProvider.tsx
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

### Proposed Configuration
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000, // 30 seconds default
      gcTime: 5 * 60 * 1000, // 5 minutes cache time (formerly cacheTime)
    },
  },
});
```

### Override Examples
```typescript
// Real-time inventory - shorter stale time
trpc.inventory.getStock.useQuery({ productId }, { 
  staleTime: 5_000 // 5 seconds 
});

// Static reference data - longer stale time
trpc.product.list.useQuery({}, { 
  staleTime: 60_000 // 1 minute 
});
```

---

## R5: Component Consistency Analysis

### Decision
Standardize on existing shared components without creating new abstractions.

### Rationale
- Components already exist, just need consistent usage
- No new components needed for this feature
- Search-and-replace approach is sufficient

### Existing Components
| Component | Path | Purpose |
|-----------|------|---------|
| `LoadingSpinner` | `components/ui/LoadingSpinner.tsx` | Small inline spinner |
| `LoadingState` | `components/ui/EmptyState.tsx` | Full-page loading |
| `EmptyState` | `components/ui/EmptyState.tsx` | Empty list placeholder |
| `Input` | `components/ui/input.tsx` | Form text input |

### Files Requiring Updates
Based on grep search for inline spinners:
- `features/procurement/pages/*.tsx`
- `features/sales/pages/*.tsx`
- `features/accounting/pages/*.tsx`
- `features/inventory/pages/*.tsx`

### Replacement Pattern
```typescript
// Before (inline)
{isLoading && (
  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
)}

// After (component)
import { LoadingState } from '@/components/ui';
{isLoading && <LoadingState />}
```

---

## R6: Accessibility Requirements for PromptModal

### Decision
Implement WCAG 2.1 AA compliance with focus trap, keyboard navigation, and ARIA attributes.

### Requirements
| Requirement | Implementation |
|-------------|----------------|
| Focus trap | Focus stays within modal while open |
| Escape key | Closes modal (returns null) |
| Enter key | Submits if input valid |
| aria-labelledby | Points to modal title |
| aria-describedby | Points to modal message |
| role="dialog" | On modal container |
| aria-modal="true" | Indicates modal nature |
| autoFocus | Input receives focus on open |

### Focus Trap Implementation
```typescript
// Using native approach (no library needed)
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    handleCancel();
  }
  if (e.key === 'Tab') {
    // Trap focus within modal
    const focusableElements = modalRef.current?.querySelectorAll(
      'button, input, [tabindex]:not([tabindex="-1"])'
    );
    // Handle tab cycling...
  }
};
```

---

## Summary

| Research | Decision | Confidence |
|----------|----------|------------|
| R1: ErrorBoundary | Class component | High |
| R2: usePrompt | Replicate useConfirm pattern | High |
| R3: Lazy Loading | Feature-level lazy loading | High |
| R4: staleTime | 30s default, per-query override | High |
| R5: Component Consistency | Use existing components | High |
| R6: Accessibility | WCAG 2.1 AA with focus trap | High |

All NEEDS CLARIFICATION items resolved. Ready for Phase 1 design.
