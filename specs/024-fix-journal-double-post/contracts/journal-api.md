# API Contract: Journal Service

**Feature**: 024-fix-journal-double-post  
**Date**: 2025-12-16

---

## Internal Service API

This feature modifies internal service methods, not REST endpoints.

### JournalService.postInvoice()

```typescript
/**
 * Create journal entries for invoice posting
 *
 * @param companyId - Tenant ID
 * @param invoiceId - NEW: Invoice ID for source tracking
 * @param invoiceNumber - Invoice number for reference display
 * @param amount - Total amount
 * @param subtotal - Optional subtotal (before tax)
 * @param taxAmount - Optional tax amount
 * @returns Created JournalEntry
 * @throws Error if journal already exists for this invoice (P2002)
 */
async postInvoice(
  companyId: string,
  invoiceId: string,        // NEW: For source tracking
  invoiceNumber: string,
  amount: number,
  subtotal?: number,
  taxAmount?: number
): Promise<JournalEntry>
```

### JournalService.postBill()

```typescript
async postBill(
  companyId: string,
  billId: string,           // NEW: For source tracking
  billNumber: string,
  amount: number,
  subtotal?: number,
  taxAmount?: number
): Promise<JournalEntry>
```

### JournalService.postPaymentReceived()

```typescript
async postPaymentReceived(
  companyId: string,
  paymentId: string,        // NEW: For source tracking
  invoiceNumber: string,
  amount: number,
  method: string
): Promise<JournalEntry>
```

### JournalService.postPaymentMade()

```typescript
async postPaymentMade(
  companyId: string,
  paymentId: string,        // NEW: For source tracking
  billNumber: string,
  amount: number,
  method: string
): Promise<JournalEntry>
```

### JournalService.postCreditNote()

```typescript
async postCreditNote(
  companyId: string,
  creditNoteId: string,     // NEW: For source tracking
  invoiceNumber: string,
  amount: number,
  subtotal?: number,
  taxAmount?: number
): Promise<JournalEntry>
```

---

## Error Responses

| Error                                                        | Condition                         | Handler                                          |
| ------------------------------------------------------------ | --------------------------------- | ------------------------------------------------ |
| `Journal entry already exists for ${sourceType} ${sourceId}` | P2002 unique constraint violation | Service catches and re-throws with clear message |

---

## Saga Caller Changes

### InvoicePostingSaga.executeSteps()

```typescript
// Before
await this.journalService.postInvoice(
  input.companyId,
  updatedInvoice.invoiceNumber,
  Number(updatedInvoice.amount),
  ...
);

// After
await this.journalService.postInvoice(
  input.companyId,
  input.invoiceId,              // NEW: Pass invoice ID
  updatedInvoice.invoiceNumber,
  Number(updatedInvoice.amount),
  ...
);
```

### Similar changes for:

- `BillPostingSaga.executeSteps()` → add `billId`
- `PaymentPostingSaga.executeSteps()` → add `paymentId`
- `CreditNoteSaga.executeSteps()` → add `creditNoteId`
