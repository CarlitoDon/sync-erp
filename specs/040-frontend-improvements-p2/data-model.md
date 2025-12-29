# Data Model: Frontend Code Quality & Performance Improvements (Phase 2)

**Feature Branch**: `040-frontend-improvements-p2`  
**Created**: December 29, 2025  
**Status**: Draft

## Overview

This feature is **frontend-only** and does not require Prisma schema changes.

## No Schema Changes Required

All improvements in this spec involve:
- Component consolidation (Suppliers/Customers → PartnerListPage)
- Hook extraction (useOrderForm)
- UI component creation (NoCompanySelected, unified PageHeader)
- Component replacement (raw input → Input component)
- Performance optimization (React.memo, useMemo, useCallback)

## TypeScript Interfaces

### PartnerListPage Props

```typescript
// apps/web/src/features/common/components/PartnerListPage.tsx
interface PartnerListPageProps {
  type: 'SUPPLIER' | 'CUSTOMER';
  label: string;           // "Supplier" or "Customer"
  labelPlural: string;     // "Suppliers" or "Customers"
  basePath: string;        // "/suppliers" or "/customers"
}
```

### useOrderForm Hook

```typescript
// apps/web/src/hooks/useOrderForm.ts
interface ItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  notes: string;
}

interface OrderFormState<T extends OrderType> {
  items: ItemInput[];
  currentItem: ItemInput;
  totals: {
    subtotal: number;
    taxAmount: number;
    total: number;
  };
}

interface OrderFormActions {
  setCurrentItem: (item: Partial<ItemInput>) => void;
  addItem: () => void;
  removeItem: (index: number) => void;
  resetForm: () => void;
}

type UseOrderFormReturn = OrderFormState & OrderFormActions;
```

### OrderItemEditor Props

```typescript
// apps/web/src/components/forms/OrderItemEditor.tsx
interface OrderItemEditorProps {
  products: Product[];
  currentItem: ItemInput;
  onCurrentItemChange: (item: Partial<ItemInput>) => void;
  onAddItem: () => void;
  partnerLabel?: string; // For context-specific text
}
```

### NoCompanySelected Props

```typescript
// apps/web/src/components/ui/no-company-selected.tsx
interface NoCompanySelectedProps {
  message?: string;
  actionLabel?: string;
  actionHref?: string;
}
```

### Unified PageHeader Props

```typescript
// apps/web/src/components/layout/PageHeader.tsx (consolidated)
interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;      // For detail pages (e.g., "PO-0001")
  description?: string;      // For list pages
  badges?: ReactNode;        // Status badges
  actions?: ReactNode;       // Action buttons
  showBackButton?: boolean;  // Optional back navigation
  onBack?: () => void;       // Custom back handler
}
```

### Input Component Props

```typescript
// apps/web/src/components/ui/Input.tsx (enhanced)
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  containerClassName?: string;
}
```

## Related Existing Types

These existing types will be used by the new components:

```typescript
// From @sync-erp/shared or @/types/api
type PartnerType = 'SUPPLIER' | 'CUSTOMER';
type OrderType = 'PURCHASE' | 'SALES';

// From existing hooks
interface Partner { id, name, email, phone, address, type, ... }
interface Product { id, name, sku, unitPrice, ... }
```

## Migration Notes

No database migrations required. All changes are TypeScript/React refactoring.
