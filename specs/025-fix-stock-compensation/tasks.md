# Tasks: Fix Stock Compensation (B2)

**Feature**: Stock Compensation for Saga Rollback
**Branch**: `025-fix-stock-compensation`
**Status**: Completed

## Phase 1: Implementation

- [x] T001 Update `InvoicePostingSaga` imports (Skipped: Used existing InvoiceRepository eagerly loaded data)
- [x] T002 Update `InvoicePostingSaga.executeSteps` to store `orderId` (Skipped: Retrieved via InvoiceRepository)
- [x] T003 Update `InvoicePostingSaga.compensate` to use `InventoryService.processReturn` with items from InvoiceRepository

## Phase 2: Testing & Verification

- [x] T004 Create new unit test file `apps/api/test/unit/modules/accounting/t025_stock_compensation.test.ts`
- [x] T005 Add test: Verify `processReturn` called with correct arguments on failure
- [x] T006 Run new unit tests: `cd apps/api && npm test -- -t "stock_compensation"`
- [x] T007 Run existing saga tests: `cd apps/api && npm test -- -t "InvoicePostingSaga"`
- [x] T008 Full build verification: `npm run build`
- [x] T009 Update audit document B2 status to RESOLVED

## Dependencies

- InventoryService.processReturn (Existing)
- SalesRepository (Existing)
