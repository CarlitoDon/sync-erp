# Implementation Plan - Phase 1 Flow Completeness (Golden Paths Only)

This feature validates the 4 critical "Golden Path" flows (GRN, Bill, Payment, Credit Note) and explicitly disables non-Phase 1 features (Partial Shipment, Multi-Currency, Backdated Posting).

## User Review Required

> [!IMPORTANT]
> **Blocking Non-Golden Paths**: We will implement explicit guards to REJECT partial shipments, multi-currency, and backdated postings. This is a breaking change for any development consumers relying on these nascent features.

## Technical Context

**Existing Components**:

- **Procurement**: `goods-receipt.saga.ts` (GRN) exists.
- **Accounting**: `bill-posting.saga.ts`, `payment-posting.saga.ts`, `credit-note.saga.ts` exist.
- **Controllers**: Mapped in `routes/` (`inventory.ts`, `bill.ts`, `payment.ts`, `invoice.ts`).

**Missing / To Be Implemented**:

- **Feature Guards**: Need to add explicit checks in Sagas or Services to throw `FEATURE_DISABLED` for non-golden inputs.
  - `goods-receipt.saga.ts`: Check `input.items` length == `po.items` length (Partial Receipt Guard).
  - all financial sagas: Check `currency` == `baseCurrency` (Multi-Currency Guard).
  - `journal.service.ts`: Check `businessDate` vs `now` (Backdated Guard).

## Proposed Changes

### [Procurement]

#### [MODIFY] [goods-receipt.saga.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/modules/procurement/sagas/goods-receipt.saga.ts)

- Add validation step to ensure `receivedQuantity` matches `orderedQuantity` (Partial Receipt Block).

### [Accounting]

#### [MODIFY] [journal.service.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/modules/accounting/journal.service.ts)

- Add validation to block `businessDate` earlier than TODAY (Backdated Block).

#### [MODIFY] [payment-posting.saga.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/modules/accounting/sagas/payment-posting.saga.ts)

- Add validation to block `currency` != `IDR` (or base currency) (Multi-Currency Block).

#### [MODIFY] [bill-posting.saga.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/modules/accounting/sagas/bill-posting.saga.ts)

- Add validation to block `currency` != `IDR` (Multi-Currency Block).

### [Shared]

#### [MODIFY] [domain-error.ts](file:///Users/wecik/Documents/Offline/sync-erp/packages/shared/src/errors/domain-error.ts)

- Add `FEATURE_DISABLED_PHASE_1` to `DomainErrorCodes`.

## Constitution Check

### Part A: Technical Architecture

- [x] **Layering**: Logic resides in Sagas/Services, not Controllers.
- [x] **Schema First**: No new fields, only new Error Code in Shared.
- [x] **Modular Parity**: Guards applied symmetrically (Sales & Procurement).

### Part B: Human Experience

- [x] **Error Clarity**: User receives specific `FEATURE_DISABLED_PHASE_1` error instead of generic failure.

## Verification Plan

### Automated Tests

Run the specific integration/unit tests for each flow:

- **GRN**: `npx vitest run unit/modules/procurement/t024_goods_receipt_saga.test.ts`
- **Bill**: `npx vitest run unit/modules/accounting/t025_bill_posting_saga.test.ts`
- **Payment**: `npx vitest run unit/modules/accounting/t026_payment_posting_saga.test.ts`
- **Credit Note**: `npx vitest run unit/modules/accounting/t027_credit_note_saga.test.ts`

### Manual Verification

1.  **Partial Receipt**: Attempt to receive 1 unit of a 10-unit PO via API. Expect `400 FEATURE_DISABLED_PHASE_1`.
2.  **Backdated**: Attempt to post payment with `businessDate: "2020-01-01"`. Expect `400 FEATURE_DISABLED_PHASE_1`.
