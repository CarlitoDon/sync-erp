# Implementation Plan: 037-prisma-zod-trpc

**Branch**: `037-prisma-zod-trpc` | **Date**: 2025-12-23 | **Spec**: [spec.md](./spec.md)
**Input**: Standardize Architecture: Prisma + Zod + tRPC

**Note**: This template is filled in by the `/speckit-plan` command.

## Summary

This feature standardizes the Backend Type System by using `zod-prisma-types` to auto-generate Zod schemas from the Prisma schema. It includes refactoring the Core Modules (**Purchase Order** and **Sales Order**) to use these generated types, removing manual enum definitions from `packages/shared`, and fixing resulting type errors across the codebase (Aggressive Cleanup).

## Technical Context

**Language/Version**: TypeScript / Node.js 18+
**Primary Dependencies**: Express, Prisma, Decimal.js, Zod, zod-prisma-types
**Storage**: PostgreSQL
**Testing**: Integration Tests (Business Flow)
**Target Platform**: Node.js
**Project Type**: Web (Monorepo)
**Performance Goals**: N/A (Architecture Refactor)
**Constraints**: Zero regressions in P2P/O2C flows.
**Scale/Scope**: Core Modules + Global Type System.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Dependency**: Frontend ↔ Backend via HTTP only? (Yes)
- [x] **I. Multi-Tenant**: ALL data isolated by `companyId`? (Yes)
- [x] **II. Type System**: Shared types in `packages/shared`? (Yes - Improving this principle)
- [x] **III. Backend Layers**: Service checks `Policy` before Action? (Yes)
- [x] **III-A. Dumb Layers**: Controller only calls service? (Yes)
- [x] **IV. Frontend**: Logic in `src/features`? (Yes)
- [x] **V. Callback-Safe**: Services export standalone functions? (Yes)
- [x] **VI. Build Verification**: `npx tsc --noEmit` and `npm run build` will pass? (Yes - Primary success criteria)
- [x] **VII. Parity**: If Feature A exists in Sales, does it exist in Procurement? (Yes - Refactoring both)
- [x] **VIII. Performance**: No N+1 Client loops? (N/A)
- [x] **IX. Apple-Standard**: Derived from `BusinessShape`? (N/A)
- [x] **X. Data Flow**: Frontend → API → Controller → Service → Rules/Policy → Repository → DB? (Yes)
- [x] **XI. Human Interface**: Clear Navigation? (N/A)
- [x] **XIII. Engineering**: Zero-Lag UI? (N/A)
- [x] **XV. Test Contracts**: Mocks satisfy all Policy/Service layer expectations? (Yes)
- [x] **XVI. Financial Precision**: `Decimal` for money? (Yes)
- [x] **XVII. Integration State**: Sequential flows in single `it()` block? (Yes - Existing tests)
- [x] **XVIII. Schema for Raw SQL**: `$executeRaw` column names match Prisma schema? (N/A)
- [x] **XIX. Seed Completeness**: All expected accounts/configs in seed files? (N/A)
- [x] **XXI. Anti-Bloat**: Reuse existing methods? (Yes)

## Project Structure

### Documentation (this feature)

```text
specs/037-prisma-zod-trpc/
├── plan.md              # This file
├── research.md          # Research findings
├── data-model.md        # Model reference
├── quickstart.md        # Developer guide
└── tasks.md             # Task decomposition
```

## User Review Required

> [!WARNING]
> This is a **Breaking Change** for the backend type system. Manual `enum` definitions in `packages/shared` will be deleted. Any un-migrated code relying on them will fail to compile.

## Proposed Changes

### Database Package

#### [MODIFY] [schema.prisma](file:///Users/wecik/Documents/Offline/sync-erp/packages/database/prisma/schema.prisma)

- Add `generator zod` block configured to output to `../../shared/src/generated/zod`.

#### [MODIFY] [package.json](file:///Users/wecik/Documents/Offline/sync-erp/packages/database/package.json)

- Add `zod-prisma-types` to `devDependencies`.

### Shared Package

#### [MODIFY] [validators/p2p.ts](file:///Users/wecik/Documents/Offline/sync-erp/packages/shared/src/validators/p2p.ts)

- **DELETE** `PaymentTermsSchema`, `PaymentStatusSchema`.
- **UPDATE** imports to use generated types.

#### [MODIFY] [validators/index.ts](file:///Users/wecik/Documents/Offline/sync-erp/packages/shared/src/validators/index.ts)

- **EXPORT** `*` from `../generated/zod`.
- **DELETE** Manual enum re-exports that conflict.

### API Package (Procurement)

#### [MODIFY] [purchaseOrder.router.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/trpc/routers/purchaseOrder.router.ts)

- Use `CreatePurchaseOrderSchema` (derived from generated types).

#### [MODIFY] [purchase-order.service.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/modules/procurement/purchase-order.service.ts)

- Update method signatures to use `z.infer<typeof OrderSchema>`.
- Remove manual `as PaymentTerms` casting; rely on strict types.

### API Package (Sales)

#### [MODIFY] [salesOrder.router.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/trpc/routers/salesOrder.router.ts)

- Use generated schema for input validation.

#### [MODIFY] [sales-order.service.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/modules/sales/sales-order.service.ts)

- Update signatures to use generated types.

### Other Modules (Cleanup)

#### [MODIFY] [bill.service.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/modules/accounting/services/bill.service.ts)

- Update `PaymentTerms` imports.

#### [MODIFY] [invoice.service.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/api/src/modules/accounting/services/invoice.service.ts)

- Update `PaymentTerms` imports.

## Verification Plan

### Automated Tests

1.  **Type Check**: `npx tsc --noEmit` (Must be clean).
2.  **Lint**: `npm run lint`.
3.  **Integration Tests**:
    - `npx vitest apps/api/test/integration/upfront-payment.test.ts` (Covers P2P flow with PaymentTerms).
    - `npx vitest apps/api/test/integration/sales-order.test.ts` (If exists, verify O2C).

### Manual Verification

1.  **Generate**: Run `npx prisma generate` and verify `packages/shared/src/generated/zod` exists.
2.  **Inspect**: Open `packages/shared/src/generated/zod/index.ts` and confirm `PaymentTermsSchema` is present.
