# Phase 1: State Machines

Mencegah **state explosion** dan illegal transitions.

**Rule keras**: Jika transition tidak ada di dokumen ini → **bug**, bukan feature.

---

## Invoice State Machine

**States**:

- `DRAFT` — Editable, not posted
- `POSTED` — Immutable, affects stock + journal
- `PAID` — Fully paid (balance = 0)
- `VOID` — Cancelled (if allowed)

**Allowed Transitions**:

```
DRAFT → POSTED    (via InvoicePostingSaga)
POSTED → PAID     (when balance == 0)
POSTED → VOID     (void flow, if enabled)
```

**Forbidden**:

- `PAID → POSTED`
- `VOID → any`
- `DRAFT → PAID` (must go through POSTED)

**Guards**:

- `POSTED` requires journal success
- `PAID` requires balance == 0
- `VOID` requires compensation success

---

## Bill State Machine

**States**:

- `DRAFT` — Editable, not posted
- `POSTED` — Immutable, affects stock + journal
- `PAID` — Fully paid (balance = 0)
- `VOID` — Cancelled (if allowed)

**Allowed Transitions**:

```
DRAFT → POSTED    (via BillPostingSaga)
POSTED → PAID     (when balance == 0)
POSTED → VOID     (void flow, if enabled)
```

**Forbidden**:

- `PAID → POSTED`
- `VOID → any`
- `DRAFT → PAID`

**Guards**:

- `POSTED` requires journal success
- `PAID` requires balance == 0

---

## Payment State Machine

**States**:

- `RECORDED` — Payment applied
- `CANCELLED` — Payment reversed

**Allowed Transitions**:

```
RECORDED → CANCELLED    (reversal flow)
```

**Forbidden**:

- `CANCELLED → RECORDED`

**Guards**:

- `CANCELLED` requires reversal journal

---

## Sales Order State Machine

**States**:

- `DRAFT` — Editable
- `CONFIRMED` — Locked for fulfillment
- `COMPLETED` — Fully invoiced
- `CANCELLED` — Order cancelled

**Allowed Transitions**:

```
DRAFT → CONFIRMED
DRAFT → CANCELLED
CONFIRMED → COMPLETED
CONFIRMED → CANCELLED
```

**Forbidden**:

- `COMPLETED → any`
- `CANCELLED → any`

---

## Purchase Order State Machine

**States**:

- `DRAFT` — Editable
- `CONFIRMED` — Locked for receiving
- `COMPLETED` — Fully received
- `CANCELLED` — Order cancelled

**Allowed Transitions**:

```
DRAFT → CONFIRMED
DRAFT → CANCELLED
CONFIRMED → COMPLETED
CONFIRMED → CANCELLED
```

**Forbidden**:

- `COMPLETED → any`
- `CANCELLED → any`

---

## Stock Movement State Machine

**States**:

- `RECORDED` — Movement applied

**Notes**:

- Stock movements are immutable once recorded
- Corrections via new adjustment movement

---

## Journal Entry State Machine

**States**:

- `DRAFT` — Editable (manual journals only)
- `POSTED` — Immutable

**Allowed Transitions**:

```
DRAFT → POSTED    (manual posting)
```

**Forbidden**:

- `POSTED → DRAFT`
- `POSTED → deleted`

**Guards**:

- `POSTED` requires debit == credit
- System journals are auto-posted (never DRAFT)

---

_Document required before Phase 1 work proceeds._
