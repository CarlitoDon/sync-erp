# Walkthrough: Create Bill from Purchase Order

**Feature**: 018-bill-from-po  
**Branch**: `018-bill-from-po`  
**Completed**: 2025-12-15

## Summary

Added "Create Bill" functionality to completed Purchase Orders, allowing users to create supplier bills directly from POs with automatic amount/supplier copying.

## Changes Made

### Backend (3 files)

| File                                                                                                                                       | Change                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| [invoice.repository.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/modules/accounting/repositories/invoice.repository.ts) | Added `findByOrderId()` method             |
| [bill.service.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/modules/accounting/services/bill.service.ts)                 | Added `getByOrderId()` method              |
| [bill.controller.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/modules/accounting/controllers/bill.controller.ts)        | Added `getByOrderId` handler               |
| [bill.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/routes/bill.ts)                                                      | Added `GET /bills/by-order/:orderId` route |

### Frontend (3 files)

| File                                                                                                                            | Change                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [billService.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/finance/services/billService.ts)          | Added `createFromPO()` and `getByOrderId()`                             |
| [PurchaseOrders.tsx](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/procurement/pages/PurchaseOrders.tsx) | Added `handleCreateBill()` with duplicate warning, "Create Bill" button |
| [AccountsPayable.tsx](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/finance/pages/AccountsPayable.tsx)   | Added "Source PO" column                                                |

## Verification

| Check                           | Status               |
| ------------------------------- | -------------------- |
| TypeScript (`npx tsc --noEmit`) | ✅ Pass              |
| Build (`npm run build`)         | ✅ Pass              |
| Existing bill tests             | ⏳ Pending user run  |
| Manual test checklist           | ⏳ Pending user test |

## Manual Test Checklist

1. [ ] COMPLETED PO shows "Create Bill" button
2. [ ] DRAFT/CONFIRMED PO does NOT show button
3. [ ] Clicking button creates bill + success toast
4. [ ] New bill appears in Accounts Payable
5. [ ] Clicking again on same PO shows duplicate warning
6. [ ] Source PO column shows PO number (or "Manual")

## User Stories Completed

- ✅ **US1 (P1)**: Create Bill from Completed PO
- ✅ **US2 (P2)**: View PO Details in Bill
- ✅ **US3 (P2)**: Prevent Duplicate Bills
