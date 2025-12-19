# Implementation Plan: Create Bill from Purchase Order

**Branch**: `018-bill-from-po` | **Date**: 2025-12-15 | **Spec**: [spec.md](file:///Users/wecik/Documents/Offline/sync-erp/specs/018-bill-from-po/spec.md)  
**Input**: Feature specification from `/specs/018-bill-from-po/spec.md`

## Summary

Add "Create Bill" button to completed Purchase Orders in the frontend. The backend already supports this via `createFromPurchaseOrder` in `BillService`. This is primarily a **frontend-only change** with minimal modifications.

## Technical Context

**Language/Version**: TypeScript 5.9.3  
**Primary Dependencies**: React 18, Vite 7, Express  
**Storage**: PostgreSQL via Prisma  
**Testing**: Vitest (unit tests in `apps/api/test/unit/`)  
**Target Platform**: Web (modern browsers)  
**Project Type**: Monorepo (Turborepo)  
**Performance Goals**: Bill creation < 30 seconds (2 clicks)  
**Constraints**: Multi-tenant isolation by companyId  
**Scale/Scope**: Extends existing PurchaseOrders and AccountsPayable pages

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Architecture**: Frontend ↔ Backend via HTTP only? Dependencies uni-directional?
- [x] **II. Contracts**: Shared types in `packages/shared`? Validators exported? (CreateBillSchema exists)
- [x] **III. Backend Layers**: Controller → Service → Repository pattern? (Already implemented)
- [x] **IV. Multi-Tenant**: ALL data isolated by `companyId`? (Yes, via X-Company-Id header)
- [x] **V. Frontend**: Business logic in `src/features/`? Global patterns followed?
- [x] **VIII. Verification**: `npx tsc --noEmit` and `npm run build` will pass?
- [x] **IX. Schema-First**: New API fields added to Zod schema FIRST? Types use `z.infer`?

> ✅ All gates pass. No new schemas needed - using existing `CreateBillSchema`.

## Proposed Changes

### Frontend: Procurement Module

#### [MODIFY] [PurchaseOrders.tsx](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/procurement/pages/PurchaseOrders.tsx)

1. Import `billService` from finance services
2. Add `handleCreateBill(orderId: string)` function:
   - Call `billService.create({ orderId })`
   - Use `apiAction()` for success toast
   - Refresh orders list
3. Add "Create Bill" ActionButton for orders with status `COMPLETED`
4. Add check for existing bills and show warning via `useConfirm()` if bill exists

---

#### [MODIFY] [billService.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/finance/services/billService.ts)

1. Add `createFromPO(orderId: string)` method:
   ```typescript
   async createFromPO(orderId: string): Promise<Bill> {
     const res = await api.post('/bills', { orderId });
     return res.data?.data ?? res.data;
   }
   ```
2. Add `checkExistingBillForPO(orderId: string)` method to check if PO already has a bill

---

#### [MODIFY] [AccountsPayable.tsx](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/finance/pages/AccountsPayable.tsx)

1. Display linked PO number in bill table (FR-008)
2. Add column for "Source PO" showing `order?.orderNumber` or "Manual"

---

### Backend: Accounting Module

#### [MODIFY] [bill.controller.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/modules/accounting/controllers/bill.controller.ts)

1. Add endpoint to check if PO already has a bill:
   - Route: `GET /bills/by-order/:orderId`
   - Returns existing bill or 404

---

#### [MODIFY] [bill.ts (routes)](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/routes/bill.ts)

1. Add route: `router.get('/by-order/:orderId', controller.getByOrderId)`

---

## Project Structure

### Documentation (this feature)

```text
specs/018-bill-from-po/
├── plan.md              # This file
├── research.md          # Not needed (no unknowns)
├── data-model.md        # Not needed (no schema changes)
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code Changes

```text
apps/
├── web/src/features/
│   ├── procurement/pages/PurchaseOrders.tsx    # Add Create Bill button
│   └── finance/
│       ├── services/billService.ts             # Add createFromPO method
│       └── pages/AccountsPayable.tsx           # Show PO reference
│
└── api/src/
    ├── modules/accounting/controllers/bill.controller.ts  # Add getByOrderId
    └── routes/bill.ts                                     # Add route
```

## Verification Plan

### Automated Tests

**Existing Tests** (in `apps/api/test/unit/`):

- `routes/bill.test.ts` - Route tests
- `services/BillService.test.ts` - Service tests

**Commands**:

```bash
# Run all tests
npm run test

# Run specific bill tests
cd apps/api && npx vitest run test/unit/routes/bill.test.ts
cd apps/api && npx vitest run test/unit/services/BillService.test.ts
```

### Build Verification

```bash
# TypeScript check (source of truth)
npx tsc --noEmit

# Full build
npm run build
```

### Manual Testing

**Prerequisites**:

1. Start dev servers: `npm run dev`
2. Ensure a company is selected
3. Have at least one COMPLETED Purchase Order

**Test Steps**:

1. **Create Bill from Completed PO**:
   - Navigate to Purchase Orders page
   - Find a PO with status COMPLETED
   - Click "Create Bill" button
   - Verify success toast appears
   - Navigate to Accounts Payable page
   - Verify new bill appears with correct amount

2. **Verify PO Link in Bill**:
   - In Accounts Payable, check the new bill
   - Verify it shows the source PO number

3. **Duplicate Bill Warning**:
   - Go back to Purchase Orders
   - Click "Create Bill" on the same PO
   - Verify confirmation dialog appears warning about existing bill
   - Confirm and verify second bill is created

4. **Button Visibility**:
   - Verify "Create Bill" only appears for COMPLETED orders
   - DRAFT and CONFIRMED orders should NOT have this button

## Complexity Tracking

> No violations - feature uses existing patterns.

| Aspect      | Approach                                   |
| ----------- | ------------------------------------------ |
| Backend     | Reuses existing `createFromPurchaseOrder`  |
| Validation  | Uses existing `CreateBillSchema`           |
| UI Patterns | Uses existing `ActionButton`, `useConfirm` |
