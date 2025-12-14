# Quick Start: Modal Standardization

## Files to Create/Modify

| Action | File                              | Purpose                |
| ------ | --------------------------------- | ---------------------- |
| NEW    | `src/components/ui/FormModal.tsx` | Reusable modal wrapper |
| MODIFY | `Suppliers.tsx`                   | Inline → Modal         |
| MODIFY | `Customers.tsx`                   | Inline → Modal         |
| MODIFY | `Products.tsx`                    | Inline → Modal         |
| MODIFY | `Finance.tsx`                     | Inline → Modal         |
| MODIFY | `SalesOrders.tsx`                 | Inline → Modal         |
| MODIFY | `PurchaseOrders.tsx`              | Inline → Modal         |

## Implementation Steps

1. **Create FormModal component** (reusable)
2. **Apply to simple forms first** (Suppliers, Customers, Products)
3. **Apply to complex forms** (SalesOrders, PurchaseOrders)
4. **Finance page** (nested in tabs)
5. **Verify with grep** (zero inline forms remaining)

## FormModal Pattern

```tsx
// Usage
<FormModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  title="New Supplier"
>
  <form onSubmit={handleSubmit}>{/* form fields */}</form>
</FormModal>
```

## Before/After Pattern

**Before** (inline):

```tsx
{
  showForm && (
    <div className="bg-white rounded-xl shadow-sm border...">
      <form>...</form>
    </div>
  );
}
```

**After** (modal):

```tsx
<FormModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  title="..."
>
  <form>...</form>
</FormModal>
```

## Testing Checklist

- [ ] Suppliers: Modal opens/closes correctly
- [ ] Customers: Modal opens/closes correctly
- [ ] Products: Modal opens/closes correctly
- [ ] Finance (Account): Modal opens/closes correctly
- [ ] Sales Orders: Modal scrollable, opens/closes correctly
- [ ] Purchase Orders: Modal scrollable, opens/closes correctly
