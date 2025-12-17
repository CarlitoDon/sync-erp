# Phase 1: User Flows

> "User **boleh** melakukan apa, **urutan** apa, dan **kapan sistem menolak**?"

Jika flow **tidak bisa ditulis seperti ini**, berarti flow belum siap.

---

## Flow: Post Invoice

**Actor**: Finance Staff

**Preconditions**:

- Invoice status = DRAFT
- Company shape = ACTIVE
- Invoice has ≥1 item
- Stock sufficient (if stock-affecting)

**Steps**:

1. User clicks "Post Invoice"
2. Backend validates invariants
3. InvoicePostingSaga executed
4. Journal posted
5. Stock reduced
6. Status set to POSTED

**System Guards**:

- PENDING company blocked
- Parallel post blocked
- Idempotent by invoiceId

**Failure States**:

- Insufficient stock → rejected
- Journal failure → compensated

**Resulting State**:

- Invoice POSTED
- Stock reduced
- Journal balanced

---

## Flow: Post Bill

**Actor**: Finance Staff

**Preconditions**:

- Bill status = DRAFT
- Company shape = ACTIVE
- Bill has ≥1 item

**Steps**:

1. User clicks "Post Bill"
2. Backend validates invariants
3. BillPostingSaga executed
4. Journal posted
5. Stock increased
6. Status set to POSTED

**System Guards**:

- PENDING company blocked
- Parallel post blocked
- Idempotent by billId

**Failure States**:

- Journal failure → compensated

**Resulting State**:

- Bill POSTED
- Stock increased
- Journal balanced

---

## Flow: Record Payment (Invoice)

**Actor**: Finance Staff

**Preconditions**:

- Invoice status = POSTED
- Invoice balance > 0
- Payment amount ≤ remaining balance

**Steps**:

1. User enters payment amount + method
2. Backend validates amount
3. PaymentSaga executed
4. Payment recorded
5. Invoice balance updated
6. Journal posted

**System Guards**:

- Overpayment rejected
- Idempotent by invoiceId + paymentId
- Parallel payment blocked

**Failure States**:

- Overpayment → 409 rejected
- Journal failure → compensated

**Resulting State**:

- Payment recorded
- Invoice balance reduced
- Invoice PAID if balance == 0

---

## Flow: Record Payment (Bill)

**Actor**: Finance Staff

**Preconditions**:

- Bill status = POSTED
- Bill balance > 0
- Payment amount ≤ remaining balance

**Steps**:

1. User enters payment amount + method
2. Backend validates amount
3. PaymentSaga executed
4. Payment recorded
5. Bill balance updated
6. Journal posted

**System Guards**:

- Overpayment rejected
- Idempotent by billId + paymentId
- Parallel payment blocked

**Failure States**:

- Overpayment → 409 rejected
- Journal failure → compensated

**Resulting State**:

- Payment recorded
- Bill balance reduced
- Bill PAID if balance == 0

---

## Flow: Create Sales Order

**Actor**: Sales Staff

**Preconditions**:

- Company shape = ACTIVE
- Partner exists (CUSTOMER)
- Products exist

**Steps**:

1. User selects partner
2. User adds line items
3. User submits order
4. Backend validates
5. Order created as DRAFT

**System Guards**:

- Partner must be CUSTOMER type
- Product must exist
- Quantity must be positive

**Failure States**:

- Invalid partner → rejected
- Invalid product → rejected

**Resulting State**:

- Sales Order DRAFT

---

## Flow: Create Purchase Order

**Actor**: Procurement Staff

**Preconditions**:

- Company shape = ACTIVE
- Partner exists (SUPPLIER)
- Products exist

**Steps**:

1. User selects partner
2. User adds line items
3. User submits order
4. Backend validates
5. Order created as DRAFT

**System Guards**:

- Partner must be SUPPLIER type
- Product must exist
- Quantity must be positive

**Failure States**:

- Invalid partner → rejected
- Invalid product → rejected

**Resulting State**:

- Purchase Order DRAFT

---

## Flow: Stock Adjustment

**Actor**: Inventory Staff

**Preconditions**:

- Company shape = ACTIVE
- Product exists
- Warehouse exists

**Steps**:

1. User selects product + warehouse
2. User enters adjustment qty + reason
3. Backend validates
4. Stock movement recorded
5. Journal posted (if configured)

**System Guards**:

- Negative result qty requires explicit policy
- Idempotent by adjustmentId

**Failure States**:

- Insufficient stock (if policy enforced) → rejected

**Resulting State**:

- Stock adjusted
- Movement recorded

---

_Document required before Phase 1 work proceeds._
