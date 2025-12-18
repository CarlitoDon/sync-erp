# Research: E2E Business Flows

## Current State Analysis

### 1. Saga Orchestration

- **Status**: Infrastructure exists in `apps/api/src/modules/common/saga/`.
- **Mechanism**: `SagaOrchestrator` uses `PostingContext` and `SagaLogRepository`.
- **Gaps**: `SagaLog` lacks explicit `businessDate` and `correlationId` fields. While `SagaLog.id` can act as a correlation ID, the spec implies a broader audit requirement.

### 2. Idempotency

- **Status**: `IdempotencyKey` model exists in `schema.prisma`.
- **Mechanism**: Scoped to `(companyId, scope, entityId)`.
- **Gaps**: Need to ensure all Posting/Payment routes use this middleware.

### 3. Audit Logging

- **Status**: No dedicated `AuditLog` model beyond `SagaLog`.
- **Decision**: Extend `SagaLog` or use it as the source of truth for "Audit Logs" since it already tracks `SagaType` (command) and `entityId`. Added requirement for step-level persistence is partially met by `stepData`, but explicit `businessDate` should be added to `SagaLog`.

## Decisions

- **Audit Strategy**: Use `SagaLog` as the primary audit trail for business flows. Enhance it to include `businessDate` for financial traceability.
- **Idempotency Scope**: Enforce `(companyId, scope, entityId)` across all E2E flow endpoints.
- **Verification**: Use API-based seeder (`seed-via-api.sh`) as the baseline for E2E integration tests.

## Alternatives Considered

- **Dedicated AuditLog Model**: Rejected to avoid duplication with `SagaLog` which already tracks the "History" of a business command.
