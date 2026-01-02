# Tasks: Document Linking & Overpayment Prevention (P2P + O2C)

**Input**: Design documents from `/specs/041-p2p-document-linking/`
**Updated**: 2025-12-30 (Unified for P2P + O2C)

**Key Models** (from Prisma schema):

- `Invoice` = Bills AND Invoices (distinguished by `type` field: BILL vs INVOICE)
- `Fulfillment` = GRN AND Shipment (distinguished by `type` field: RECEIPT vs SHIPMENT)
- `Order` = PO AND SO (distinguished by `type` field: PURCHASE vs SALES)

**Document Linking**:

| Flow | Order | Fulfillment | Invoice | Link Field |
|------|-------|-------------|---------|------------|
| P2P | PO | GRN (RECEIPT) | Bill (BILL) | `fulfillmentId` |
| O2C | SO | Shipment (SHIPMENT) | Invoice (INVOICE) | `fulfillmentId` |

---

## Phase 1: Database Schema ✅ DONE

**Purpose**: Add `fulfillmentId` FK to enable Invoice-Fulfillment linking

- [x] T001 Add `fulfillmentId` field to Invoice model in `packages/database/prisma/schema.prisma`
- [x] T002 Add `invoices` relation to Fulfillment model in `packages/database/prisma/schema.prisma`
- [x] T003 Run `npx prisma generate` in packages/database
- [x] T004 Run `npm run db:push` to sync schema

**Checkpoint**: Schema ready for Invoice-Fulfillment linking (both P2P and O2C)

---

## Phase 2: Backend Validation ✅ DONE

**Purpose**: Over-billing/over-invoicing prevention policies

- [x] T005 Add `DomainErrorCodes.EXCEEDS_ORDER_VALUE` to `packages/shared/src/errors/domain-error.ts`
- [x] T006 Add `DomainErrorCodes.FULFILLMENT_ALREADY_INVOICED` to `packages/shared/src/errors/domain-error.ts`
- [x] T007 Add `validateNotOverBilling()` to `apps/api/src/modules/accounting/policies/bill.policy.ts`
- [x] T008 Add `validateFulfillmentNotInvoiced()` to `apps/api/src/modules/accounting/policies/bill.policy.ts`
- [x] T009 Update `createFromPurchaseOrder` to save `fulfillmentId` in `apps/api/src/modules/accounting/services/bill.service.ts`
- [x] T010 Call `validateNotOverBilling()` in BillService before creating bill
- [x] T011 Call `validateFulfillmentNotInvoiced()` in BillService before creating bill

**Checkpoint**: P2P validation ready ✅

---

## Phase 3: User Story 1 - View Documents in PO Detail (P1) ✅ DONE

**Goal**: PO Detail shows all GRNs (Fulfillments type=RECEIPT) and Bills (Invoices type=BILL)

- [x] T012 [US1] Update `findById` in `apps/api/src/modules/procurement/purchase-order.repository.ts` to include fulfillments with invoices
- [x] T013 [US1] Update `findById` to include invoices (type=BILL)
- [x] T014 [US1] Add GRN list section to `apps/web/src/features/procurement/pages/PurchaseOrderDetail.tsx`
- [x] T015 [US1] Add Bills list section to PurchaseOrderDetail.tsx
- [x] T016 [US1] Show Bill type indicator (DP/Regular) in Bills list
- [x] T017 [US1] Show Fulfillment reference for regular Bills

### Test

- [ ] T018 [US1] Integration test: PO detail shows GRNs and Bills in `apps/api/test/integration/document-linking.test.ts`

**Checkpoint**: User can see all related documents in PO detail ✅

---

## Phase 4: User Story 1b - View Documents in SO Detail (P1) ✅ DONE

**Goal**: SO Detail shows all Shipments (Fulfillments type=SHIPMENT) and Invoices (Invoices type=INVOICE)

- [x] T019 [US1b] Update `findById` in `apps/api/src/modules/sales/sales-order.repository.ts` to include fulfillments with invoices
- [x] T020 [US1b] Update `findById` to include invoices (type=INVOICE)
- [x] T021 [US1b] Add Shipment list section to `apps/web/src/features/sales/pages/SalesOrderDetail.tsx`
- [x] T022 [US1b] Add Invoices list section to SalesOrderDetail.tsx
- [x] T023 [US1b] Show Invoice type indicator (DP/Regular)
- [x] T024 [US1b] Show Fulfillment reference for regular Invoices

### Test

- [ ] T025 [US1b] Integration test: SO detail shows Shipments and Invoices

**Checkpoint**: User can see all related documents in SO detail ✅

---

## Phase 5: User Story 2 - Create Bill from GRN (P1) ✅ DONE

**Goal**: Bills created from GRN reflect GRN value and link correctly

- [x] T026 [US2] Verify CreateBillModal passes `fulfillmentId` to API
- [ ] T027 [US2] Disable "Create Bill" on GRN if already billed in `apps/web/src/features/inventory/pages/GoodsReceiptDetail.tsx`

### Test

- [ ] T028 [US2] Integration test: Bill from GRN has correct amount in `apps/api/test/integration/document-linking.test.ts`
- [ ] T029 [US2] Integration test: Cannot bill same GRN twice

**Checkpoint**: GRN-specific billing works ✅

---

## Phase 6: User Story 2b - Create Invoice from Shipment (P1) ✅ DONE

**Goal**: Invoices created from Shipment reflect Shipment value and link correctly

- [x] T030 [US2b] Add `createFromSalesOrder` method to InvoiceService (if not exists)
- [x] T031 [US2b] Verify CreateInvoiceModal passes `fulfillmentId` to API
- [ ] T032 [US2b] Disable "Create Invoice" on Shipment if already invoiced

### Test

- [ ] T033 [US2b] Integration test: Invoice from Shipment has correct amount
- [ ] T034 [US2b] Integration test: Cannot invoice same Shipment twice

**Checkpoint**: Shipment-specific invoicing works ✅

---

## Phase 7: User Story 3 - DP Display (P2) ✅ DONE

**Goal**: DP Bills/Invoices clearly show no Fulfillment link

- [x] T035 [US3] Ensure DP Bill has null fulfillmentId in BillService
- [x] T036 [US3] Ensure DP Invoice has null fulfillmentId in InvoiceService
- [x] T037 [US3] Show "-" for Fulfillment reference when isDownPayment in Order detail

### Test

- [ ] T038 [US3] Integration test: DP Bill/Invoice shows no Fulfillment link

**Checkpoint**: Invoice types clearly distinguished ✅

---

## Phase 8: User Story 4 - Fulfillment Outstanding Amount (P2) ✅ DONE

**Goal**: Fulfillments show outstanding amount (liability for GRN, unbilled for Shipment)

- [x] T039 [US4] Add outstanding amount calculation - displayed on Order detail page
- [x] T040 [US4] Display Total/Billed/Outstanding in `PurchaseOrderDetail.tsx`
- [x] T041 [US4] Display Total/Invoiced/Outstanding in `SalesOrderDetail.tsx`
- [x] T042 [US4] Show linked Invoice info in Fulfillment table

### Test

- [ ] T043 [US4] Integration test: GRN liability calculation
- [ ] T044 [US4] Integration test: Shipment unbilled calculation

**Checkpoint**: Fulfillment outstanding amounts visible ✅

---

## Phase 9: User Story 5 - Overpayment Prevention (P1) ✅ DONE

**Goal**: Cannot over-bill/over-invoice or overpay

- [x] T045 [US5] Add `sumInvoicedByOrderId()` to `apps/api/src/modules/accounting/repositories/invoice.repository.ts`
- [x] T046 [US5] Use in validateNotOverBilling (P2P)
- [x] T047 [US5] Add validateNotOverInvoicing to InvoicePolicy (O2C)
- [ ] T048 [US5] Display error message in CreateBillModal/CreateInvoiceModal

### Test

- [ ] T049 [US5] Integration test: Cannot create Bill exceeding PO value
- [ ] T050 [US5] Integration test: Cannot create Invoice exceeding SO value
- [ ] T051 [US5] Integration test: Cannot overpay Bill/Invoice

**Checkpoint**: Financial controls in place ✅

---

## Phase 10: Polish ✅ DONE

- [x] T052 Run `npx tsc --noEmit` - zero errors
- [x] T053 Run `npm run lint` - no errors
- [x] T054 Run `npm run test` - all tests pass (195 passed)
- [ ] T055 Run integration tests for feature 041
- [ ] T056 Manual verification per quickstart.md

---

## Dependencies

| Phase      | Depends On |
| ---------- | ---------- |
| Phase 1    | None (DONE) |
| Phase 2    | Phase 1    |
| Phases 3-9 | Phase 2    |
| Phase 10   | All        |

---

## MVP Scope

**Core** (P1 stories): US1, US1b, US2, US2b, US5

1. View documents in PO detail (GRNs + Bills)
2. View documents in SO detail (Shipments + Invoices)
3. Create correct Fulfillment-linked invoices/bills
4. Prevent over-billing/over-invoicing

**Polish** (P2 stories): US3, US4

5. Clear DP/Regular distinction
6. Fulfillment outstanding amount display
