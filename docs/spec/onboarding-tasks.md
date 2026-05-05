# Tasks: Onboarding v1

## Overview

Implement onboarding gating + company bootstrap steps + guided first transaction (Retail).

---

## Tasks

### Phase 1: Backend Foundations

- [ ] **T1.1** Add Prisma enums + fields to `Company` (`onboardingStatus`, `onboardingStep`, `onboardingCompletedAt`)
- [ ] **T1.2** Add service helpers to read/update onboarding state with precondition checks
- [ ] **T1.3** Add audit log events for onboarding lifecycle
- [ ] **T1.4** Add tRPC router:
  - `onboarding.getState`
  - `onboarding.start`
  - `onboarding.submitOpeningBalance`
  - `onboarding.runFirstTransactionRetail`
  - `onboarding.complete`
- [ ] **T1.5** Implement idempotency keys:
  - opening balance: `onboarding:${companyId}:opening-balance`
  - first transaction: `onboarding:${companyId}:first-transaction`

### Phase 2: Frontend Gating + Screens

- [ ] **T2.1** Add `/onboarding` route and onboarding layout (no sidebar)
- [ ] **T2.2** Implement global gate:
  - redirect non-onboarding routes to `/onboarding` jika company belum `ACTIVE`
- [ ] **T2.3** Implement onboarding screens v1:
  - Welcome
  - Business shape picker (reuse existing select shape flow)
  - Configuring (loading + auto-advance)
  - Opening balance
  - First transaction (Retail)
  - Alive moment
- [ ] **T2.4** Resume logic:
  - fetch `onboarding.getState`
  - render step sesuai state
  - handle `PRECONDITION_FAILED` dengan refresh state

### Phase 3: Guided First Transaction (Retail)

- [ ] **T3.1** Frontend form minimal untuk:
  - supplierName, productName, quantity, unitPrice, payNow
- [ ] **T3.2** Backend orchestration:
  - create supplier + product (idempotent)
  - purchase order create + confirm
  - GRN create + post
  - optional: bill + payment
- [ ] **T3.3** Alive moment UI membaca data nyata dari backend (stock level + journal count minimal)

### Phase 4: Tests & QA

- [ ] **T4.1** Backend integration tests:
  - happy path end-to-end onboarding retail
  - idempotency opening balance
  - idempotency first transaction
- [ ] **T4.2** Frontend routing tests:
  - gate redirect
  - resume behavior (mock state)
- [ ] **T4.3** Manual QA runbook (based on checklist)

---

## Notes

- Manufacturing/Service first transaction bisa jadi Phase 5 setelah Retail stabil.
- Identity step (role declaration) bisa jadi v1.1 jika dibutuhkan.

