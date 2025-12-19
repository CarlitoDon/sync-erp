# Research: Domain Contract Stabilization

**Feature**: Domain Contract Stabilization
**Status**: COMPLETE (Clarified during Specification Phasae)

## Key Decisions

### 1. Sales/Purchase Order Terminology

**Decision**: Use `COMPLETED` and `CANCELLED`.
**Rationale**: Aligns with `STATE_MACHINES.md`. `FULFILLED` is logistic, not final business state. `CLOSED` is ambiguous. `COMPLETED` means fully invoiced/received.
**Impact**: Update FRs and State Machines to use these terms.

### 2. Business Date Requirement (Guardrail G5)

**Decision**: Enforce explicit `businessDate` on all financial commands.
**Rationale**: G5 is a hard guardrail. implicit dates cause audit nightmares. Default to `today` at command boundary is acceptable.
**Impact**: new `businessDate` field in DTOs, default logic in Controllers/Services.

### 3. Invariant Queryability (Guardrail G7)

**Decision**: Ensure schema supports direct SQL verification of invariants.
**Rationale**: Balance, Journal Balance, and Stock ≥ 0 must be provable true via SQL.
**Impact**: Schema review to ensure no complex joins required for basic truth checks.

### 4. Frontend Prohibitions

**Decision**: Explicitly forbid frontend from calculating balance/status.
**Rationale**: Backend owns reality (Constitution Principle II).
**Impact**: Documentation only (since this is backend feature), but sets valid constraints for future UI.
