# Feature Specification: Integrasi Prisma + Zod + tRPC (Architecture)

**Feature Branch**: `037-prisma-zod-trpc`
**Created**: 2025-12-23
**Status**: Draft
**Input**: Standardize Architecture: Prisma + Zod + tRPC

## Clarifications

### Session 2025-12-23

- **Q**: Is this covering the entire project? → **A**: **Option B (Core Modules - O2C & P2P)**. Refactor Purchase Order AND Sales Order.
- **Q**: How to handle legacy manual Enums? → **A**: **Option B (Aggressive Cleanup)**. Delete manual definitions (e.g., `PaymentTerms`) and fix all breakages immediately.

## User Scenarios & Testing

### User Story 1 - Setup Zod Generator Pipeline (Priority: P1)

As a backend developer, I want `zod-prisma-types` configured in the codebase so that Zod schemas are automatically generated from my Prisma models, preventing enum duplication and schema drift.

**Why this priority**: Foundation for the entire architecture.

**Integration Scenario**:

1. Run `npx prisma generate`.
2. Check `packages/shared/src/generated/zod/index.ts`.
3. Verify it contains `PaymentTermsSchema`, `OrderSchema`, etc.
4. Verify `PaymentTermsSchema` strictly matches the Prisma enum.

---

### User Story 2 - Refactor Core Modules (PO & SO) (Priority: P2)

As a developer, I want both Procurement (Purchase Order) and Sales (Sales Order) modules to use the generated Zod schemas so that the core business flows (P2P and O2C) follow the new "Clean Architecture" pattern.

**Why this priority**: Ensures both sides of the trading platform are consistent and strictly typed.

**Integration Scenario**:

1. **Purchase Order**: Frontend calls `purchaseOrder.create` with valid/invalid payloads. Validation happens at tRPC boundary via generated schema.
2. **Sales Order**: Frontend calls `salesOrder.create` with valid/invalid payloads. Validation happens at tRPC boundary.
3. Both services receive strictly typed inputs.

**Acceptance Scenarios**:

1. **Given** the `createPOSchema` and `createSOSchema` in `packages/shared` (derived from generated types), **When** I define the tRPC procedures, **Then** they must use these schemas.
2. **Given** `PurchaseOrderService` and `SalesOrderService`, **When** inspected, **Then** methods accept Zod-inferred types, not raw `any` or manual interfaces.
3. **Given** the `PaymentTerms` enum, **When** used in either module, **Then** it must come from `@/generated/zod`.

---

### User Story 3 - Aggressive Legacy Cleanup (Priority: P3)

As a maintainer, I want manual Enum definitions removed from `packages/shared` so that there is only ONE source of truth (Prisma) for database Enums.

**Why this priority**: Prevents future drift where a developer updates Prisma but forgets the manual file.

**Integration Scenario**:

1. Delete manual `PaymentTerms` definition in `packages/shared`.
2. Run full type-check (`tsc`).
3. Fix all errors in Finance, Inventory, and other dependent modules by pointing them to the generated Enum.

**Acceptance Scenarios**:

1. **Given** the codebase, **When** searching for `enum PaymentTerms`, **Then** it should ONLY appear in `schema.prisma` and generated files (no manual TS definitions).
2. **Given** the build process, **When** `npm run type-check` is executed, **Then** it passes with 0 errors.

## Requirements

### Functional Requirements

- **FR-001**: System MUST include `zod-prisma-types` configuration in `packages/database`.
- **FR-002**: Auto-generation MUST output Zod schemas to `packages/shared/src/generated/zod`.
- **FR-003**: `packages/shared` MUST export these generated schemas.
- **FR-004**: `PurchaseOrder` module (Router + Service) MUST be refactored to use generated types.
- **FR-005**: `SalesOrder` module (Router + Service) MUST be refactored to use generated types.
- **FR-006**: Manual definition of `PaymentTerms` in `packages/shared` MUST be deleted.
- **FR-007**: All references to the old `PaymentTerms` (in Finance, Inventory, etc.) MUST be updated to import the generated one.

### Key Entities

- **Prisma Generator**: `zod-prisma-types`
- **Shared Schemas**: `packages/shared/src/generated`
- **Core Modules**: Procurement (PO) and Sales (SO)

## Success Criteria

### Measurable Outcomes

- **SC-001**: `npx prisma generate` produces functional Zod schemas.
- **SC-002**: Zero manual `enum` definitions for `PaymentTerms` in the codebase (outside generated folders).
- **SC-003**: `PurchaseOrderRouter` and `SalesOrderRouter` delegated fully to Services with type-safe inputs.
- **SC-004**: Build (`npm run build`) and Tests (`npm test`) pass successfully after the aggressive cleanup.

## Constitution & Architecture Compliance

### Backend Architecture (Apps/API) - Principles I, II, III, XXI

- [x] **5-Layer Architecture**: Logic checks in Service, Router is transport only.
- [x] **Schema-First**: Enforced via Generation.
- [x] **Service Purity**: Service uses Repository/Prisma via correct abstraction (or directs if permitted by current phase, but Goal is Clean Arch).
- [x] **Anti-Bloat**: Refactoring only, no new business logic features added.

### Testing & Quality - Principles XV, XVII

- [x] **Integration Tests**: Existing tests for PO and SO must pass.
- [x] **Type Safety**: Full strict mode compliance required for the refactor.
