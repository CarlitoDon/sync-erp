# Sync ERP: Design System & Consistency Manifesto

> "Design is not just what it looks like and feels like. Design is how it works." — Steve Jobs

---

## The Problem: Case A1

Today we encountered **Case A1**: The "Record Payment" modal looked different between List views and Detail views. Same action, different UI. This is unacceptable.

**Why did this happen?**

1. **No shared component** — The payment form was duplicated across 4 files
2. **Copy-paste development** — Each file evolved independently
3. **No design token enforcement** — Styling decisions were made ad-hoc

This document establishes patterns to prevent such inconsistencies forever.

---

## Part 1: The Component Hierarchy Principle

### Rule: Extract shared UI into reusable components

When the **same action** appears in multiple places, it MUST use the **same component**.

```
apps/web/src/components/
├── ui/                     # Primitive components (Button, Modal, Input)
│   ├── FormModal.tsx
│   ├── ActionButton.tsx
│   └── ConfirmModal.tsx
├── shared/                 # Business-aware shared components (NEW)
│   ├── RecordPaymentModal.tsx    ← Extract this!
│   ├── PaymentHistoryModal.tsx
│   └── OrderStatusBadge.tsx
```

### Why?

When you change the payment form, you change it **once**. Every screen updates automatically.

### Implementation Pattern for RecordPaymentModal

```tsx
// components/shared/RecordPaymentModal.tsx
interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  document: {
    id: string;
    documentNumber: string;
    partnerName: string;
    totalAmount: number;
    balance: number;
    dueDate: Date | string;
    type: 'INVOICE' | 'BILL';
  };
}

export const RecordPaymentModal = ({
  isOpen,
  onClose,
  onSuccess,
  document,
}: RecordPaymentModalProps) => {
  // All payment logic centralized here
};
```

Now `BillList`, `BillDetail`, `InvoiceList`, `InvoiceDetail` all use:

```tsx
<RecordPaymentModal
  isOpen={showPayment}
  onClose={() => setShowPayment(false)}
  onSuccess={loadData}
  document={{
    id: bill.id,
    documentNumber: bill.invoiceNumber,
    partnerName: bill.partner?.name || '-',
    totalAmount: Number(bill.amount),
    balance: Number(bill.balance),
    dueDate: bill.dueDate,
    type: 'BILL',
  }}
/>
```

---

## Part 2: The Module Parity Principle

### Rule: Mirror modules MUST have identical UX

| Sales Module       | Procurement Module    |
| ------------------ | --------------------- |
| `SalesOrderList`   | `PurchaseOrderList`   |
| `SalesOrderDetail` | `PurchaseOrderDetail` |
| `CustomerDetail`   | `SupplierDetail`      |
| `InvoiceList`      | `BillList`            |
| `InvoiceDetail`    | `BillDetail`          |

### Why?

Users learn patterns, not screens. If "Record Payment" works one way on invoices, it MUST work identically on bills.

### Enforcement

Before implementing a feature in Module A, ask:

1. Does Module B have an equivalent?
2. If yes, implement both simultaneously
3. Use shared components to guarantee parity

---

## Part 3: The Action Pattern Library

Every user action falls into categories. Each category has ONE way to be implemented.

### Status Change Actions

| Action Type      | Component      | Variant     | Example               |
| ---------------- | -------------- | ----------- | --------------------- |
| Confirm/Approve  | `ActionButton` | `primary`   | Confirm Order, Post   |
| Cancel/Void      | `ActionButton` | `danger`    | Cancel Order, Void    |
| Complete/Success | `ActionButton` | `success`   | Ship, Record Payment  |
| View/Navigate    | `ActionButton` | `secondary` | View Invoice, History |

### Modal Actions

| Scenario                   | Modal Type     | Design                           |
| -------------------------- | -------------- | -------------------------------- |
| Destructive confirmation   | `ConfirmModal` | Red button, warning message      |
| Data entry (single entity) | `FormModal`    | Info header + form + actions     |
| List/History view          | `FormModal`    | Table or list, close button only |

### Data Entry Modal Structure (ALWAYS)

```
┌─────────────────────────────────────────┐
│  Modal Title                       [X]  │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │  Context Info Block (gray bg)  │    │  ← REQUIRED: What are we editing?
│  │  - Key field 1: Value          │    │
│  │  - Key field 2: Value          │    │
│  │  - Important value (bold/red)  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Form Field 1 *                         │  ← Form fields
│  [________________________]             │
│                                         │
│  Form Field 2                           │
│  [________________________]             │
│                                         │
├─────────────────────────────────────────┤
│               [Cancel]  [Confirm Action]│  ← ALWAYS: Cancel left, Primary right
└─────────────────────────────────────────┘
```

---

## Part 4: The Design Token System

### Color Semantics (NEVER deviate)

| Purpose        | Color Class      | Usage                        |
| -------------- | ---------------- | ---------------------------- |
| Primary action | `bg-blue-600`    | Confirm, Submit, Save        |
| Success action | `bg-green-600`   | Complete, Paid, Record       |
| Danger action  | `bg-red-600`     | Delete, Void, Cancel         |
| Warning state  | `text-amber-600` | Pending, Overdue soon        |
| Danger state   | `text-red-600`   | Overdue, Outstanding balance |
| Neutral        | `bg-gray-100`    | Cancel button, Secondary     |

### Badge/Status Colors

| Status    | Background     | Text             |
| --------- | -------------- | ---------------- |
| DRAFT     | `bg-gray-100`  | `text-gray-800`  |
| CONFIRMED | `bg-blue-100`  | `text-blue-800`  |
| POSTED    | `bg-blue-100`  | `text-blue-800`  |
| COMPLETED | `bg-green-100` | `text-green-800` |
| PAID      | `bg-green-100` | `text-green-800` |
| CANCELLED | `bg-red-100`   | `text-red-800`   |
| VOID      | `bg-red-100`   | `text-red-800`   |

---

## Part 5: The Checklist Before Implementation

Before writing ANY new UI, answer these questions:

### 1. Component Reuse

- [ ] Does this UI pattern already exist elsewhere?
- [ ] If yes, can I extract a shared component?
- [ ] If not, should I create one for future reuse?

### 2. Module Parity

- [ ] Does this feature have a mirror in another module?
- [ ] Am I implementing both simultaneously?
- [ ] Am I using the same component for both?

### 3. Action Consistency

- [ ] Does this action type exist elsewhere?
- [ ] Am I using the correct button variant?
- [ ] Am I following the modal structure pattern?

### 4. Token Compliance

- [ ] Am I using semantic color classes, not arbitrary colors?
- [ ] Does the status badge use the standard color mapping?

---

## Part 6: File Organization for Shared Components

### Current State (Problematic)

```
features/
├── finance/
│   ├── components/
│   │   ├── BillList.tsx          ← Has payment form inline
│   │   ├── InvoiceList.tsx       ← Has payment form inline (duplicate)
│   │   └── PaymentHistoryList.tsx
│   └── pages/
│       ├── BillDetail.tsx        ← Has payment form inline (duplicate)
│       └── InvoiceDetail.tsx     ← Has payment form inline (duplicate)
```

### Target State (Consistent)

```
components/
├── ui/                            # Primitives
│   ├── FormModal.tsx
│   ├── ActionButton.tsx
│   └── ConfirmModal.tsx
├── shared/                        # Business components
│   ├── RecordPaymentModal.tsx     ← Extracted, used by all 4 files
│   ├── PaymentHistoryModal.tsx
│   ├── OrderStatusBadge.tsx
│   └── DocumentInfoHeader.tsx

features/
├── finance/
│   ├── components/
│   │   ├── BillList.tsx          ← Uses <RecordPaymentModal />
│   │   └── InvoiceList.tsx       ← Uses <RecordPaymentModal />
│   └── pages/
│       ├── BillDetail.tsx        ← Uses <RecordPaymentModal />
│       └── InvoiceDetail.tsx     ← Uses <RecordPaymentModal />
```

---

## Part 7: The Steve Jobs Test

Before shipping any feature, ask:

> "If Steve Jobs reviewed this, would he approve?"

### The Criteria

1. **Obsessive Consistency** — Does this look and behave exactly like its siblings?
2. **Simplicity** — Can we remove anything without losing meaning?
3. **Delight** — Does the interaction feel polished and intentional?
4. **Defensibility** — Can we explain WHY every design decision was made?

If the answer to any of these is "no," go back and fix it.

---

## Immediate Action Items

1. **Extract `RecordPaymentModal`** to `components/shared/`
2. **Refactor all 4 files** to use the shared component
3. **Extract `DocumentInfoHeader`** for reuse in modals
4. **Create `StatusBadge`** component with centralized color mapping
5. **Update Constitution** with UI Consistency Principle

---

## Summary

| Problem                   | Solution                                     |
| ------------------------- | -------------------------------------------- |
| Duplicate UI code         | Extract shared components                    |
| Inconsistent styling      | Design token system + centralized components |
| Forgetting mirror modules | Parity checklist before implementation       |
| Ad-hoc design decisions   | Action Pattern Library reference             |

**The goal is simple: Write it once, use it everywhere, change it once.**

---

_This document is a living reference. Update it when new patterns emerge._
