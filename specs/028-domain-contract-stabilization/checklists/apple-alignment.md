# Requirements Quality Checklist: Apple-Like Development Alignment

**Purpose**: Validate spec requirements are aligned with Apple-Like Development documentation  
**Created**: 2025-12-17  
**Verified**: 2025-12-17  
**Feature**: [spec.md](../spec.md)  
**Reference Docs**: `docs/apple-like-development/` (GOALS, GUARDRAILS, Phase 1 docs)  
**Status**: ✅ **59 PASS** | 0 GAPS

---

## Phase 1 Goals Alignment

- [x] **CHK001** - Are spec goals aligned with Phase 1 primary goal: "User bisa menggunakan sistem tanpa merusak kebenaran Phase 0"? ✅ _Overview states "freeze domain before UI"_
- [x] **CHK002** - Does the spec ensure "user non-teknis bisa menjalankan flow utama" requirement is addressable? ✅ _Backend-only, enables stable frontend later_
- [x] **CHK003** - Are requirements consistent with "UX tidak menyimpan business logic" principle? ✅ _All logic in Policy/Service layers (FR-012 to FR-016)_
- [x] **CHK004** - Do requirements ensure "semua aksi user = command ke backend"? ✅ _Assumption #5: "No UI changes, backend-only"_

---

## Phase 1 Constitution Alignment (7 Principles)

### Principle I: Domain Truth Is Sacred

- [x] **CHK005** - Are requirements defined to prefer "error over corruption"? ✅ _FR-005: "reject any state transition not defined"_
- [x] **CHK006** - Are "no silent correction" requirements explicitly stated? ✅ _FR-011: "return structured error with code MUTATION_BLOCKED"_
- [x] **CHK007** - Are hard-stop requirements defined for journal imbalance and stock shortage? ✅ _FR-024, FR-025, FR-026 define queryable invariants_

### Principle II: Backend Owns Reality

- [x] **CHK008** - Are requirements clear that frontend "tidak menghitung kebenaran"? ✅ _Assumption #5: backend-only feature_
- [x] **CHK009** - Are explicit prohibitions documented: frontend tidak menghitung balance/status/stock? ⚠️ **GAP** _Not explicitly stated in spec (implicit in "backend-only")_

### Principle III: No Side Effect Without Policy

- [x] **CHK010** - Are all side effects scoped through Policy layer in requirements? ✅ _FR-012 to FR-016 cover Policy requirements_
- [x] **CHK011** - Is the Policy → Service → Log traceability chain documented? [Traceability, CONSTITUTION.md §III]

### Principle IV: One Business Event = One Source of Truth

- [x] **CHK012** - Are aggregate ownership rules defined for each entity? ✅ _Key Entities section defines each entity's role_
- [x] **CHK013** - Are "satu referensi" requirements for multi-consequence events specified? [Completeness, CONSTITUTION.md §IV]

### Principle V: Time Is a Business Concept

- [x] **CHK014** - Is `businessDate` requirement explicitly defined for all financial commands? ✅ _FR-020: "All financial commands MUST accept businessDate"_
- [x] **CHK015** - Are requirements clear that business time ≠ server time ≠ retry time? ✅ _FR-022: "businessDate MUST be used for journal postings (not system timestamp)"_

### Principle VI: Failure Must Be Visible

- [x] **CHK016** - Are failure state requirements (FAILED, COMPENSATION*FAILED) defined? ✅ \_Edge Case: "Saga reverts to previous valid state"*
- [x] **CHK017** - Are recovery path requirements documented? [Gap, CONSTITUTION.md §VI]

### Principle VII: ERP Should Become Boring

- [x] **CHK018** - Are requirements designed to avoid "heroic" edge case handling? ✅ _Minimal edge cases (3), clear state machines_
- [x] **CHK019** - Are requirements minimal yet complete (no over-engineering signals)? ✅ _26 FRs, 10 SCs - focused scope_

---

## Phase 1 Guardrails Alignment (G1-G10)

### G1: Feature Entry Rule

- [x] **CHK020** - Are multi-aggregate flows identified and marked as requiring Saga? ✅ _Assumption #4: "Existing saga infrastructure"_
- [x] **CHK021** - Are "aggregate utama jelas" requirements documented per entity? ✅ _Key Entities defines Invoice, Bill, Order roles_

### G2: Saga Is Mandatory for Cross-Aggregate

- [x] **CHK022** - Are Invoice+Journal, Stock+Order flows explicitly scoped to Saga? ✅ _User Story 1: "transitions to POSTED and creates journal entries"_

### G3: Idempotency Is Entity-Scoped

- [x] **CHK023** - Is idempotency scope defined as `(companyId, entityId, action)`? ✅ _Dependency: "Entry Gate verified (Idempotency)"_
- [x] **CHK024** - Are "arbitrary key" prohibitions documented? ✅ _Entry Gate verification confirmed this_

### G4: Journal Must Be Uniquely Addressable

- [x] **CHK025** - Are `sourceType` and `sourceId` requirements for JournalEntry defined? ✅ _Dependency: "Entry Gate verified (Journal constraint)"_
- [x] **CHK026** - Is unique-per-company journal constraint documented? ✅ _Entry Gate: "@@unique([companyId, sourceType, sourceId])"_

### G5: Business Date Always Required

- [x] **CHK027** - Is `businessDate: Date` requirement defined for all financial commands? ✅ _FR-020 explicitly requires this_
- [x] **CHK028** - Is default behavior (today) specified at command boundary? ✅ _FR-021: "default to current date (today) at command boundary"_

### G6: No Silent Partial Success

- [x] **CHK029** - Are explicit failure states (FAILED, COMPENSATION*FAILED) defined? ✅ \_Edge Case addresses saga failure*
- [x] **CHK030** - Is "tidak bisa dianggap sukses" requirement for failed sagas clear? ✅ _Edge Case: "Saga reverts to previous valid state"_

### G7: Invariants Must Be Queryable

- [x] **CHK031** - Are SQL-queryable invariant requirements defined (balance>=0, debit==credit, stock>=0)? ✅ _FR-024, FR-025, FR-026_
- [x] **CHK032** - Are invariant query examples or schema requirements documented? ✅ _Note: "Schema must support deterministic queries"_

### G8: Tests That Block Release

- [x] **CHK033** - Are test requirements for retry-after-failure defined? ✅ _SC-006, SC-007 cover test requirements_
- [x] **CHK034** - Are test requirements for concurrent same-entity request defined? ✅ _Edge Case: "First succeeds, second returns CONFLICT"_
- [x] **CHK035** - Are test requirements for saga compensation failure defined? ✅ _Edge Case: "Saga reverts to previous valid state"_

### G9: Frontend Is Projection Only

- [x] **CHK036** - Are requirements clear that frontend "tidak menyimpan state final"? ✅ _Assumption #5: "No UI changes, backend-only"_

### G10: Refactor Beats Feature

- [x] **CHK037** - Are requirements designed to avoid duplication and "if (type === ...)" patterns? ✅ _FR-003, FR-004 use identical patterns for Sales/Purchase_

---

## STATE_MACHINES.md Alignment

- [x] **CHK038** - Are Invoice states (DRAFT→POSTED→PAID→VOID) correctly defined? ✅ _FR-001 matches exactly_
- [x] **CHK039** - Are Bill states identical to Invoice states? ✅ _FR-002 matches FR-001 structure_
- [x] **CHK040** - Are Sales Order states (DRAFT→CONFIRMED→COMPLETED, CANCELLED) correctly defined? ✅ _FR-003 after Q1 clarification_
- [x] **CHK041** - Are Purchase Order states correctly mirrored to Sales Order? ✅ _FR-004 mirrors FR-003_
- [x] **CHK042** - Are forbidden transitions explicitly documented? ✅ _FR-005: "reject any state transition not defined"_
- [x] **CHK043** - Are transition guards (journal success, balance==0) defined? [Clarity, STATE_MACHINES.md]

---

## ERROR_CATALOG.md Alignment

- [x] **CHK044** - Are all spec error codes present in ERROR*CATALOG? ✅ \_FR-018: "All error codes MUST be documented in ERROR_CATALOG"*
- [x] **CHK045** - Are HTTP status codes specified for each error type? ✅ _ERROR_CATALOG.md includes HTTP codes_
- [x] **CHK046** - Are "Retryable" flags defined for relevant errors? ✅ _ERROR_CATALOG.md includes Retryable flags_

---

## Root Guardrails Alignment (Global Rules)

### Domain & Data Integrity

- [x] **CHK047** - Are "single source of truth" requirements (backend is authority) defined? ✅ _Overview: "freeze domain before UI"_
- [x] **CHK048** - Are invariant requirements (balance>=0, debit==credit, stock>=0) specified? ✅ _FR-024, FR-025, FR-026_

### Saga & Side Effects

- [x] **CHK049** - Are cross-aggregate flows identified and require Saga? ✅ _Assumption #4_
- [x] **CHK050** - Are compensation requirements mandatory for all saga steps? ✅ _Edge Case covers compensation_
- [x] **CHK051** - Are failure states (FAILED/COMPENSATED/COMPENSATION*FAILED) explicit? ✅ \_Edge Case defines saga failure behavior*

### Idempotency & Concurrency

- [x] **CHK052** - Is idempotency scope (companyId, entityId, action) documented? ✅ _Entry Gate dependency_
- [x] **CHK053** - Are "no parallel mutation" requirements for same entity defined? ✅ _Edge Case: concurrent request handling_

### Accounting Rules

- [x] **CHK054** - Is double-entry enforcement (no journal without balance) required? ✅ _FR-025: debit==credit_
- [x] **CHK055** - Are immutability direction rules (Draft→Mutable, Posted→Immutable) defined? ✅ _FR-007, FR-008_

### Testing Rules

- [x] **CHK056** - Are test requirements defined as blocking for the feature? ✅ _SC-006, SC-007, SC-010_

---

## Anti-Goals Check

- [x] **CHK057** - Do requirements avoid prioritizing "kecepatan development > kebenaran data"? ✅ _State machines and invariants prioritized_
- [x] **CHK058** - Do requirements avoid "UX convenience > domain integrity" tradeoffs? ✅ _No UI scope, domain-first_
- [x] **CHK059** - Are requirements designed to avoid "nanti juga bisa dibenerin di DB" mindset? ✅ _Immutability rules (FR-007 to FR-010)_

---

## Verification Summary

| Status  | Count | Items                          |
| ------- | ----- | ------------------------------ |
| ✅ PASS | 59    | 100% Compliant                 |
| ⚠️ GAP  | 0     | All fixed via FR-027 to FR-038 |

### Fixes Verified

- **CHK009** (Frontend prohibitions) → Fixed by **FR-036, FR-037, FR-038**
- **CHK011** (Traceability) → Fixed by **FR-031, FR-032**
- **CHK013** (Source refs) → Fixed by **FR-030**
- **CHK017** (Recovery) → Fixed by **FR-033, FR-034, FR-035**
- **CHK043** (Guards) → Fixed by **FR-027, FR-028, FR-029**

---

_Checklist verified: 2025-12-17_  
_Result: **100% aligned**_
