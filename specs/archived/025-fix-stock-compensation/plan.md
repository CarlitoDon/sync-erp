# Implementation Plan - Fix Stock Compensation (B2)

**Feature**: Stock Compensation for Saga Rollback (B2)
**Goal**: Implement complete compensation logic in `InvoicePostingSaga` to reverse stock movements and COGS journals when posting fails, preventing inventory corruption.

## User Review Required

> [!IMPORTANT]
> **Stock Reversal Logic**: The compensation will use `InventoryService.processReturn()` which performs a "Sales Return". This creates IN movements and posts a reversal journal for any COGS. This mirrors the `processShipment` logic used in the forward flow.

> [!NOTE]
> **Assumption**: The current `InvoicePostingSaga` processes the _entire_ order shipment at once (as confirmed in code). Therefore compensation will reverse the _entire_ order shipment.

## Proposed Changes

### 1. Database & Schema

_No changes required_

### 2. Services & Repositories

#### [MODIFY] `apps/api/src/modules/accounting/sagas/invoice-posting.saga.ts`

- **Imports**: Add `SalesRepository` from `../../sales/sales.repository`.
- **Properties**: Add `private salesRepository = new SalesRepository();`.
- **Execution**: Store `orderId` in saga context `stepData` when shipment is successful (inside `executeSteps`).
- **Compensation**:
  - Replace `console.warn` block.
  - Retrieve `orderId` from context.
  - Fetch Order Items using `this.salesRepository.findItems(orderId)`.
  - Map items to `{ productId, quantity }`.
  - Call `this.inventoryService.processReturn(companyId, orderId, mappedItems, reference)`.

### 3. Testing

#### [NEW] `apps/api/test/unit/modules/accounting/t025_stock_compensation.test.ts`

- **Test 1**: Verify `processReturn` is called with correct arguments when saga fails after stock deduction.
- **Test 2**: Verify compensation flow reverses both stock AND journal (mocked interaction or checking side effects).

## Verification Plan

### Automated Tests

- Run new unit test: `cd apps/api && npm test -- -t "stock_compensation"`
- Run existing saga tests: `cd apps/api && npm test -- -t "InvoicePostingSaga"`

### Manual Verification

1. **Setup**: Create an Invoice linked to an Order with stock items.
2. **Trigger**: Force failure in `JournalService.postInvoice` (e.g., by mocking it to throw or using a "poisoned" input if possible, or temporarily code change).
3. **Verify**:
   - Check SagaLog: Status should be `COMPENSATED`.
   - Check Stock: Quantity should be restored to pre-shipment level.
   - Check Journals: Should see Shipment Journal (COGS) and then Reversal Journal.
   - Check Invoice: Status should be DRAFT.
