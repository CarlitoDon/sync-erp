# Quickstart: Phase 1 Frontend Operational UI

**Feature**: 031-phase1-frontend-ops  
**Date**: 2025-12-17

## Prerequisites

- Node.js 20+
- Running dev server (`npm run dev` from monorepo root)
- Seeded database with test data

## Development Setup

### 1. Start Development Environment

```bash
# From monorepo root
npm run dev
```

This starts:

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### 2. Verify Existing Screens

Before implementing new features, verify existing screens work:

| Screen       | URL                 | Expected            |
| ------------ | ------------------- | ------------------- |
| Dashboard    | `/` or `/dashboard` | Shows basic layout  |
| Invoice List | `/finance`          | Shows invoice table |
| PO List      | `/procurement`      | Shows PO table      |

### 3. Implementation Order

Follow this order to minimize dependencies:

1. **Button Loading State** (shared component)
   - Add `isLoading` prop to `Button.tsx`
   - Affects all forms

2. **Dashboard KPIs**
   - Backend: Create `/api/dashboard/kpis` endpoint
   - Frontend: Add `DashboardKPIs.tsx` component

3. **Payment Modal**
   - Create `PaymentModal.tsx` with businessDate field
   - Integrate with Invoice Detail page

4. **Receive Goods Modal**
   - Create `ReceiveGoodsModal.tsx` with businessDate field
   - Integrate with PO Detail page

5. **Admin Observability**
   - Backend: Create `/api/admin/*` endpoints
   - Frontend: Create `features/admin/` module

---

## Key Files to Modify

### Shared Components

```bash
# Button with loading state
apps/web/src/components/ui/Button.tsx

# Existing hooks to reuse
apps/web/src/hooks/useConfirm.ts
apps/web/src/hooks/useCompanyData.ts
```

### Dashboard

```bash
# Add KPI cards
apps/web/src/features/dashboard/components/DashboardKPIs.tsx  # NEW
apps/web/src/features/dashboard/pages/Dashboard.tsx           # MODIFY
apps/web/src/features/dashboard/services/dashboard.service.ts # MODIFY
```

### Finance (Invoice + Payment)

```bash
# Payment modal
apps/web/src/features/finance/components/PaymentModal.tsx     # NEW
apps/web/src/features/finance/pages/InvoiceDetailPage.tsx     # MODIFY
```

### Procurement (PO + GRN)

```bash
# Receive goods modal
apps/web/src/features/procurement/components/ReceiveGoodsModal.tsx  # NEW
apps/web/src/features/procurement/pages/PODetailPage.tsx            # MODIFY
```

### Admin (New Feature)

```bash
# Create entire feature
apps/web/src/features/admin/
├── components/SagaFailureList.tsx
├── components/JournalOrphanList.tsx
├── pages/Observability.tsx
└── services/admin.service.ts

# Backend endpoints
apps/api/src/routes/admin.routes.ts
apps/api/src/modules/admin/controller.ts
apps/api/src/modules/admin/service.ts
apps/api/src/modules/admin/repository.ts
```

---

## Testing Commands

```bash
# TypeScript check (source of truth)
npx tsc --noEmit

# Run all unit tests
npm run test:unit

# Run specific test file
npm run test:unit -- --testNamePattern="PaymentModal"

# Full build verification
npm run build
```

---

## Common Patterns

### 1. Loading Button

```tsx
// Usage
<Button isLoading={isSubmitting} onClick={handleSubmit}>
  Submit
</Button>;

// Implementation in Button.tsx
interface ButtonProps {
  isLoading?: boolean;
  // ... other props
}

export function Button({
  isLoading,
  children,
  ...props
}: ButtonProps) {
  return (
    <button disabled={isLoading || props.disabled} {...props}>
      {isLoading ? <Spinner /> : children}
    </button>
  );
}
```

### 2. Form with businessDate

```tsx
const [form, setForm] = useState({
  amount: 0,
  method: 'BANK_TRANSFER',
  businessDate: new Date().toISOString().split('T')[0], // Default today
});

<input
  type="date"
  value={form.businessDate}
  onChange={(e) => setForm({ ...form, businessDate: e.target.value })}
/>;
```

### 3. Confirmation Modal

```tsx
const confirm = useConfirm();

const handleVoid = async () => {
  const confirmed = await confirm.show({
    title: 'Void Invoice?',
    message: 'This action cannot be undone.',
    danger: true,
  });

  if (confirmed) {
    await voidInvoice(invoiceId);
  }
};
```

### 4. API Action with Loading

```tsx
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async () => {
  setIsSubmitting(true);
  try {
    const result = await apiAction(
      () => paymentService.create(invoiceId, form),
      'Payment recorded!'
    );
    if (result) onSuccess();
  } finally {
    setIsSubmitting(false);
  }
};
```

---

## Checklist Before PR

- [ ] All screens render without errors
- [ ] businessDate field present in Payment Modal
- [ ] businessDate field present in Receive Goods Modal
- [ ] All submit buttons show loading state
- [ ] Confirmation modals on irreversible actions
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` passes
- [ ] Unit tests added for new components
