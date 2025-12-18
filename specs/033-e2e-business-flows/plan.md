# Implementation Plan: Correct E2E Business Flows (O2C & P2P)

**Branch**: `033-e2e-business-flows` | **Date**: 2025-12-18 | **Spec**: [spec.md](file:///Users/wecik/Documents/Offline/sync-erp/specs/033-e2e-business-flows/spec.md)
**Input**: Feature specification from `specs/033-e2e-business-flows/spec.md`

## Summary

Implement and verify the full O2C and P2P business flows with strict domain and ledger invariants. This includes establishing two distinct logging layers: **Audit Logs** for immutable business truth (accountability/compliance) and **Saga Logs** for technical execution traces (recovery/retry). All state-changing actions will be correlated via `correlationId`.

## Technical Context

**Language/Version**: TypeScript / Node.js 18+  
**Primary Dependencies**: Express, Prisma, Decimal.js, Zod  
**Storage**: PostgreSQL (via Prisma)  
**Testing**: MANDATORY: Integration Tests (Business Flow via Vitest)  
**Target Platform**: Backend API  
**Project Type**: Monorepo (Turborepo)  
**Performance Goals**: Instant consistency for single-tenant transactions.  
**Constraints**: Atomic execution of Posting/Payment flows via Sagas.  
**Scale/Scope**: All core ERP modules (Sales, Procurement, Accounting, Inventory).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Architecture**: Frontend ↔ Backend via HTTP only? Dependencies uni-directional?
- [x] **II. Contracts**: Shared types in `packages/shared`? Validators exported?
- [x] **III. Backend Layers**: Service checks `Policy` before Action? (Service → Policy → Repository)
- [x] **IV. Multi-Tenant**: ALL data isolated by `companyId`?
- [x] **V. Frontend**: UI is State Projection? No complex conditionals? (Headless feature, but pattern applies)
- [x] **VIII. Verification**: `npx tsc --noEmit` and `npm run build` will pass?
- [x] **IX. Schema-First**: New API fields added to Zod schema FIRST? Types use `z.infer`?
- [x] **X. Parity**: If Feature A exists in Sales, does it exist in Procurement? (and vice versa)
- [x] **XI. Performance**: No N+1 Client loops? Lists use Backend `include` for relations?
- [x] **XII. Apple-Standard**: Does logic derive from `BusinessShape`? No technical questions to user?
- [x] **XIII. Data Flow**: Is Frontend pure reflection? No local business state calculation?
- [x] **XIV-XVII. Human Experience**: Clear Navigation? Simplified Workflows? Performance-First? Pixel Perfect?

## Project Structure

### Documentation (this feature)

```text
specs/033-e2e-business-flows/
├── plan.md              # This file
├── research.md          # Research findings
├── data-model.md        # Data model changes (AuditLog + SagaLog)
├── contracts/           # API Contract verification
└── tasks.md             # Task breakdown
```

### Source Code

```text
apps/api/src/modules/
├── common/saga/         # Saga Infrastructure (Orchestrator, PostingContext)
├── common/audit/        # AuditLog Infrastructure (Repository, Service)
├── accounting/          # Invoice/Bill Posting Sagas, Payment Sagas
├── inventory/           # Stock Movement Sagas (Shipment/Receipt)
└── sales | procurement  # Domain logic hooks
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |

## Verification Plan

### Automated Tests

- **Integration Tests**: Run `npm run test:integration --workspace=@sync-erp/api` to verify full O2C and P2P flows.
- **Saga Compensation Tests**: Write new integration tests specifically failing mid-saga to verify `COMPENSATED` state and ledger rollback.
- **Idempotency Tests**: Verify that duplicate POST requests with the same `correlationId` do not create duplicate Journals.

### Manual Verification

- N/A (Headless logic focused on API/DB correctness).
