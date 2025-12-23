---
description: 'Tasks for 037-prisma-zod-trpc'
---

# Tasks: Prisma + Zod + tRPC Integration

**Input**: Design documents from `/specs/037-prisma-zod-trpc/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Integration tests are MANDATORY for all business flows.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup & Generation (US1)

**Purpose**: Configure the Zod generator pipeline.

- [ ] T001 [US1] Install `zod-prisma-types` to `packages/database` devDependencies in `packages/database/package.json`
- [ ] T002 [US1] Configure `generator zod` in `packages/database/prisma/schema.prisma`
- [ ] T003 [US1] Run `prisma generate` to create initial Zod schemas in `packages/shared/src/generated/zod`
- [ ] T004 [US1] Export generated types from `packages/shared/src/validators/index.ts`

**Checkpoint**: Zod schemas are generated and exported.

## Phase 2: Core Refactor (US2)

**Purpose**: Refactor Purchase & Sales Orders to use generated schemas.

### Implementation for US2

- [ ] T005 [P] [US2] Update `PurchaseOrder` Router & Service to use generated types in `apps/api/src/modules/procurement/purchase-order.service.ts`
- [ ] T006 [P] [US2] Update `SalesOrder` Router & Service to use generated types in `apps/api/src/modules/sales/sales-order.service.ts`
- [ ] T007 [US2] Verify PO creation flow with new types (Manual Integration Test run)

**Checkpoint**: Core modules are using Zod schemas.

## Phase 3: Aggressive Cleanup (US3)

**Purpose**: Remove manual enum definitions and fix all regressions.

### Implementation for US3

- [ ] T008 [US3] DELETE manual `PaymentTermsSchema` and `PaymentStatusSchema` from `packages/shared/src/validators/p2p.ts`
- [ ] T009 [P] [US3] Fix `PaymentTerms` type errors in `apps/api/src/modules/accounting/services/bill.service.ts`
- [ ] T010 [P] [US3] Fix `PaymentTerms` type errors in `apps/api/src/modules/accounting/services/invoice.service.ts`
- [ ] T011 [P] [US3] Fix `PaymentTerms` type errors in `apps/api/src/modules/procurement/upfront-payment.service.ts`
- [ ] T012 [P] [US3] Fix `PaymentTerms` type errors in `apps/web/src/features/procurement/` components
- [ ] T013 [P] [US3] Fix remaining `PaymentTerms` references in `packages/shared/src/validators/index.ts`

**Checkpoint**: No manual enum definitions remain.

## Phase 4: Verification (Polish)

**Purpose**: Final verification of the entire system.

### Verification Tasks

- [ ] T013 Run full type check `npx tsc --noEmit` to ensure zero errors
- [ ] T014 Run integration tests `npx vitest apps/api/test/integration/upfront-payment.test.ts`

## Dependencies & Execution Order

- **Phase 1 (Setup)**: Blocks Phase 2
- **Phase 2 (Core)**: Blocks Phase 3 (partially) - effectively Phase 3 depends on generated types from Phase 1, but Phase 2 validates usage.
- **Phase 3 (Cleanup)**: Must happen after core usage is migrated (Phase 2) to avoid broken imports during transition, or could be done in parallel if careful.
