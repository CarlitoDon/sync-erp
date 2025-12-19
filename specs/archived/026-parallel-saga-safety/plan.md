# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js)
**Primary Dependencies**: Prisma ORM, Postgres
**Storage**: PostgreSQL (via Prisma)
**Testing**: Vitest (Unit/Integration)
**Target Platform**: Mac/Linux Server
**Project Type**: Backend API
**Performance Goals**: < 100ms overhead for locking
**Constraints**: Must not deadlock; Must serialize access to specific entities (Invoice, Bill, Payment).
**Scale/Scope**: 4 Critical Sagas (Invoice, Bill, Payment, CreditNote).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Architecture**: Frontend ↔ Backend via HTTP only? (N/A - Backend logic)
- [x] **II. Contracts**: (N/A - Internal Logic)
- [x] **III. Backend Layers**: Service checks `Policy` before Action? (Yes, Sagas orchestrate this)
- [x] **IV. Multi-Tenant**: ALL data isolated by `companyId`? (Yes, lock must be company-scoped or entity-unique)
- [x] **V. Frontend**: (N/A)
- [x] **VIII. Verification**: `npx tsc` and tests passes? (Standard requirement)
- [x] **IX. Schema-First**: (N/A - No API changes)
- [x] **X. Parity**: Applies to all posting flows equally.
- [x] **XI. Performance**: Locking introduces latency, but necessary for correctness.
- [x] **XII. Apple-Standard**: (N/A)
- [x] **XIII. Data Flow**: (N/A)
- [x] **XIV-XVII. Human Experience**: (N/A)

## Project Structure

### Documentation (this feature)

```text
specs/026-parallel-saga-safety/
├── plan.md              # This file
├── research.md          # Output: Lock Strategy (Advisory vs Row)
├── data-model.md        # Output: Schema changes (if any)
└── quickstart.md        # Output: Dev guide
```

### Source Code (repository root)

```text
apps/api/src/modules/
├── common/saga/
│   ├── saga-orchestrator.ts    # Main logic change
│   └── index.ts
└── accounting/sagas/           # Inheriting classes (maybe no changes if base handles it)
```

**Structure Decision**: enhance `SagaOrchestrator` base class to handle locking transparently.

## Complexity Tracking

| Violation                 | Why Needed                                   | Simpler Alternative Rejected Because                              |
| :------------------------ | :------------------------------------------- | :---------------------------------------------------------------- |
| **Transaction Injection** | Need to pass `tx` to Repos if using Row Lock | Advisory locks might suffice but Row Lock is explicit requirement |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

## Proposed Changes

### Packages

- **`packages/database`**: (No changes, `Prisma.TransactionClient` already exported).

### Modules (`apps/api`)

#### Common

- **[MODIFY] `modules/common/saga/saga-orchestrator.ts`**:
  - Update `execute` to wrap logic in `prisma.$transaction`.
  - Add `lockEntity(tx, id)` method.
  - Update `executeSteps` signature to accept `tx`.

#### Accounting

- **[MODIFY] `modules/accounting/repositories/invoice.repository.ts`**: Add `tx` to all methods.
- **[MODIFY] `modules/accounting/services/journal.service.ts`**: Add `tx` to `postInvoice`, `create`, `postJournal`.
- **[MODIFY] `modules/accounting/sagas/invoice-posting.saga.ts`**: Update `executeSteps` to pass `tx` to repos/services.
- **[MODIFY] `modules/accounting/sagas/bill-posting.saga.ts`**: Update `executeSteps` to pass `tx`.
- **[MODIFY] `modules/accounting/sagas/payment-posting.saga.ts`**: Update `executeSteps` to pass `tx`.

#### Inventory

- **[MODIFY] `modules/inventory/inventory.service.ts`**: Add `tx` to `processShipment`.

## Verification Plan

### Automated Tests

- [ ] **Concurrency Integration Test**: Verify entity locking prevents double posting.
  - Create `test/integration/concurrency/saga-locking.test.ts`.
  - Simulate concurrent `InvoicePostingSaga` executions.
  - Assert sequential execution and correct state (1 Success, 1 Failure).
- [ ] **Unit Tests**: Ensure individual Sagas pass their existing unit tests.

### Manual Verification

- Review Saga Logs in DB after concurrency test to ensure correct status (`COMPLETED` vs `FAILED`).
- N/A (Hard to mutually verify concurrency manually). Rely on integration tests.
