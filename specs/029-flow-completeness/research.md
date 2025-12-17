# Research: Phase 1 Flow Completeness

## Unknowns & Clarifications

**None**. The feature scope is well-defined by the Roadmap and existing implementation patterns.

- Sagas already exist.
- Error handling patterns exist.
- Feature Disabling is a logic check, not a new technology.

## Decisions

- **Decision**: Use `FEATURE_DISABLED_PHASE_1` error code.
  - **Rationale**: Clear communication to API consumers that this is a temporary limitation, not a bug.
- **Decision**: Block Partial Receipts in Saga, not Policy.
  - **Rationale**: Policy checks invariants ("Is it draft?"). Saga checks process rules ("Are we receiving full amount?"). Keeping Policy pure and stateless.

## Alternatives Considered

- **Alternative**: Delete non-golden code.
  - **Rejected**: We want to keep the skeleton for Phase 2, just disable execution for safety now (Apple Principle: "Better missing than wrong", but code can stay if invisible/unreachable).
