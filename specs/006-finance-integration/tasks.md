# Tasks: Integrasi Finance Accounting

**Branch**: `006-finance-integration` | **Phase**: Implementation

## Phase 1: Setup

- [x] T001 [P] Verify `packages/shared/src/types/finance.ts` has fully compatible types (check `JournalEntry` and `CreateJournalEntryInput`)
- [x] T002 [P] Create integration test scaffold `apps/api/test/integration/finance-automation.test.ts`

## Phase 2: Foundational

- [x] T003 [P] Add `resolveAndCreate` helper exposure (or equivalent internal reuse) in `apps/api/src/services/JournalService.ts`
- [x] T004 [P] Verify system accounts (1400, 5000) exist in seed data or create `apps/api/scripts/seed-finance-accounts.ts`

## Phase 3: Sales Shipment COGS Automation (US1)

- [x] T005 [P] [US1] Implement `postShipment(companyId, ref, amount)` in `apps/api/src/services/JournalService.ts` (Dr 5000 / Cr 1400)
- [x] T006 [P] [US1] Implement `postSalesReturn(companyId, ref, amount)` in `apps/api/src/services/JournalService.ts` (Dr 1400 / Cr 5000)
- [x] T007 [US1] Update `apps/api/src/services/InventoryService.ts` methods `processShipment` to calculate cost and call `journalService.postShipment`
- [x] T008 [US1] Verify `FulfillmentService` delegates correctly to `InventoryService` or update `apps/api/src/services/FulfillmentService.ts` to trigger journal if needed
- [x] T009 [US1] Enforce "Missing Account" block logic in `JournalService` for these new methods

## Phase 4: Inventory Adjustment Financials (US2)

- [x] T010 [P] [US2] Implement `postAdjustment(companyId, ref, amount, isLoss)` in `apps/api/src/services/JournalService.ts` (Target Account: 5200)
- [x] T011 [US2] Update `apps/api/src/services/InventoryService.ts` method `adjustStock` to call `journalService.postAdjustment`
- [x] T012 [US2] Implement Strict Stock Block logic in `apps/api/src/services/InventoryService.ts` (Reject if stock < 0)

## Phase 5: Full Cycle Verification (US3)

- [x] T013 [US3] Implement "Order to Cash" test flow in `apps/api/test/integration/finance-automation.test.ts` (SO -> Ship -> Invoice -> Pay)
- [x] T014 [US3] Implement "Procure to Pay" test flow in `apps/api/test/integration/finance-automation.test.ts` (PO -> Receive -> Bill -> Pay)
- [x] T015 [US3] Verify Accounting Equation in tests (Validation)

## Phase 6: Polish

- [x] T016 [P] Ensure error messages are user-friendly (e.g., "System Account [5000] missing")
- [x] T017 [P] Clean up any unused imports or temporary logs
- [x] T018 [E2E] Implement Full Cycle Finance E2E Test (Supplier -> Cust Payment)

## Dependencies

- Phase 3 depends on Phase 2 (Journal helpers)
- Phase 4 depends on Phase 2
- Phase 5 depends on Phase 3 & 4

## Implementation Strategy

- MVP: Complete Phase 3 (Shipments) to solve urgent inaccurate Profit reporting.
- Then Phase 4 (Adjustments).
- Strict stock check (T012) can be implemented early if critical.
