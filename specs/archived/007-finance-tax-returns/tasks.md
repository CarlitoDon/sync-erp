# Tasks: Finance Tax, Returns & Accruals

**Feature**: 007-finance-tax-returns
**Status**: In Progress

## Phase 1: Setup

- [ ] T001 Verify project build and running state c:\Offline\Coding\sync-erp\package.json

## Phase 2: Foundational (Schema & Shared Types)

- [x] T002 Update Prisma Schema with Tax Fields c:\Offline\Coding\sync-erp\packages\database\prisma\schema.prisma
  - Add `subtotal`, `taxAmount`, `taxRate` to `Invoice` and `Bill`.
  - Add `taxRate` to `SalesOrder` and `PurchaseOrder`.
- [x] T003 Generate Prisma Client and Migrate c:\Offline\Coding\sync-erp\packages\database\package.json
- [x] T004 Define `TAX_RATES` constant and update DTOs c:\Offline\Coding\sync-erp\packages\shared\src\types\finance.ts

## Phase 3: User Story 1 - Flexible Tax Selection (Sales)

**Goal**: Enable users to select Tax Rates (0%, 11%, 12%) on Sales, splitting Revenue and Tax Liability.
**Test**: `InvoiceService` calculates Tax correctly; `JournalService` creates 3-line entry (AR/Rev/Tax).

- [x] T005 [US1] Update `InvoiceService.createFromSalesOrder` to calculate Tax c:\Offline\Coding\sync-erp\apps\api\src\services\InvoiceService.ts
- [x] T006 [US1] Update `JournalService.postInvoice` to handle distinct Tax Liability line c:\Offline\Coding\sync-erp\apps\api\src\services\JournalService.ts
- [x] T007 [US1] Update `SalesOrderService` to persist taxRate c:\Offline\Coding\sync-erp\apps\api\src\services\SalesOrderService.ts
- [x] T008 [US1] Integration Test for Sales Tax Journals c:\Offline\Coding\sync-erp\apps\api\test\integration\tax-sales.test.ts

## Phase 4: User Story 2 - Purchase Tax Selection (Input VAT)

**Goal**: Record VAT paid to suppliers as an Asset (VAT Receivable) rather than Inventory Cost.
**Test**: Bill with Tax results in Debit VAT Receivable, Debit Inventory (Net), Credit AP.

- [ ] T009 [US2] Update `BillService.createFromPurchaseOrder` to calculate Tax c:\Offline\Coding\sync-erp\apps\api\src\services\BillService.ts
- [ ] T010 [US2] Update `JournalService.postBill` to handle Input VAT (Receivable) c:\Offline\Coding\sync-erp\apps\api\src\services\JournalService.ts
- [ ] T011 [US2] Update `PurchaseOrderService` to persist taxRate c:\Offline\Coding\sync-erp\apps\api\src\services\PurchaseOrderService.ts
- [ ] T012 [US2] Integration Test for Purchase Tax Journals c:\Offline\Coding\sync-erp\apps\api\test\integration\tax-purchase.test.ts

## Phase 5: User Story 3 - Sales Return Reversal

**Goal**: Automate COGS reversal when Returns are processed.
**Test**: Processing a Return creates `Dr Inventory`, `Cr COGS`.

- [x] T013 [US3] Implement `InventoryService.processReturn` or similar logic c:\Offline\Coding\sync-erp\apps\api\src\services\InventoryService.ts
- [x] T014 [US3] Add `postSalesReturn` to `JournalService` c:\Offline\Coding\sync-erp\apps\api\src\services\JournalService.ts
- [x] T015 [US3] Wire `SalesOrderService` return action to Inventory/Journal logic c:\Offline\Coding\sync-erp\apps\api\src\services\SalesOrderService.ts
- [x] T016 [US3] Integration Test for Return Reversal c:\Offline\Coding\sync-erp\apps\api\test\integration\return-reversal.test.ts

## Phase 6: User Story 4 - Goods Receipt Accrual

**Goal**: Real-time liability accrual upon Goods Receipt.
**Test**: GRN creates Accrual Journal; Bill clears Accrual Journal.

- [x] T017 [US4] Update `InventoryService` to Trigger Accrual Journal on Receipt c:\Offline\Coding\sync-erp\apps\api\src\services\InventoryService.ts
- [x] T018 [US4] Add `postGoodsReceipt` to `JournalService` c:\Offline\Coding\sync-erp\apps\api\src\services\JournalService.ts
- [x] T019 [US4] Update `BillService.post` to offset Accrual (Suspense) c:\Offline\Coding\sync-erp\apps\api\src\services\BillService.ts
- [x] T020 [US4] Integration Test for Accrual Handling c:\Offline\Coding\sync-erp\apps\api\test\integration\accrual.test.ts

## Phase 7: Polish & Frontend Updates

- [x] T021 Update Frontend Sales Order Form for Tax Selection c:\Offline\Coding\sync-erp\apps\web\src\pages\finance\SalesOrderCreate.tsx
- [x] T022 Update Frontend Purchase Order Form for Tax Selection c:\Offline\Coding\sync-erp\apps\web\src\pages\finance\PurchaseOrderCreate.tsx
- [x] T023 Final E2E Verification of Full Cycle with Tax c:\Offline\Coding\sync-erp\apps\api\test\e2e\finance-tax-cycle.test.ts

## Dependencies

- Phase 2 (Schema) blocks ALL other phases.
- Phase 3, 4, 5, 6 are generally independent, but share `JournalService` and `InventoryService`.
