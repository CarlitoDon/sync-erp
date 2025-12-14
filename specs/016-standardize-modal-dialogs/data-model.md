# Data Model: Modal Standardization

**No database changes required.**

## Existing Components Used

This feature refactors UI patterns only. No new data models.

| Entity                      | Impact                                      |
| --------------------------- | ------------------------------------------- |
| Partner (Supplier/Customer) | Form fields unchanged, only wrapper changes |
| Product                     | Form fields unchanged, only wrapper changes |
| Account                     | Form fields unchanged, only wrapper changes |
| SalesOrder                  | Form fields unchanged, only wrapper changes |
| PurchaseOrder               | Form fields unchanged, only wrapper changes |

## New UI Component

| Component | Purpose                                     |
| --------- | ------------------------------------------- |
| FormModal | Reusable modal wrapper for all create forms |

### FormModal Props

```typescript
interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}
```

## Notes

- This is a pure UI refactoring task
- No API changes required
- Form validation logic remains unchanged
- State management pattern (`useState` for form data) remains unchanged
