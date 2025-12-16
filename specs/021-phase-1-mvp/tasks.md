# Tasks: Phase 1 - MVP Core Flows

**Status**: Planning
**Branch**: `021-phase-1-mvp`
**Spec**: `specs/021-phase-1-mvp/spec.md`

## 1. Inventory Module Verification & Gaps

- [x] **T001: Verify Stock Movements (FR-001, FR-002)** <!-- id: 0 -->
  - Check `InventoryService.processGoodsReceipt` increases stock and recalculates AVG cost.
  - Check `InventoryService.processShipment` decreases stock.
- [x] **T002: Enforce Rules & Policies (FR-005)** <!-- id: 1 -->
  - Ensure `InventoryPolicy` prevents negative stock for RETAIL/MANUFACTURING (already in Phase 0?).
  - Ensure `InventoryService` calls this policy.

## 2. Procurement Flow (Purchase -> Stock -> Bill)

- [x] **T003: Verify Purchase Order Cycle (FR-009)** <!-- id: 2 -->
  - Test `ProcurementService.create`, `confirm`, `complete`.
- [x] **T004: Implement Goods Receipt Endpoint** <!-- id: 3 -->
  - Controller exists? Wire `POST /api/inventory/goods-receipt` to `InventoryService`.
- [x] **T005: Implement/Verify Bill Service (FR-011)** <!-- id: 4 -->
  - Verify `InvoiceService` supports `type: 'BILL'`.
  - Ensure `Bill` posting triggers `JournalService.postBill`.
  - Ensure `Bill` posting DOES NOT increase stock (Stock IN handled by Goods Receipt FR-010).

## 3. Sales Flow (Order -> Invoice -> Payment)

- [x] **T006: Verify Sales Order Cycle (FR-006)** <!-- id: 5 -->
  - Test `SalesService.create`, `confirm` (checks stock), `complete`.
- [x] **T007: Implement Invoice-Stock Link (FR-008)** <!-- id: 6 -->
  - **CRITICAL GAP**: Refactor `InvoiceService.post` to triggers `InventoryService.processShipment` (Stock OUT) if linked Order hasn't been shipped yet.
  - Verified in `t007_invoice_link.test.ts`.
- [x] **T008: Verify Journal Creation for Invoice (FR-011)** <!-- id: 7 -->
  - Verify proper accounts (4100 Sales, 1300 AR, 2300 VAT).
  - Ensure `InvoiceService.post` calls `JournalService.postInvoice` (Revenue + AR + COGS).
  - **Wait**: `postInvoice` currently does Revenue + AR. Does it do COGS?
  - Check `JournalService.postInvoice`. (It seems to do Revenue/AR. COGS is in `postShipment`).

## 4. Payment & Accounting

- [x] **T009: Implement/Verify Payment Service (SC-001)** <!-- id: 8 -->
  - Verify `PaymentService` handling for Invoices (AR) and Bills (AP).
  - Ensure Journals are created (`postPaymentReceived`, `postPaymentMade`).
- [x] **T010: Integration Test: Quote-to-Cash (SC-001)** <!-- id: 9 -->
  - Verified Full Flow: SO -> Invoice -> Shipment -> Payment.
  - Verified Accounting (Journals) and Inventory (Stock).
  - Detected and Fixed Double Tax Bug in InvoiceService.

## 5. Master Data Policies

- [x] **T011: Verify Product Defaults (FR-012, FR-013)** <!-- id: 10 -->
  - Verified in Phase 0 `seed.ts` (PROD-001, PROD-002, PROD-003).
- [x] **T012: Manual Verification Walkthrough** <!-- id: 11 -->
  - Replaced by T010 Automated Integration Test. Warehouse defaults to Primary.
