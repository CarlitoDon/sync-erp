# Implementation Plan: Apple-Style Backend Core Refactor

**Branch**: `020-apple-backend-refactor` | **Date**: 2025-12-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-apple-backend-refactor/spec.md`
**Roadmap Phase**: Phase 0 - Foundation

## Summary

This refactor introduces the **Policy Layer architecture** and **BusinessShape constraints** to transform the generic ERP backend into an opinionated, Apple-like system. Key deliverables:

1. **Schema Foundation**: Add `BusinessShape` enum to `Company`, create `SystemConfig`, `Warehouse`, `ProductCategory`, `StockLayer` tables, enhance `Product` model.
2. **Policy Layer**: Inject `*.policy.ts` files into Inventory and Sales modules.
3. **Service Refactor**: Ensure all services consult Policy before Repository.
4. **Shape Selection Endpoint**: `POST /company/select-shape` with auto-seeding of config and CoA.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20.x)
**Primary Dependencies**: Express, Prisma ORM, Zod, Vitest
**Storage**: PostgreSQL via Prisma
**Testing**: Vitest (unit + integration)
**Target Platform**: Node.js backend (Docker-ready)
**Project Type**: Turbo monorepo with `apps/api`, `apps/web`, `packages/*`
**Performance Goals**: Policy checks < 5ms latency impact
**Constraints**: Zero breaking changes to existing API contracts (additive only)
**Scale/Scope**: ~10 modules to refactor, ~5 new DB models, ~15 new files

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Architecture**: Frontend ↔ Backend via HTTP only? Dependencies uni-directional?
- [x] **II. Contracts**: Shared types in `packages/shared`? Validators exported?
- [x] **III. Backend Layers**: Service checks `Policy` before Action? (Service → Policy → Repository)
- [x] **IV. Multi-Tenant**: ALL data isolated by `companyId`?
- [x] **V. Frontend**: UI is State Projection? No complex conditionals?
- [x] **VIII. Verification**: `npx tsc --noEmit` and `npm run build` will pass?
- [x] **IX. Schema-First**: New API fields added to Zod schema FIRST? Types use `z.infer`?
- [x] **X. Parity**: If Feature A exists in Sales, does it exist in Procurement? (and vice versa)
- [x] **XI. Performance**: No N+1 Client loops? Lists use Backend `include` for relations?
- [x] **XII. Apple-Standard**: Does logic derive from `BusinessShape`? No technical questions to user?
- [x] **XIII. Data Flow**: Is Frontend pure reflection? No local business state calculation?
- [x] **XIV-XVII. Human Experience**: N/A (Backend-only feature)

**Gate Status**: ✅ PASSED - No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/020-apple-backend-refactor/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── company.yaml     # OpenAPI for shape selection
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code Changes

```text
packages/
├── shared/
│   └── src/
│       ├── types/
│       │   └── company.ts          # [NEW] BusinessShape enum
│       └── validators/
│           ├── company.ts          # [NEW] SelectShapeSchema
│           └── index.ts            # [MODIFY] Export new schemas

├── database/
│   └── prisma/
│       └── schema.prisma           # [MODIFY] Add BusinessShape, SystemConfig, Warehouse, etc.

apps/api/src/
├── types/
│   └── express.d.ts                # [MODIFY] Add shape to req.company
├── middlewares/
│   └── auth.ts                     # [MODIFY] Load shape into context
├── modules/
│   ├── company/
│   │   ├── company.controller.ts   # [MODIFY] Add select-shape endpoint
│   │   ├── company.service.ts      # [MODIFY] Add selectShape method
│   │   └── company.policy.ts       # [NEW] Shape transition rules
│   ├── inventory/
│   │   ├── inventory.constants.ts  # [NEW] Movement types
│   │   ├── inventory.policy.ts     # [NEW] Shape-based constraints
│   │   ├── inventory.service.ts    # [MODIFY] Inject policy checks
│   │   ├── rules/                  # [NEW] Pure business logic
│   │   │   └── stockRule.ts
│   │   └── repository.ts           # [NEW] Data access layer
│   └── sales/
│       ├── sales.policy.ts         # [NEW] Shape-based constraints
│       └── sales.service.ts        # [MODIFY] Inject policy checks
└── routes/
    └── company.ts                  # [MODIFY] Add POST /select-shape
```

**Structure Decision**: Follows Constitution Principle III (Layered Backend). Each module gets a `policy.ts` file. Rules are extracted to `rules/` subfolder for pure, unit-testable logic.

## Proposed Changes

### Phase 0: Schema Foundation

---

#### [NEW] packages/shared/src/types/company.ts

Define the `BusinessShape` enum and related types:

```typescript
export enum BusinessShape {
  PENDING = 'PENDING',
  RETAIL = 'RETAIL',
  MANUFACTURING = 'MANUFACTURING',
  SERVICE = 'SERVICE',
}

export enum CostingMethod {
  AVG = 'AVG',
  FIFO = 'FIFO',
}
```

---

#### [MODIFY] packages/database/prisma/schema.prisma

Add new enums and models:

- `BusinessShape` enum
- `CostingMethod` enum
- `Company.businessShape` field (default PENDING)
- `SystemConfig` model
- `Warehouse` model
- `ProductCategory` model
- `StockLayer` model (for future FIFO)
- `Product` enhancements (`categoryId`, `unitOfMeasure`, `costingMethod`, `isService`)
- `InventoryMovement.warehouseId` field

---

### Phase 1: Policy Layer Injection

---

#### [NEW] apps/api/src/modules/inventory/inventory.policy.ts

```typescript
export class InventoryPolicy {
  static canAdjustStock(shape: BusinessShape): boolean {
    return shape !== BusinessShape.SERVICE;
  }

  static canCreateWIP(shape: BusinessShape): boolean {
    return shape === BusinessShape.MANUFACTURING;
  }

  static ensureCanAdjustStock(shape: BusinessShape): void {
    if (!this.canAdjustStock(shape)) {
      throw new DomainError(
        'Stock tracking is disabled for Service companies'
      );
    }
  }
}
```

---

#### [NEW] apps/api/src/modules/sales/sales.policy.ts

```typescript
export class SalesPolicy {
  static canSellPhysicalGoods(shape: BusinessShape): boolean {
    return shape !== BusinessShape.SERVICE;
  }

  static ensureCanSellPhysicalGoods(shape: BusinessShape): void {
    if (!this.canSellPhysicalGoods(shape)) {
      throw new DomainError(
        'Service companies can only sell services'
      );
    }
  }
}
```

---

### Phase 2: Service Refactor

---

#### [MODIFY] apps/api/src/modules/inventory/inventory.service.ts

- Import `InventoryPolicy`
- Before any stock operation: `InventoryPolicy.ensureCanAdjustStock(company.shape)`
- Move HPP calculation logic to `rules/stockRule.ts`

---

#### [MODIFY] apps/api/src/modules/sales/sales.service.ts

- Import `SalesPolicy`
- Before creating orders with physical goods: `SalesPolicy.ensureCanSellPhysicalGoods(company.shape)`

---

### Phase 3: Shape Selection Endpoint

---

#### [MODIFY] apps/api/src/modules/company/company.controller.ts

Add `POST /company/select-shape`:

```typescript
static async selectShape(req: Request, res: Response) {
  const result = await companyService.selectShape(req.company.id, req.body.shape);
  res.json(result);
}
```

---

#### [MODIFY] apps/api/src/modules/company/company.service.ts

Add `selectShape` method:

1. Validate current shape is PENDING
2. Update company.businessShape
3. Auto-seed SystemConfig for shape
4. Auto-seed Chart of Accounts for shape

---

## Verification Plan

### Automated Tests

```bash
# TypeScript check
npx tsc --noEmit

# Run all tests
npm run test

# Run specific module tests
npm run test -- --filter inventory
npm run test -- --filter sales
```

### Unit Tests to Create

| Test File                  | Scenarios                                          |
| -------------------------- | -------------------------------------------------- |
| `inventory.policy.test.ts` | `canAdjustStock` returns false for SERVICE         |
| `inventory.policy.test.ts` | `canCreateWIP` returns true only for MANUFACTURING |
| `sales.policy.test.ts`     | `canSellPhysicalGoods` returns false for SERVICE   |
| `company.service.test.ts`  | `selectShape` rejects if already non-PENDING       |
| `company.service.test.ts`  | `selectShape` auto-seeds config and CoA            |

### Manual Verification

1. Run migration: `npx prisma migrate dev --name add_business_shape`
2. Seed a PENDING company
3. Call `POST /company/select-shape` with `{ "shape": "RETAIL" }`
4. Verify SystemConfig and CoA are seeded
5. Attempt to adjust stock in SERVICE company → expect 400 error

---

## Complexity Tracking

> No Constitution violations detected. All patterns align with established architecture.

| Aspect             | Decision                  | Rationale                                                    |
| ------------------ | ------------------------- | ------------------------------------------------------------ |
| Policy Layer       | New `*.policy.ts` files   | Constitution Principle III requires Policy before Repository |
| StockLayer Table   | Created but unused in MVP | Prepared for future FIFO support (Phase 3)                   |
| Shape Immutability | Enforced in service       | Apple-Like principle: "Decision Lives Once"                  |
