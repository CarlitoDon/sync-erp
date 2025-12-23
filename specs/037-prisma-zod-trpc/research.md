# Research: Integrasi Prisma + Zod + tRPC

**Feature**: `037-prisma-zod-trpc`
**Status**: Completed

## Decisions & Rationale

### 1. Schema Generation Strategy

- **Decision**: Use `zod-prisma-types` to generate Zod schemas directly into `packages/shared/src/generated/zod`.
- **Rationale**:
  - `packages/shared` is the designated Single Source of Truth for types/validators (per Constitution).
  - `packages/database` cannot be imported by `packages/shared` (circular dependency risk), so the generation must "push" files into `shared`.
  - Prevents "Dual Maintenance" of Enums (manual vs Prisma).
- **Configuration**:
  ```prisma
  generator zod {
    provider = "zod-prisma-types"
    output   = "../../shared/src/generated/zod"
  }
  ```

### 2. Enum Cleanup Strategy

- **Decision**: **Aggressive Cleanup**.
  - Delete `PaymentTermsSchema` from `packages/shared/src/validators/p2p.ts`.
  - Delete `PaymentTerms` type definition (if any manual one exists outside generated).
  - Update `packages/shared/src/validators/index.ts` to export from `@/generated/zod`.
- **Rationale**:
  - Soft migration leaves "zombie code" that confuses developers ("Which PaymentTerms should I use?").
  - The codebase is still in early MVP stage (v0.x), so strict refactoring is preferred over technical debt.

### 3. Service Layer Refactor

- **Decision**: Update `PurchaseOrderService` and `SalesOrderService` to accept `z.infer<typeof GeneratedCreateSchema>`.
- **Rationale**:
  - Enforces the `zod` contract at the Service boundary.
  - Removes usage of `any` or loose interfaces.
  - Aligns with "Type Safety" principle.

## Unknowns Resolved

- **Unknown**: Where is `PaymentTerms` currently defined?
  - **Answer**: `packages/shared/src/validators/p2p.ts` and `packages/database/src/index.ts` (but the latter is Prisma-generated).
- **Unknown**: Is `zod-prisma-types` installed?
  - **Answer**: No, it must be added to `devDependencies` in `packages/database`.
- **Unknown**: Can `packages/database` generator output to `packages/shared`?
  - **Answer**: Yes, Prisma generators accept relative paths. `../../shared` is valid.
