# Implementation Plan - Phase 6: Auto Journal Posting

## Goal

Automate the creation of Journal Entries when Invoices and Bills are Posted, and when Payments are recorded. This ensures the General Ledger is always in sync with operational documents.

## Proposed Changes

### Backend Services

#### [MODIFY] [InvoiceService.ts](file:///c:/Offline/Coding/sync-erp/apps/api/src/services/InvoiceService.ts)

- Import `JournalService`.
- In `post()` method:
  - After successfully updating Invoice status to `POSTED`.
  - Call `journalService.postInvoice(companyId, invoice.invoiceNumber, invoice.amount)`.
  - Usage of `prisma.$transaction` is deferred for now (MVP sequential execution), but logic will be robust enough for happy path.

#### [MODIFY] [BillService.ts](file:///c:/Offline/Coding/sync-erp/apps/api/src/services/BillService.ts)

- Import `JournalService`.
- In `post()` method:
  - After updating Bill status to `POSTED`.
  - Call `journalService.postBill(companyId, bill.invoiceNumber, bill.amount)`.

#### [MODIFY] [PaymentService.ts](file:///c:/Offline/Coding/sync-erp/apps/api/src/services/PaymentService.ts)

- Import `JournalService`.
- In `create()` method:
  - Check `invoice.type`.
  - If `INVOICE` (AR): Call `journalService.postPaymentReceived`.
  - If `BILL` (AP): Call `journalService.postPaymentMade`.

## Verification Plan

### Manual Verification

1. **Invoice Auto-Post**:
   - Create a Sales Invoice.
   - Click "Post".
   - Go to "Finance > Journal Entries".
   - Verify a new entry exists (Ref: "Invoice: ...") with Dr AR / Cr Sales.

2. **Bill Auto-Post**:
   - Create a Vendor Bill.
   - Click "Post".
   - Verify Journal Entry (Ref: "Bill: ...") with Dr Inventory / Cr AP.

3. **Payment Auto-Post**:
   - Pay the Invoice/Bill.
   - Verify Journal Entry (Ref: "Payment ...") with appropriate Cash/Bank entries.
