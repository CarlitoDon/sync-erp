# Apple-Like Development Compliance Checklist

**Purpose**: Validate spec requirements against Phase 1 Constitution and Guardrails  
**Created**: 2025-12-17  
**Feature**: [spec.md](../spec.md)  
**Reference Documents**:

- [Phase 1 Constitution](file:///Users/wecik/Documents/Offline/sync-erp/docs/apple-like-development/phases/phase-1/foundation/CONSTITUTION.md)
- [Phase 1 Guardrails](file:///Users/wecik/Documents/Offline/sync-erp/docs/apple-like-development/phases/phase-1/foundation/GUARDRAILS.md)
- [Engineering Guardrails](file:///Users/wecik/Documents/Offline/sync-erp/docs/apple-like-development/GUARDRAILS.md)

---

## I. Domain Truth Is Sacred (Constitution I)

- [x] CHK001 - Are error requirements prioritized over silent corrections? [Completeness, Spec FR-006]
  - Spec states payment amount validation must block exceeding balance
- [x] CHK002 - Are hard-stop requirements defined for domain violations? [Clarity, Spec Edge Cases]
  - Edge cases explicitly state "Validation blocks with clear error message"
- [x] CHK003 - Is the principle "Error > Corruption" explicitly stated in requirements? [Completeness]
  - **FIXED**: Added Core Principles section with explicit "Error > Corruption" statement

---

## II. Backend Owns Reality (Constitution II)

- [x] CHK004 - Are frontend calculation prohibitions explicitly stated? [Completeness]
  - Spec Assumptions states "Backend APIs for Invoice, Payment, PO, and GRN already exist and are saga-protected"
- [x] CHK005 - Are KPIs defined as read-only projections from backend? [Clarity, Spec FR-001]
  - FR-001 explicitly states "read-only KPIs"
- [x] CHK006 - Is there explicit prohibition against frontend determining invoice PAID status? [Completeness]
  - **FIXED**: Added FR-017 "Frontend MUST NOT calculate or determine final entity status"
- [x] CHK007 - Are all user actions defined as "commands to backend" not "state changes"? [Consistency]
  - Payment Modal, Receive Goods all send commands to backend

---

## III. No Side Effect Without Policy (Constitution III)

- [x] CHK008 - Are Policy layer requirements defined for each side effect? [Completeness]
  - **FIXED**: Added Core Principle "No Side Effect Without Policy"
- [x] CHK009 - Are side effects (payment, goods receipt) documented as backend-executed? [Completeness, Spec US2, US3]
  - All side effects go through backend

---

## IV. Saga Requirements (Guardrails G1, G2)

- [x] CHK010 - Are cross-aggregate operations (Payment, GRN) acknowledged as Saga-protected? [Completeness, Spec Assumptions]
  - Assumptions states "Backend APIs... are saga-protected"
- [x] CHK011 - Are concurrent request scenarios addressed? [Coverage, Spec Edge Cases]
  - Edge case states "Saga row lock prevents double-payment"
- [x] CHK012 - Are failure/compensation states visible in UI requirements? [Completeness]
  - **FIXED**: Added US4 scenario #5 and FR-018 for visible failure indication

---

## V. Idempotency Scope (Guardrails G3)

- [x] CHK013 - Is idempotency handling requirement explicitly defined for UI actions? [Completeness]
  - **FIXED**: Added FR-006a, FR-009a, FR-019 for button disable during in-flight
- [x] CHK014 - Are retry scenarios defined for payment/GRN operations? [Coverage, Edge Case]
  - **FIXED**: Added edge case for double-click and button disabled during request

---

## VI. Business Date (Guardrails G5)

- [x] CHK015 - Is businessDate requirement explicit for Payment recording? [Completeness, Spec FR-005a]
  - **FIXED**: Added FR-005a "Payment Modal MUST include businessDate field"
- [x] CHK016 - Is businessDate requirement explicit for Goods Receipt? [Completeness, Spec FR-008a]
  - **FIXED**: Added FR-008a "Receive Goods screen MUST include businessDate field"

---

## VII. UI Guardrails - Irreversible Actions (Guardrails G6, Spec US4)

- [x] CHK017 - Are confirmation modal requirements defined for Post action? [Completeness, Spec US4]
  - Explicit confirmation modal with "This action cannot be undone"
- [x] CHK018 - Are confirmation modal requirements defined for Void action? [Completeness, Spec US4]
  - Red warning styling specified
- [x] CHK019 - Is disabled state requirement defined for action buttons? [Completeness, Spec FR-010]
  - FR-010 explicitly requires button disabling

---

## VIII. Frontend Is Projection Only (Guardrails G9)

- [x] CHK020 - Is dashboard data explicitly defined as backend-fetched, not calculated? [Consistency, Spec FR-002]
  - FR-002 states "Dashboard MUST refresh data on page load (no auto-refresh)"
- [x] CHK021 - Are all list views defined as server-rendered data projections? [Consistency, Spec FR-003, FR-007]
  - Invoice List and PO List fetch from backend

---

## IX. Observability - Failure Visibility (Constitution VI)

- [x] CHK022 - Are saga failure visibility requirements defined? [Completeness, Spec FR-014]
  - FR-014 states "System MUST display list of failed sagas"
- [x] CHK023 - Is compensation status distinguishable in requirements? [Clarity, Spec FR-015]
  - FR-015 distinguishes "compensated vs compensation-failed"
- [x] CHK024 - Are orphan journal detection requirements defined? [Completeness, Spec FR-016]
  - FR-016 addresses journals with missing source references

---

## X. Constitution Compliance Checklist Inclusion

- [x] CHK025 - Is Constitution Part A (Technical) checklist included in spec? [Completeness]
  - Spec includes full Technical Architecture Checklist
- [x] CHK026 - Is Constitution Part B (Human Experience) checklist included in spec? [Completeness]
  - Spec includes full Human Experience Checklist

---

## Summary

| Section                       | Pass   | Fail/Gap | Total  |
| ----------------------------- | ------ | -------- | ------ |
| Domain Truth                  | 3      | 0        | 3      |
| Backend Owns Reality          | 4      | 0        | 4      |
| No Side Effect Without Policy | 2      | 0        | 2      |
| Saga Requirements             | 3      | 0        | 3      |
| Idempotency Scope             | 2      | 0        | 2      |
| Business Date                 | 2      | 0        | 2      |
| UI Guardrails                 | 3      | 0        | 3      |
| Frontend Projection           | 2      | 0        | 2      |
| Observability                 | 3      | 0        | 3      |
| Constitution Checklist        | 2      | 0        | 2      |
| **TOTAL**                     | **26** | **0**    | **26** |

**Compliance Rate**: 100% (26/26)

---

## Update Log

**2025-12-17**: All gaps addressed. Spec updated with:

- Core Principles section (Error > Corruption, Backend Owns Reality, etc.)
- FR-005a, FR-008a: businessDate fields
- FR-006a, FR-009a, FR-019: Button disable during in-flight
- FR-017: Frontend calculation prohibition
- FR-018: Visible error requirement
- US2/US3/US4: Additional acceptance scenarios for retry and failure
