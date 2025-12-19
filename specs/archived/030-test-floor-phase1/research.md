# Research: Phase 1 Test Floor

## Decisions Log

### 1. Invariant Test Location

- **Decision**: Create new directory `apps/api/test/invariants`.
- **Rationale**: Invariant tests are distinct from Unit (isolated logic) and Integration (flow verification). They are "System State Integrity" checks that might run against a seeded database or a snapshot. Keeping them separate allows running them independently (e.g., as a nightly cron or pre-release gate).
- **Alternatives**:
  - _Integration Folder_: Risk of mixing with Saga flow tests.
  - _E2E Folder_: Valid, but E2E implies full stack. These are backend-only constraints.

### 2. Test Runner Configuration

- **Decision**: Use existing `Vitest` infrastructure but add `test:invariants` script.
- **Rationale**: Vitest is already configured. No need for a separate runner.
- **Implementation**: `vitest run test/invariants`

### 3. Invariant Scope (Phase 1)

- **Decision**: Focus on 3 Core Invariants:
  1. **Inventory**: Non-negative Stock.
  2. **Finance**: Non-negative Invoice Balance.
  3. **Accounting**: Journal Entry Balance (Debit = Credit).
- **Rationale**: These are the "Silent Corruption" killers. Other rules (e.g., status transitions) are covered by Policy Unit Tests.

## Best Practices Adopted

- **Seeded State Pattern**: Invariant tests will run against a specific seeded state (Golden Dataset) to verify they catch known violations if artificially introduced, or pass on clean data.
- **Property-Based Testing (Lite)**: We will check _all_ records in the DB, not just specific ones. e.g. `await prisma.invoice.count({ where: { balance: { lt: 0 } } })` should always be 0.
