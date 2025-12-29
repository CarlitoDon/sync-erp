# Quickstart: Frontend Code Quality & Performance Improvements (Phase 2)

**Feature Branch**: `040-frontend-improvements-p2`  
**Created**: December 29, 2025  
**Status**: Draft

## 30-Second Context

This spec covers **frontend code consolidation and consistency improvements** that were out of scope for 039:

| User Story | Goal | Effort |
|------------|------|--------|
| US1 | Consolidate Suppliers + Customers pages | Medium (4h) |
| US2 | Extract shared order form logic | Medium (4h) |
| US3 | Create NoCompanySelected component | Low (1h) |
| US4 | Use shared Input component consistently | Low (2h) |
| US5 | Consolidate PageHeader components | Low (2h) |
| US6 | Add React.memo/useMemo optimization | Medium (3h) |

**No backend changes. No Prisma schema changes.**

---

## Quick Commands

```bash
# Start development
npm run dev

# Type check
npm run typecheck

# Build (verify no errors)
npm run build

# Open Prisma Studio (N/A - no DB changes)
npm run db:studio
```

---

## Key Files to Know

### Existing Components (to enhance/consolidate)

| File | Purpose |
|------|---------|
| `apps/web/src/components/ui/input.tsx` | Shared Input (enhance props) |
| `apps/web/src/components/ui/PageHeader.tsx` | Detail page header (consolidate) |
| `apps/web/src/components/layout/PageLayout.tsx` | List page header (consolidate) |
| `apps/web/src/components/ui/index.ts` | UI exports (add new components) |

### Pages to Consolidate

| File | Consolidate Into |
|------|-----------------|
| `features/procurement/pages/Suppliers.tsx` | PartnerListPage |
| `features/sales/pages/Customers.tsx` | PartnerListPage |
| `features/procurement/pages/PurchaseOrders.tsx` | useOrderForm hook |
| `features/sales/pages/SalesOrders.tsx` | useOrderForm hook |

### New Files to Create

| File | Purpose |
|------|---------|
| `components/ui/NoCompanySelected.tsx` | Empty state for missing company |
| `features/common/components/PartnerListPage.tsx` | Shared Partner list component |
| `hooks/useOrderForm.ts` | Shared order form logic |
| `components/forms/OrderItemEditor.tsx` | Shared item editor UI |

---

## Implementation Patterns

### NoCompanySelected Pattern

```tsx
// apps/web/src/components/ui/NoCompanySelected.tsx
import { Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface NoCompanySelectedProps {
  message?: string;
}

export function NoCompanySelected({ 
  message = 'Please select a company to continue.' 
}: NoCompanySelectedProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <Building2 className="h-12 w-12 text-gray-400 mb-4" />
      <p className="text-gray-500 text-center max-w-sm">{message}</p>
      <Link 
        to="/companies" 
        className="mt-4 text-primary-600 hover:text-primary-700"
      >
        Select a company
      </Link>
    </div>
  );
}
```

### PartnerListPage Pattern

```tsx
// apps/web/src/features/common/components/PartnerListPage.tsx
interface PartnerListPageProps {
  type: 'SUPPLIER' | 'CUSTOMER';
  label: string;
  labelPlural: string;
  basePath: string;
}

export function PartnerListPage({ type, label, labelPlural, basePath }: PartnerListPageProps) {
  const { currentCompany } = useCompany();
  const { data: partners, isLoading } = trpc.partner.list.useQuery(
    { type },
    { enabled: !!currentCompany?.id }
  );
  
  if (!currentCompany) return <NoCompanySelected />;
  if (isLoading) return <LoadingState />;
  
  // ... modal state, handlers using usePartnerMutations
}
```

### useOrderForm Pattern

```tsx
// apps/web/src/hooks/useOrderForm.ts
interface ItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  notes: string;
}

const initialItem: ItemInput = { productId: '', quantity: 1, unitPrice: 0, notes: '' };

export function useOrderForm(taxRate = 0.11) {
  const [items, setItems] = useState<ItemInput[]>([]);
  const [currentItem, setCurrentItem] = useState<ItemInput>(initialItem);

  const addItem = useCallback(() => {
    if (!currentItem.productId) return;
    setItems(prev => [...prev, currentItem]);
    setCurrentItem(initialItem);
  }, [currentItem]);

  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxAmount = subtotal * taxRate;
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  }, [items, taxRate]);

  const resetForm = useCallback(() => {
    setItems([]);
    setCurrentItem(initialItem);
  }, []);

  return {
    items, currentItem, setCurrentItem,
    addItem, removeItem, totals, resetForm
  };
}
```

### Memoization Pattern

```tsx
// For table rows
const TableRow = React.memo(function TableRow({ item, onDelete }: Props) {
  return <tr>...</tr>;
});

// For handlers passed to children
const handleDelete = useCallback((id: string) => {
  deleteMutation.mutate(id);
}, [deleteMutation]);

// For expensive calculations
const filteredItems = useMemo(
  () => items.filter(item => item.name.includes(search)),
  [items, search]
);
```

---

## Before Starting

1. ✅ Ensure branch 039-frontend-improvements is merged (dependency)
2. ✅ Run `npm run dev` and verify app works
3. ✅ Create branch `040-frontend-improvements-p2`

---

## Verification Steps

After each user story:

```bash
# 1. Type check
npm run typecheck

# 2. Build
npm run build

# 3. Manual test affected features
npm run dev
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Import error after consolidation | Update all import paths |
| TypeScript error on generic component | Ensure props interface is correct |
| React.memo not working | Ensure child props are stable (use useCallback) |
| Form state not resetting | Call resetForm() in useOrderForm |
