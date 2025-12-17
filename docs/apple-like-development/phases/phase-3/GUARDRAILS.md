# Phase 3: Guardrails

**Non-Negotiable Rules for Accounting Phase**

## 1. Double Entry Enforcement

### 1.1 Balance Required

- Tidak ada journal tanpa balance
- `sum(debit) == sum(credit)` always

### 1.2 Source Reference

- Tidak ada posting tanpa source reference
- Every journal traceable to origin

---

## 2. Immutability Direction

### 2.1 State Transitions

- Draft → Mutable
- Posted → Immutable
- Adjustment → New entry, bukan edit

### 2.2 Period Locking

- Closed period = no changes allowed
- Reversal only via new entry

---

## 3. Closing Rules

### 3.1 Pre-Closing Checks

- All journals balanced
- All pending items resolved
- Reconciliation complete

### 3.2 Post-Closing

- Period locked
- No backdated entries
- Audit trail sealed

---

## 4. Export & Audit

### 4.1 Data Integrity

- Export matches DB exactly
- No transformation that loses data

### 4.2 Audit Ready

- Trail complete
- Timestamps accurate
- User attribution clear
