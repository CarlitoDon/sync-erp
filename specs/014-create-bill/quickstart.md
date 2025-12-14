# Quick Start: Create Bill Feature

## Development Setup

```bash
# Start dev server
npm run dev
```

## Files to Modify

### Backend (High to Low Priority)

1. **packages/shared/src/validators/index.ts**
   - Add `CreateManualBillSchema`

2. **apps/api/src/modules/accounting/services/bill.service.ts**
   - Add `createManual()` method

3. **apps/api/src/modules/accounting/controllers/bill.controller.ts**
   - Update `create` to handle both PO and manual creation

4. **apps/api/src/routes/bill.ts**
   - Update validation for POST /api/bills

### Frontend

5. **apps/web/src/features/finance/services/billService.ts**
   - Add `createManual()` method

6. **apps/web/src/features/finance/pages/AccountsPayable.tsx**
   - Add "Create Bill" button and modal form

## Testing

```bash
# Run backend tests
cd apps/api && npm test

# Specific bill tests
cd apps/api && npm test -- --grep "BillService"
cd apps/api && npm test -- --grep "Bill Routes"

# Full build verification
npm run build
```

## Key Patterns to Follow

- Use `apiAction()` for API calls with success toasts
- Use existing `ActionButton` component
- Follow existing modal pattern from Invoice page
- Supplier dropdown should filter Partners by `type='SUPPLIER'`
