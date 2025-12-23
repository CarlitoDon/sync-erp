# Feature Specification: Cash Upfront Payment (Procurement)

**Feature Branch**: `036-cash-upfront-payment`  
**Created**: 2025-12-23  
**Status**: Final  
**Version**: 2.0 - Canonical Flow

---

## One-Line Summary

> **Uang boleh keluar dulu, tapi pengakuan tetap menunggu realisasi.**

---

## Prinsip Dasar (Tidak Boleh Dilanggar)

1. **PO adalah source of truth untuk payment terms**
2. **Payment upfront = aset (prepaid), bukan biaya, bukan AP**
3. **Bill selalu mengacu ke PO + GRN, bukan ke payment**
4. **Payment dan bill hanya "bertemu" di clearing layer**
5. **Barang diterima dulu, baru boleh ditagih**

---

## 0. Preconditions

- Supplier aktif
- Item terdefinisi (INVENTORY atau SERVICE)
- COA tersedia:
  - 1100/1200 Cash / Bank
  - 1600 Prepaid / Advances to Supplier
  - 1400 Inventory
  - 2105 GRN Clearing
  - 2100 AP Trade

---

## Canonical Flow

```
PO (UPFRONT) → Pay Upfront → GRN → Bill → Auto Settlement → DONE
```

### Flow Comparison

| Step       | Normal PO (NET_30) | Upfront PO                       |
| ---------- | ------------------ | -------------------------------- |
| PO         | Create             | Create with UPFRONT terms        |
| Payment    | After Bill         | **Before** GRN (creates Prepaid) |
| GRN        | Dr Inv Cr 2105     | Dr Inv Cr 2105 (**SAME**)        |
| Bill       | Dr 2105 Cr 2100    | Dr 2105 Cr 2100 (**SAME**)       |
| Settlement | Dr AP Cr Cash      | **Auto: Dr AP Cr Prepaid**       |

---

## 1. Purchase Requisition (Opsional)

**Event**: PR Created, PR Approved

**Akuntansi**: Tidak ada

---

## 2. Purchase Order (PO)

### User Action

- Create PO
- Set:
  - `payment_terms = UPFRONT`
  - quantity, price

### State Transition

- `PO_DRAFT → PO_CONFIRMED`

### Akuntansi

- **Tidak ada journal** (PO = commitment only)

### Guardrails

- Total > 0
- Supplier valid

---

## 3. Cash Upfront Payment

### User Action

- From PO → `Register Payment`
- Select bank/cash account
- Enter amount
- Post payment

### State Transition

- `PAYMENT_DRAFT → PAYMENT_POSTED`
- PO: `payment_status = PAID_UPFRONT | PARTIAL`

### Akuntansi

```
Dr 1600 Prepaid / Advances to Supplier
   Cr 1100/1200 Cash / Bank
```

### Rules (FR-001 to FR-003)

- Payment ≤ PO total
- Payment tidak boleh menyentuh inventory / expense
- Payment tidak boleh debit inventory

---

## 4. Goods Receipt Note (GRN)

### User Action

- Create GRN from PO
- Input received quantity
- Post GRN

### State Transition

- `GRN_POSTED`
- PO: `goods_status = RECEIVED | PARTIAL`

### Akuntansi (Inventory Item)

```
Dr 1400 Inventory
   Cr 2105 GRN Clearing
```

### Notes

- **Prepaid tidak berubah** di langkah ini
- AP belum ada
- GRN journal SAMA dengan normal flow

---

## 5. Supplier Bill / Invoice

### User Action

- Create Bill from PO
- System requires: GRN exists (kecuali SERVICE)
- Post Bill

### State Transition

- `BILL_POSTED`

### Akuntansi

```
Dr 2105 GRN Clearing
   Cr 2100 AP Trade
```

### Rules (FR-004 to FR-006)

- Bill amount ≤ GRN value
- Bill tidak refer ke payment langsung
- Bill journal SAMA dengan normal flow

---

## 6. Auto Settlement (Clearing Prepaid)

### System Action

- **Trigger: Setelah Bill posted** (untuk PO dengan paymentStatus = PAID_UPFRONT)
- Hitung prepaid balance vs bill amount

### Akuntansi

```
Dr 2100 AP Trade
   Cr 1600 Prepaid / Advances
```

### Outcome (FR-007 to FR-009)

| Condition      | Result                               |
| -------------- | ------------------------------------ |
| Prepaid = Bill | AP = 0, Prepaid = 0, Bill = PAID     |
| Prepaid < Bill | AP sisa, Prepaid = 0, Bill = PARTIAL |
| Prepaid > Bill | AP = 0, Prepaid sisa, Bill = PAID    |

---

## 7. Final States

| Entity  | State          |
| ------- | -------------- |
| PO      | CLOSED         |
| Payment | CLEARED        |
| GRN     | CLOSED         |
| Bill    | PAID / PARTIAL |
| Prepaid | 0 / Remaining  |

---

## 8. UI Rules (Wajib)

### PO Page

**Fields:**

- Payment Terms dropdown (NET_30, PARTIAL, UPFRONT)
- Payment Status badge (PENDING, PARTIAL, PAID_UPFRONT, SETTLED)

**Buttons:**

- `Register Payment` → visible only if paymentTerms = UPFRONT or PARTIAL
- `Create GRN` → visible after PO confirmed

**Display:**

- Payment summary card (when paymentTerms = UPFRONT)
- Payment history table

---

### Payment Page

- No inventory / bill option (upfront payments linked to PO only)
- Fields: bank account, amount, reference
- Validation: amount ≤ remaining balance

---

### GRN Page

- Active walau prepaid sudah dibayar
- Standard GRN flow unchanged

---

### Bill Page

**Button `Create Bill`:**

- Disabled jika belum ada GRN (untuk inventory items)

**Display:**

- Prepaid balance (read-only) - jika linked PO adalah UPFRONT
- Badge "Upfront Paid" - jika PO sudah PAID_UPFRONT
- Auto-settlement result setelah Bill posted

---

## 9. Exceptions

### SERVICE Item

```
PO → Bill → Settlement
```

- Tidak ada GRN
- Bill boleh dibuat langsung dari PO

### ERS / Self Billing

```
PO → GRN → Auto Bill
```

- Tetap bill setelah GRN (out of scope for this feature)

---

## 10. Invariants (Test Assertions)

1. Payment tidak pernah debit inventory
2. Bill tidak pernah credit prepaid directly
3. Clearing selalu traceable
4. Order ID tidak bisa ditukar post-payment
5. Settlement amount = min(prepaid_balance, bill_balance)

---

## Functional Requirements Summary

### PO & Payment Terms

- **FR-001**: Support `paymentTerms` field: NET_30, PARTIAL, UPFRONT
- **FR-002**: Display Register Payment button when paymentTerms = UPFRONT or PARTIAL
- **FR-003**: No journal on PO confirm

### Upfront Payment

- **FR-004**: Payment creates `orderId` link, paymentType = UPFRONT
- **FR-005**: Validate payment.amount ≤ remaining balance
- **FR-006**: Journal: Dr 1600 Cr 1100/1200
- **FR-007**: Update PO paymentStatus

### GRN

- **FR-008**: Allow GRN regardless of payment status
- **FR-009**: Journal: Dr 1400 Cr 2105 (same as normal)

### Bill

- **FR-010**: Bill requires GRN (for inventory items)
- **FR-011**: Journal: Dr 2105 Cr 2100 (same as normal)

### Auto Settlement

- **FR-012**: Trigger auto-settlement after Bill posted for UPFRONT POs
- **FR-013**: Settlement journal: Dr 2100 Cr 1600
- **FR-014**: Update Bill status based on settlement result
- **FR-015**: Mark Payment as CLEARED

---

## Chart of Accounts

| Code | Name                 | Type      | Usage               |
| ---- | -------------------- | --------- | ------------------- |
| 1100 | Cash                 | ASSET     | Petty cash          |
| 1200 | Bank                 | ASSET     | Bank accounts       |
| 1400 | Inventory            | ASSET     | Physical stock      |
| 1600 | Advances to Supplier | ASSET     | Prepaid/UM Supplier |
| 2100 | Accounts Payable     | LIABILITY | AP Trade            |
| 2105 | GRN Clearing         | LIABILITY | GRNI Accrual        |

---

## Success Criteria

### SC-001: Payment Recorded Correctly

- Payment creates journal Dr 1600 Cr Bank
- PO paymentStatus updated

### SC-002: GRN Works Normally

- GRN journal identical to non-upfront flow
- Inventory updated

### SC-003: Bill Works Normally

- Bill journal identical to non-upfront flow
- AP created

### SC-004: Auto Settlement

- After Bill posted, system auto-creates settlement journal
- AP cleared against Prepaid
- Bill status updated

### SC-005: Final Balances

- Bank = -X (paid out)
- Inventory = +X (goods in)
- Prepaid = 0 (cleared)
- AP = 0 (settled)
- GRN Clearing = 0 (cleared by bill)
