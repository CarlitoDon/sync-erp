# Apple-Like Compliance Checklist: E2E Business Flows

**Purpose**: Validate that O2C and P2P requirements meet the non-negotiable "Apple-Like" engineering standards for domain integrity, technical robustness, and auditability.
**Created**: 2025-12-18
**Feature**: [spec.md](file:///Users/wecik/Documents/Offline/sync-erp/specs/033-e2e-business-flows/spec.md)

## Domain & Data Integrity (Guardrail 1)

- [x] CHK001 - Are the internal business invariants (e.g., `balance >= 0`, `StockQty >= 0`) defined as non-negotiable system requirements? [Clarity, Spec §SC-005]
- [x] CHK002 - Does the spec explicitly define the behavior when an operation would violate a business invariant? [Completeness, Spec §Edge Cases]
- [x] CHK003 - Is the requirement that the Backend remains the sole arbiter of state clearly documented? [Consistency, Spec §SC-001]

## Saga & Side Effects (Guardrail 2)

- [x] CHK004 - Are all cross-module side effects (Journal creation, Stock movement) explicitly attached to a Saga orchestration requirement? [Completeness, Spec §FR-006]
- [x] CHK005 - Does the spec define mandatory compensation steps for every side effect in the flow? [Completeness, Spec §FR-007]
- [x] CHK006 - Are failure states (FAILED/COMPENSATED) defined as first-class states in the requirements? [Completeness, Spec §FR-009]

## Idempotency & Concurrency (Guardrail 3)

- [x] CHK007 - Is the idempotency scope explicitly defined as `(companyId, entityId, action)` for all state-changing commands? [Clarity, Spec §FR-008]
- [x] CHK008 - Does the spec define requirements for handling parallel mutation attempts on the same entity? [Coverage, Guardrail 3.2]

## Accounting & Immutability (Guardrail 4)

- [x] CHK009 - Is the transition from Mutable (Draft) to Immutable (Posted) clearly defined with its associated locking requirements? [Clarity, Spec §FR-004]
- [x] CHK010 - Are Journal entries required to reference a specific source document and business date? [Traceability, Spec §SC-003]
- [x] CHK011 - Does the spec explicitly forbid Journal creation before the POSTED state? [Consistency, Spec §FR-003]

## Observability & Auditability (User Priority Q2)

- [x] CHK012 - Are requirements defined for persisting execution records (outcome/timestamp) for every Saga step? [Completeness, Spec §FR-009]
- [x] CHK013 - Do financial command requirements include mandatory audit log entries with `correlationId` and `businessDate`? [Completeness, Spec §FR-010]
- [x] CHK014 - Are invariant violations required to be queryable at the system level for audit purposes? [Measurability, Spec §SC-005]

## Testing Excellence (Guardrail 5)

- [x] CHK015 - Does the spec require 100% verification of business flows via automated integration tests? [Completeness, Spec §SC-001]
- [x] CHK016 - Are integration scenarios defined to cover both happy paths and failure/compensation paths? [Coverage, Spec §User Scenarios]
