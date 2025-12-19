# Quickstart: P2P Implementation

This guide provides step-by-step instructions for implementing the P2P flow.

## 1. Database & Types (Foundational)

1.  **Schema**: Update `packages/database/prisma/schema.prisma` with `PurchaseOrder`, `GoodsReceipt`, `Bill`, `Payment` models (Data Model).
2.  **Migration**: Run `npm run db:migrate --name add_p2p_models`.
3.  **Types**: Create `packages/shared/src/types/p2p.ts` with `z.infer`.
4.  **Validators**: Create `packages/shared/src/validators/p2p.ts` with Zod schemas (Contracts).

## 2. Backend Modules (apps/api)

Follow the **5-Layer Architecture**:

1.  **Module**: Create `src/modules/procurement` and `src/modules/accounting`.
2.  **Repository**: Implement `*Repository` classes with Prisma queries.
3.  **Policy**: Implement `*Policy` classes (e.g., `BillPolicy.ensureMatching`).
4.  **Service**: Implement orchestration in `*Service`, calling repositories and policies.
5.  **Controller**: implement `*Controller` to handle HTTP requests.
6.  **Route**: Register routes in `src/routes/v1/p2p.routes.ts`.

## 3. Frontend Features (apps/web)

Follow **Feature-Based Architecture**:

1.  **Feature**: Create `src/features/procurement` and `src/features/accounting`.
2.  **Services**: Create API clients in `services/api.ts` using `apiAction`.
3.  **Components**: Build UI for PO List, PO Detail, GRN Form, Bill Form.
4.  **Pages**: Assemble components into pages.

## Verification

1.  **Type Check**: `npx tsc --noEmit` MUST pass with zero errors.
2.  **Integration Test**: Create `test/e2e/p2p-flow.test.ts` covering full cycle (PO -> Payment).
