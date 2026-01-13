# Sync ERP Business Flows (Phase 1)

> **Golden Paths Only**: Phase 1 enforces strict "Golden Path" flows. Alternate paths (Partial Receipt, Backdated Posting, Multi-Currency) are explicitly disabled.

## 1. Procurement: Goods Receipt (GRN)

**Goal**: Receive goods from a confirmed Purchase Order and record liability + stock increase.

### Inputs

- `orderId` (string)
- `companyId` (string)
- `items[]` (optional, must match PO exactly)

### Golden Path Checks

1. **Full Receipt Only**: `input.items` count/quantity must match `order.items` exactly.
2. **Strict Flow**: `order` status must be `CONFIRMED`.

### Saga Steps

1. **Validate**: Check PO existence, status, and item match.
2. **Execute**:
   - Create `InventoryMovement` (IN) for each item.
   - Update `Product` stock quantity and average cost.
   - Post **Accrual Journal**: Dr Inventory (1400) / Cr Goods Received Not Invoiced (2105).
   - Update `Order` status to `COMPLETED`.

### Outputs

- `InventoryMovement[]`
- Journal Entry (Accrual)

---

## 2. Accounting: Post Vendor Bill

**Goal**: Verify vendor bill and confirm liability.

### Inputs

- `billId` (string)
- `companyId` (string)
- `businessDate` (Date, optional)

### Golden Path Checks

1. **Single Currency**: Bill currency must match Company Base (IDR).
2. **No Backdating**: `businessDate` must be today or future.

### Saga Steps

1. **Validate**: Bill exists, status is `DRAFT`.
2. **Execute**:
   - Update Bill status to `POSTED`.
   - Post **AP Journal**: Dr GRNI (2105) + VAT (1500) / Cr Accounts Payable (2100).
     - _Note_: Clears the accrual from GRN.

### Outputs

- Updated Bill (POSTED)
- Journal Entry (AP)

---

## 3. Accounting: Post Payment

**Goal**: Record payment for a posted invoice/bill.

### Inputs

- `invoiceId` (string)
- `companyId` (string)
- `amount` (number)
- `method` (string)
- `businessDate` (Date, optional)

### Golden Path Checks

1. **Single Currency**: Invoice currency must be IDR.
2. **No Backdating**: `businessDate` must be today or future.
3. **Sufficient Balance**: Payment amount <= Invoice balance.

### Saga Steps

1. **Validate**: Invoice exists, balance sufficient.
2. **Execute**:
   - Create `Payment` record.
   - Decrease Invoice `balance`.
   - If balance zero, set Invoice status `PAID`.
   - Post **Cash Journal**:
     - (Payment Received): Dr Cash/Bank (1100/1200) / Cr Accounts Receivable (1300).
     - (Payment Made): Dr Accounts Payable (2100) / Cr Cash/Bank (1100/1200).

### Outputs

- `Payment` Record
- Updated Invoice (`POSTED` or `PAID`)
- Journal Entry (Cash)

---

## 4. Accounting: Create Credit Note

**Goal**: Reverse an invoice/bill fully or partially.

### Inputs

- `invoiceId` (string)
- `amount` (number)
- `reason` (string)

### Golden Path Checks

1. **Single Currency**: Invoice currency must be IDR.
2. **No Backdating** (Implicitly uses current date).

### Saga Steps

1. **Validate**: Invoice exists, not VOID.
2. **Execute**:
   - Create Credit Note record (Invoice Type `CREDIT_NOTE`).
   - Post **Reversal Journal**: Swap Dr/Cr of original invoice/bill types.
   - Decrease Invoice `balance`.

### Outputs

- `Invoice` (Credit Note)
- Updated Original Invoice
- Journal Entry (Reversal)
