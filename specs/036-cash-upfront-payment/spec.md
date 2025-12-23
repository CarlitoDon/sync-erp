# Feature Specification: Cash Upfront Payment (Procurement)

**Feature Branch**: `036-cash-upfront-payment`  
**Created**: 2025-12-23  
**Status**: Draft  
**Input**: User description: "cash upfront payment untuk procurement flow"

---

## Overview

Cash Upfront Payment adalah pembayaran yang terjadi **sebelum** barang/jasa diterima. Secara akuntansi, ini **bukan biaya**, **bukan HPP**, dan **bukan inventory** pada saat pembayaran. Pembayaran masuk ke akun aset sementara (Prepaid / Advances to Supplier) dan di-clear saat invoice supplier diposting.

### Flow Perbedaan

| Aspek              | Normal PO             | Upfront PO                 |
| ------------------ | --------------------- | -------------------------- |
| Payment            | Setelah GRN + Invoice | **Sebelum** GRN            |
| Journal saat bayar | Dr AP, Cr Cash        | **Dr Prepaid, Cr Cash**    |
| Hutang (AP) timbul | Saat Invoice dipost   | Saat Invoice dipost (sama) |
| Clearing           | Payment vs AP         | **Prepaid vs AP**          |

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Create PO with Upfront Terms (Priority: P1)

Sebagai Procurement Admin, saya ingin membuat Purchase Order dengan term "Cash Upfront" agar sistem tahu bahwa pembayaran harus dilakukan sebelum barang dikirim supplier.

**Why this priority**: Fundamental untuk membedakan alur Upfront vs Normal.

**Integration Scenario**: Create PO with `paymentTerms = UPFRONT` → Verify PO status = `POSTED` → Verify tombol "Register Payment" muncul.

**Acceptance Scenarios**:

1. **Given** PO dengan term "UPFRONT", **When** PO dipost, **Then** tidak ada journal yang dibuat (PO adalah komitmen, bukan transaksi keuangan).
2. **Given** PO dengan term "UPFRONT", **When** melihat halaman detail PO, **Then** tombol "Register Payment" harus muncul.

---

### User Story 2 - Register Upfront Payment (Priority: P1)

Sebagai Finance Admin, saya ingin mencatat pembayaran upfront ke supplier sehingga dana tercatat sebagai aset sementara (Prepaid/Advances).

**Why this priority**: Core accounting transaction yang membedakan upfront dari normal flow.

**Integration Scenario**: Post Payment → Verify Journal (Dr Prepaid, Cr Cash) → Verify PO status update.

**Acceptance Scenarios**:

1. **Given** PO dengan term "UPFRONT" yang sudah Posted, **When** payment dipost, **Then** Journal dibuat:
   - **Debit**: Advances to Supplier / Prepaid Inventory (Akun 1600)
   - **Credit**: Cash / Bank (Akun 1100/1200)
2. **Given** Payment berhasil dipost, **When** melihat PO, **Then** status `paymentStatus = PAID_UPFRONT`.
3. **Given** PO dengan term "UPFRONT", **When** payment amount > PO total, **Then** sistem HARUS menolak dengan pesan error.

---

### User Story 3 - Receive Goods (GRN) After Upfront Payment (Priority: P1)

Sebagai Warehouse Admin, saya ingin menerima barang setelah pembayaran upfront sudah dilakukan.

**Why this priority**: Enables physical goods flow after financial commitment.

**Integration Scenario**: Create & Post GRN → Verify Journal (Dr Inventory, Cr GRN Clearing) → Verify GRN linked to PO.

**Acceptance Scenarios**:

1. **Given** PO dengan `paymentStatus = PAID_UPFRONT`, **When** GRN dipost, **Then** Journal dibuat:
   - **Debit**: Inventory Asset (Akun 1400)
   - **Credit**: GRNI Accrual / GRN Clearing (Akun 2105)
2. **Given** PO tanpa payment (untuk term UPFRONT), **When** mencoba create GRN, **Then** sistem tetap BOLEH (policy decision: GRN tidak diblock by payment).

---

### User Story 4 - Create & Post Supplier Invoice (Priority: P1)

Sebagai AP Admin, saya ingin mencatat invoice dari supplier dan memposting agar hutang timbul di buku besar.

**Why this priority**: Invoice posting triggers AP liability creation.

**Integration Scenario**: Create Bill from PO → Post Bill → Verify Journal (Dr GRN Clearing, Cr AP).

**Acceptance Scenarios**:

1. **Given** GRN sudah dipost, **When** Bill dipost, **Then** Journal dibuat:
   - **Debit**: GRNI Accrual / GRN Clearing (Akun 2105)
   - **Credit**: Accounts Payable (Akun 2100)
2. **Given** Bill dipost, **When** ada prepaid payment untuk PO yang sama, **Then** sistem HARUS menampilkan info "Prepaid available for settlement".

---

### User Story 5 - Auto-Settlement Prepaid vs AP (Priority: P2)

Sebagai Finance Admin, saya ingin sistem otomatis meng-clear saldo prepaid terhadap AP yang timbul dari invoice.

**Why this priority**: Closes the accounting loop; ensures AP aging dan Balance Sheet akurat.

**Integration Scenario**: Post Bill → Trigger Settlement → Verify Journal (Dr AP, Cr Prepaid) → Final balances correct.

**Acceptance Scenarios**:

1. **Given** Bill dipost dan ada Prepaid Payment dengan amount = Bill amount, **When** settlement dilakukan, **Then** Journal dibuat:
   - **Debit**: Accounts Payable (Akun 2100)
   - **Credit**: Advances to Supplier / Prepaid Inventory (Akun 1600)
   - AP saldo = 0, Prepaid saldo = 0.
2. **Given** Bill amount > Prepaid amount, **When** settlement dilakukan, **Then** sisa AP tetap outstanding (partial settlement).
3. **Given** Bill amount < Prepaid amount, **When** settlement dilakukan, **Then** sisa Prepaid tetap sebagai aset.

---

### Edge Cases

- **Partial Upfront**: Bagaimana jika supplier minta 50% upfront, 50% after delivery?
  - System HARUS mendukung partial upfront payment, dengan settlement proporsional.
- **Cancellation**: PO dibatalkan setelah upfront payment?
  - Prepaid harus di-reverse atau di-refund (via Supplier Refund flow).
- **Multiple GRN**: PO dengan partial delivery?
  - GRN Clearing di-prorate per delivery; settlement tetap vs total invoice.

---

## Requirements _(mandatory)_

### Functional Requirements

#### PO & Payment Terms

- **FR-001**: System MUST support `paymentTerms` field on Order with values: `NET_30`, `PARTIAL`, `UPFRONT`.
- **FR-002**: System MUST display "Register Payment" button on PO detail page ONLY when `paymentTerms = UPFRONT`.
- **FR-003**: System MUST NOT create any journal when PO is posted (PO = commitment, not financial transaction).

#### Upfront Payment Registration

- **FR-004**: System MUST create Payment record with `referenceType = PO` and `paymentType = UPFRONT`.
- **FR-005**: System MUST validate `payment.amount <= PO.totalAmount - alreadyPaidAmount`.
- **FR-006**: System MUST create journal on payment post:
  - Dr: Advances to Supplier (1600)
  - Cr: Cash/Bank (1100/1200)
- **FR-007**: System MUST update PO `paymentStatus` to `PAID_UPFRONT` when fully paid.

#### GRN Processing

- **FR-008**: System MUST allow GRN creation regardless of payment status (GRN is about physical receipt).
- **FR-009**: System MUST create journal on GRN post:
  - Dr: Inventory (1400)
  - Cr: GRNI Accrual (2105)

#### Bill/Invoice Processing

- **FR-010**: System MUST create journal on Bill post:
  - Dr: GRNI Accrual (2105)
  - Cr: Accounts Payable (2100)
- **FR-011**: System MUST detect existing Prepaid Payment for the linked PO and flag for settlement.

#### Settlement

- **FR-012**: System MUST provide mechanism to settle Prepaid against AP (manual or auto).
- **FR-013**: System MUST create journal on settlement:
  - Dr: Accounts Payable (2100)
  - Cr: Advances to Supplier (1600)
- **FR-014**: System MUST handle partial settlement (Prepaid < AP or Prepaid > AP).

### Key Entities

- **Order (PO)**: Extended with `paymentTerms` enum and `paymentStatus` field.
- **Payment**: Extended to support `referenceType = PO` and `paymentType = UPFRONT`.
- **GoodsReceipt**: No changes, existing structure supports upfront flow.
- **Bill (Invoice type=BILL)**: No changes, existing structure supports upfront flow.
- **Settlement**: New entity or logic to track Prepaid vs AP clearing.

### Required Chart of Accounts

| Code | Name                 | Description                  |
| ---- | -------------------- | ---------------------------- |
| 1100 | Cash                 | Petty cash                   |
| 1200 | Bank                 | Bank accounts                |
| 1400 | Inventory Asset      | Physical stock               |
| 1600 | Advances to Supplier | Prepaid for procurement      |
| 2100 | Accounts Payable     | Trade payables               |
| 2105 | GRNI Accrual         | Goods received, not invoiced |

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of Upfront payments create correct Dr Prepaid / Cr Cash journal.
- **SC-002**: 100% of Bills from Upfront POs are flagged for settlement against existing prepaid.
- **SC-003**: AP Aging Report shows zero balance for fully settled upfront transactions.
- **SC-004**: Prepaid balance is traceable to specific PO and settlement history.
- **SC-005**: Users can complete full upfront cycle (PO → Pay → GRN → Bill → Settle) in under 5 minutes.

---

## Frontend Specification _(mandatory)_

### Navigation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           UPFRONT PAYMENT FLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

Purchase Orders List
       │
       ▼
┌──────────────┐    Click "Register Payment"    ┌─────────────────────┐
│  PO Detail   │ ─────────────────────────────▶ │  Payment Modal      │
│  (UPFRONT)   │                                │  (Register & Post)  │
└──────────────┘                                └─────────────────────┘
       │                                                  │
       │ Click "Create GRN"                               │ Success
       ▼                                                  ▼
┌──────────────┐                                ┌─────────────────────┐
│  GRN Form    │                                │  PO Detail          │
│              │                                │  (PAID_UPFRONT)     │
└──────────────┘                                └─────────────────────┘
       │
       │ Post GRN
       ▼
┌──────────────┐    Click "Create Bill"         ┌─────────────────────┐
│  GRN Detail  │ ─────────────────────────────▶ │  Bill Form          │
└──────────────┘                                └─────────────────────┘
                                                          │
                                                          │ Post Bill
                                                          ▼
                                                ┌─────────────────────┐
                                                │  Bill Detail        │
                                                │  + Settlement Info  │
                                                └─────────────────────┘
                                                          │
                                                          │ Click "Settle Prepaid"
                                                          ▼
                                                ┌─────────────────────┐
                                                │  Settlement Modal   │
                                                │  (Confirm & Post)   │
                                                └─────────────────────┘
```

---

### Page 1: Purchase Order List

**Route**: `/purchase-orders`

**Changes Required**: None (existing page, but PO cards should show payment term badge)

**New Elements**:

| Element          | Description                                        |
| ---------------- | -------------------------------------------------- |
| Badge on PO Card | Show "UPFRONT" badge if `paymentTerms = UPFRONT`   |
| Badge Color      | Orange/Warning for UPFRONT, Green for PAID_UPFRONT |

---

### Page 2: Purchase Order Detail

**Route**: `/purchase-orders/:id`

**Wireframe**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back                                                                 │
│                                                                         │
│  Purchase Order #PO-2024-0042                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │ Status: POSTED   │  │ Term: UPFRONT    │  │ Payment: PENDING │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ UPFRONT PAYMENT REQUIRED                                         │   │
│  │ This order requires payment before goods can be shipped.         │   │
│  │                                                                   │   │
│  │ Total Amount:     Rp 10,000,000                                  │   │
│  │ Paid Amount:      Rp  0                                          │   │
│  │ Remaining:        Rp 10,000,000                                  │   │
│  │                                                                   │   │
│  │ [Register Payment]                                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Order Items                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Product          │ Qty │ Unit Price  │ Subtotal                 │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ Widget A         │ 100 │ Rp 50,000   │ Rp 5,000,000             │   │
│  │ Widget B         │ 50  │ Rp 100,000  │ Rp 5,000,000             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Payment History                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ (No payments recorded)                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Actions                                                                │
│  [Create GRN]  [Cancel Order]                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**After Payment (PAID_UPFRONT)**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │ Status: POSTED   │  │ Term: UPFRONT    │  │ ✓ PAID           │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ✓ PAYMENT COMPLETE                                               │   │
│  │ Upfront payment has been received. Order is ready for delivery.  │   │
│  │                                                                   │   │
│  │ Total Paid:       Rp 10,000,000                                  │   │
│  │ Payment Date:     23 Dec 2024                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Payment History                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Date       │ Amount       │ Method │ Reference                   │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ 23 Dec 24  │ Rp 10,000,000│ Bank   │ TRF-001                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Component States**:

| State                | UI Behavior                                |
| -------------------- | ------------------------------------------ |
| Loading              | Skeleton loader for entire page            |
| Error (PO not found) | Error page with "Go Back" button           |
| Error (API failure)  | Toast error, keep existing content         |
| Empty (no items)     | Should not happen (validation at creation) |

**Button Visibility Logic**:

| Button             | Condition                                                                          |
| ------------------ | ---------------------------------------------------------------------------------- |
| "Register Payment" | `status = POSTED` AND `paymentTerms = UPFRONT` AND `paymentStatus != PAID_UPFRONT` |
| "Create GRN"       | `status = POSTED` (regardless of payment status)                                   |
| "Cancel Order"     | `status = POSTED` AND no GRN exists                                                |

---

### Page 3: Register Payment Modal

**Trigger**: Click "Register Payment" on PO Detail

**Wireframe**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                    [X]  │
│  Register Upfront Payment                                               │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  For: PO-2024-0042 (Supplier ABC)                                       │
│  Remaining Balance: Rp 10,000,000                                       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Bank Account *                                                   │   │
│  │ ┌─────────────────────────────────────────────────────────────┐ │   │
│  │ │ BCA - 1234567890                                        ▼   │ │   │
│  │ └─────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Amount *                                                         │   │
│  │ ┌─────────────────────────────────────────────────────────────┐ │   │
│  │ │ Rp 10,000,000                                               │ │   │
│  │ └─────────────────────────────────────────────────────────────┘ │   │
│  │ Max: Rp 10,000,000                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Payment Date *                                                   │   │
│  │ ┌─────────────────────────────────────────────────────────────┐ │   │
│  │ │ 23/12/2024                                              📅  │ │   │
│  │ └─────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Reference (Optional)                                             │   │
│  │ ┌─────────────────────────────────────────────────────────────┐ │   │
│  │ │ TRF-001                                                     │ │   │
│  │ └─────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│                                         [Cancel]  [Post Payment]        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Form Fields**:

| Field        | Type           | Required | Default           | Validation                |
| ------------ | -------------- | -------- | ----------------- | ------------------------- |
| Bank Account | Dropdown       | Yes      | First account     | Must select one           |
| Amount       | Currency Input | Yes      | Remaining balance | `0 < amount <= remaining` |
| Payment Date | Date Picker    | Yes      | Today             | Cannot be future date     |
| Reference    | Text           | No       | Empty             | Max 100 chars             |

**Component States**:

| State              | UI Behavior                                       |
| ------------------ | ------------------------------------------------- |
| Loading (accounts) | Spinner in dropdown                               |
| Submitting         | Disable all inputs, "Posting..." button text      |
| Success            | Close modal, toast "Payment recorded", refresh PO |
| Error              | Show inline error, keep modal open                |

**Validation Messages**:

| Condition          | Message                                         |
| ------------------ | ----------------------------------------------- |
| Amount empty       | "Amount is required"                            |
| Amount <= 0        | "Amount must be greater than zero"              |
| Amount > remaining | "Amount cannot exceed remaining balance (Rp X)" |
| Date empty         | "Payment date is required"                      |
| Date is future     | "Payment date cannot be in the future"          |
| Bank not selected  | "Please select a bank account"                  |

---

### Page 4: Bill Detail (dengan Prepaid Info)

**Route**: `/bills/:id`

**Wireframe (Bill with Prepaid Available)**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back                                                                 │
│                                                                         │
│  Bill #BILL-2024-0015                                                   │
│  ┌──────────────────┐  ┌──────────────────┐                            │
│  │ Status: POSTED   │  │ Balance: Rp 10M  │                            │
│  └──────────────────┘  └──────────────────┘                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 💰 PREPAID AVAILABLE FOR SETTLEMENT                              │   │
│  │                                                                   │   │
│  │ This bill is linked to PO-2024-0042 which has prepaid payment.   │   │
│  │                                                                   │   │
│  │ Prepaid Amount:      Rp 10,000,000                               │   │
│  │ Bill Amount:         Rp 10,000,000                               │   │
│  │ Settlement Amount:   Rp 10,000,000 (Full)                        │   │
│  │                                                                   │   │
│  │ [Settle Prepaid]                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Bill Details                                                           │
│  Supplier:       PT Supplier ABC                                        │
│  PO Reference:   PO-2024-0042                                           │
│  Invoice Date:   23 Dec 2024                                            │
│  Due Date:       22 Jan 2025                                            │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Settlement History                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ (No settlements yet)                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**After Settlement**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────┐  ┌──────────────────┐                            │
│  │ Status: PAID     │  │ Balance: Rp 0    │                            │
│  └──────────────────┘  └──────────────────┘                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ✓ SETTLEMENT COMPLETE                                            │   │
│  │ Prepaid has been applied to this bill.                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Settlement History                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Date       │ Type              │ Amount       │ Reference        │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ 23 Dec 24  │ Prepaid Applied   │ Rp 10,000,000│ PO-2024-0042     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Prepaid Info Banner Logic**:

| Condition                   | Banner Type      | Message                                                            |
| --------------------------- | ---------------- | ------------------------------------------------------------------ |
| Bill DRAFT, prepaid exists  | Info (Blue)      | "Prepaid available. Post bill to enable settlement."               |
| Bill POSTED, prepaid exists | Warning (Orange) | "Prepaid available for settlement" + button                        |
| Bill POSTED, prepaid < bill | Warning (Orange) | "Partial prepaid available (Rp X). Remaining will be outstanding." |
| Bill PAID/settled           | Success (Green)  | "Settlement complete"                                              |
| No prepaid                  | None             | Hide banner                                                        |

---

### Page 5: Settlement Confirmation Modal

**Trigger**: Click "Settle Prepaid" on Bill Detail

**Wireframe**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                    [X]  │
│  Confirm Prepaid Settlement                                             │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  You are about to apply prepaid payment to this bill.                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Bill:              BILL-2024-0015                                │   │
│  │ Bill Amount:       Rp 10,000,000                                 │   │
│  │ ──────────────────────────────────────────────────────────────   │   │
│  │ Prepaid Source:    PO-2024-0042                                  │   │
│  │ Prepaid Balance:   Rp 10,000,000                                 │   │
│  │ ──────────────────────────────────────────────────────────────   │   │
│  │ Settlement Amount: Rp 10,000,000                                 │   │
│  │ ──────────────────────────────────────────────────────────────   │   │
│  │ Bill After:        Rp 0 (Fully Settled)                          │   │
│  │ Prepaid After:     Rp 0                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ⚠️ This action will create a journal entry and cannot be undone.       │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│                                         [Cancel]  [Confirm Settlement]  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Partial Settlement Variant**:

```
│  │ Bill Amount:       Rp 15,000,000                                 │   │
│  │ Prepaid Balance:   Rp 10,000,000                                 │   │
│  │ ──────────────────────────────────────────────────────────────   │   │
│  │ Settlement Amount: Rp 10,000,000                                 │   │
│  │ ──────────────────────────────────────────────────────────────   │   │
│  │ Bill After:        Rp 5,000,000 (Outstanding)                    │   │
│  │ Prepaid After:     Rp 0                                          │   │
│                                                                         │
│  ⚠️ Partial settlement. Rp 5,000,000 will remain as outstanding AP.     │
```

**Component States**:

| State   | UI Behavior                                            |
| ------- | ------------------------------------------------------ |
| Loading | Disable button, show spinner                           |
| Success | Close modal, toast "Settlement complete", refresh Bill |
| Error   | Show error in modal, keep open                         |

---

### Shared Components

#### 1. Payment Status Badge

| Status             | Label            | Color  |
| ------------------ | ---------------- | ------ |
| `null` / `PENDING` | "Pending"        | Gray   |
| `PARTIAL`          | "Partially Paid" | Yellow |
| `PAID_UPFRONT`     | "Paid (Upfront)" | Green  |
| `SETTLED`          | "Settled"        | Blue   |

#### 2. Payment Term Badge

| Term      | Label     | Color  |
| --------- | --------- | ------ |
| `NET_30`  | "Net 30"  | Gray   |
| `PARTIAL` | "Partial" | Yellow |
| `UPFRONT` | "Upfront" | Orange |

#### 3. Currency Input Component

- Format: Indonesian Rupiah (Rp X.XXX.XXX)
- Validation: Positive numbers only
- Max value: Passed as prop (remaining balance)

---

### Error Messages (User-Friendly)

| Backend Error Code        | User Message                                                              |
| ------------------------- | ------------------------------------------------------------------------- |
| `PAYMENT_EXCEEDS_BALANCE` | "Payment amount cannot exceed the remaining balance"                      |
| `PO_NOT_FOUND`            | "Purchase order not found. It may have been deleted."                     |
| `PO_NOT_POSTED`           | "Cannot register payment for a draft order. Please post the order first." |
| `BILL_NOT_POSTED`         | "Cannot settle against a draft bill. Please post the bill first."         |
| `NO_PREPAID_AVAILABLE`    | "No prepaid payment found for this order."                                |
| `SETTLEMENT_FAILED`       | "Settlement failed. Please try again or contact support."                 |

---

### Responsive Design Notes

| Breakpoint          | Behavior                                      |
| ------------------- | --------------------------------------------- |
| Desktop (>1024px)   | Full layout as shown in wireframes            |
| Tablet (768-1024px) | Stack info cards, maintain table              |
| Mobile (<768px)     | Full-width cards, horizontal scroll on tables |

---

### Page: Supplier Ledger / Reconciliation (Future)

**Purpose**: Audit trail untuk clearing prepaid vs AP.

---

## Guardrails (Non-Negotiable Rules)

1. **Payment Amount Limit**: Payment MUST NOT exceed PO total amount.
2. **No Direct Inventory on Payment**: Payment DILARANG langsung debit Inventory.
3. **Traceability**: Semua clearing HARUS traceable (PO → Payment → GRN → Bill → Settlement).
4. **GRN Requires Posted PO**: GRN DILARANG dibuat tanpa PO yang sudah Posted.
5. **Settlement Atomicity**: Settlement HARUS dalam transaction yang sama dengan journal creation.

---

## Accounting Journal Summary

### Event A: Post Upfront Payment

```
Dr  1600 Advances to Supplier    xxx
Cr  1100 Cash / 1200 Bank             xxx
```

### Event B: Post GRN (Goods Received)

```
Dr  1400 Inventory               xxx
Cr  2105 GRNI Accrual                 xxx
```

### Event C: Post Bill (Supplier Invoice)

```
Dr  2105 GRNI Accrual            xxx
Cr  2100 Accounts Payable             xxx
```

### Event D: Settlement (Prepaid vs AP)

```
Dr  2100 Accounts Payable        xxx
Cr  1600 Advances to Supplier         xxx
```

---

## Constitution & Architecture Compliance _(mandatory)_

### Backend Architecture - Principles I, II, III

- [x] **4-Layer Architecture**: Router → Service → Policy → Repository.
- [x] **Schema-First**: Add `paymentTerms`, `paymentStatus` to Order schema in `packages/shared`.
- [x] **Multi-Tenant**: All queries scoped by `companyId`.
- [x] **Service Purity**: PaymentService and BillService separate; uses Repository only.
- [x] **Policy Layer**: `PurchaseOrderPolicy.ensurePaymentWithinLimit(po, amount)`.

### Frontend Architecture - Principles IV, XI

- [x] **Conditional UI**: "Register Payment" button visibility driven by backend state.
- [x] **No Business Logic**: UI only renders `paymentStatus` and `prepaidBalance` from API.
- [x] **tRPC Patterns**: Using tRPC hooks for all operations.

### Testing & Quality - Principles XV, XVII

- [x] **Integration Tests**: Full cycle test in single `it()` block.
- [x] **Journal Verification**: Each event's journal entries verified in tests.
- [x] **Financial Precision**: All amounts use `Decimal.js`.

---

## Assumptions

1. Account 1600 (Advances to Supplier) HARUS ada di seed sebelum fitur ini berjalan.
2. Settlement bisa dilakukan manual (button) atau otomatis saat Bill post (configurable).
3. Partial upfront payment supported (multiple payments until PO fully paid).
4. Refund flow untuk cancelled upfront PO is out of scope for this feature.
