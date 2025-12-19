# Research: Procure-to-Pay (P2P) Flow

**Branch**: `035-procure-to-pay-p2p` | **Date**: 2025-12-19
**Spec**: [spec.md](../spec.md)

## Decision Log

### 1. Document Numbering Strategy (FR-030 to FR-034)

- **Decision**: Use database-level sequence table or separate specialized table (e.g., `DocumentSequence`) for guaranteed sequentiality and month-reset support.
- **Rationale**:
  - Requirements mandate `YYYYMM-NNNNN` format with monthly reset.
  - Standard auto-increment PKs don't support resets or formatting.
  - Concurrent creation (FR-027) requires atomic sequence generation to avoid duplicates.
- **Alternatives Considered**:
  - _Max(ID) + 1_: Prone to race conditions and gaps on rollback.
  - _Redis counter_: Adds infrastructure complexity.
  - _UUID_: Doesn't meet human-readable requirement.

### 2. State Machine Implementation (FR-035 to FR-038)

- **Decision**: Explicit state machine logic in Service layer (within `rules/` or private service methods) using rigid transition table.
- **Rationale**:
  - Transitions are complex (e.g., received -> partial/full, voiding logic).
  - Invalid transitions (e.g., Draft -> Paid) must be strictly blocked (Constitution IX).
  - Centralized definition prevents bugs scattered across controllers/services.
- **Alternatives Considered**:
  - _Ad-hoc checks_: Hard to maintain and visualize.
  - _State Pattern (Classes)_: Overkill for current complexity.

### 3. Financial Calculations & Precision (FR-039 to FR-042)

- **Decision**: Use `Decimal.js` for all monetary and quantity calculations. Store as `Decimal` in Prisma/DB.
- **Rationale**:
  - Constitution XVI mandates strict financial precision.
  - Floating point math (JS Number) causes rounding errors (e.g., 0.1 + 0.2 != 0.3).
  - Division (partial payments) requires controllable precision/rounding mode (e.g., ROUND_HALF_UP).

### 4. 3-Way Matching Logic (FR-020)

- **Decision**: Implement as a Policy check (`BillPolicy.ensureMatching(po, grn, bill)`) before Bill creation/posting.
- **Rationale**:
  - FR-020 requires "Zero Tolerance" exact match.
  - Logic involves comparing multiple entities (PO Line, GRN Line, Bill Line).
  - Encapsulating in Policy keeps Service orchestration clean.

### 5. Void/Cancel Rollback Strategy (FR-009, FR-018, FR-019)

- **Decision**: "compensating transaction" pattern rather than physical deletion.
- **Rationale**:
  - Audit trail (FR-021) requires history preservation.
  - Voids need to reverse accounting entries (Contra-Journal) and stock movements (Reverse Stock Movement).
  - Deleting records breaks Referential Integrity (FKs).

## Open Questions Resolved

- **Q: How to handle concurrent GRN receiving for same PO?**
  - A: Optimistic concurrency control (FR-027) + Atomic database transaction. If stock update fails or PO qty exceeded, rollback entire transaction.
- **Q: How to handle "Close PO" with remaining qty?**
  - A: Explicit "Close" action that sets status to RECEIVED and logs reason. Remaining qty ignored for future GRNs.

## Dependency Analysis

| Dependency     | Purpose                      | Risk | Mitigation                                              |
| :------------- | :--------------------------- | :--- | :------------------------------------------------------ |
| **Prisma**     | ORM / Transaction Management | Low  | Use `$transaction` for all multi-step writes.           |
| **Decimal.js** | Financial Math               | Low  | Ensure all `number` inputs are converted immediately.   |
| **Zod**        | Validation                   | Low  | Define all schemas in `packages/shared`.                |
| **Vitest**     | Integration Testing          | Low  | Follow "Single Block" flow pattern (Constitution XVII). |
