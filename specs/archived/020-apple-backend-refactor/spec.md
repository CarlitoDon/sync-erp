# Feature Specification: Apple-Style Backend Core Refactor

**Feature Branch**: `020-apple-backend-refactor`
**Created**: 2025-12-16
**Status**: Draft
**Input**: Apple-Like development documentation suite (`docs/apple-like-development/`)
**Roadmap Phase**: **Phase 0 - Foundation** (see [ROADMAP.md](../../docs/apple-like-development/ROADMAP.md))

> **Phase 0 Target**: ERP kokoh secara struktur, meskipun fitur masih minim. Semua service bisa membaca config.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Backend Rejects Illegal Business Operations (Priority: P1)

As a **system administrator**, I want the backend to **automatically reject operations that don't match my company's Business Shape** so that I cannot accidentally create invalid business data (e.g., WIP in a Retail company, Stock adjustments in a Service company).

**Why this priority**: This is the foundation of the "Apple-Like" philosophy. Without this, all other features are cosmetic. The system must be "opinionated" at its core.

**Independent Test**: Create a test company with "RETAIL" shape. Attempt to call the "Create WIP" API. The system returns a 400 Domain Error, not a database error.

**Acceptance Scenarios**:

1.  **Given** a company with `shape=RETAIL`, **When** an API call attempts to create a WIP (Work In Progress) record, **Then** the system returns a `400 Bad Request` with a domain-specific error message ("Operation not allowed for Retail companies").
2.  **Given** a company with `shape=SERVICE`, **When** an API call attempts to adjust physical stock, **Then** the system returns a `400 Bad Request` ("Stock tracking is disabled for Service companies").
3.  **Given** a company with `shape=MANUFACTURING`, **When** an API call attempts to consume raw materials for production, **Then** the system successfully processes the request.

---

### User Story 2 - Controllers Have Zero Business Logic (Priority: P2)

As a **developer**, I want all business logic to be moved from Controllers/Routes to the Service and Rules layers so that the codebase is maintainable, testable, and follows the "Single Direction of Truth" principle.

**Why this priority**: Dumb controllers are a prerequisite for the "State Projection" frontend pattern. If controllers have logic, the frontend will inevitably duplicate it.

**Independent Test**: Review the `InventoryController`. It should have no `if/else` statements related to business rules. All validation is delegated to the Service layer.

**Acceptance Scenarios**:

1.  **Given** the `InventoryController.adjustStock` method, **When** reviewed, **Then** it contains only: (a) Extract data from `req.body`, (b) Call `InventoryService.adjustStock()`, (c) Return `res.json()`.
2.  **Given** any Controller method, **When** reviewed, **Then** it does NOT contain any of: stock calculations, permission checks beyond RBAC, conditional logic based on company type.

---

### User Story 3 - Services Consult Policy Before Acting (Priority: P2)

As a **developer**, I want every Service method to consult a Policy layer before executing database operations so that Business Shape constraints are enforced consistently and can be easily tested in isolation.

**Why this priority**: This implements the "Policy Layer" concept from the Constitution p.III. It prevents "illegal states" from ever reaching the database.

**Independent Test**: Unit test `InventoryPolicy.canAdjustStock()` in isolation. Verify it returns `false` for `SERVICE` shape companies.

**Acceptance Scenarios**:

1.  **Given** `InventoryService.adjustStock()` is called, **When** the company shape is `SERVICE`, **Then** the method throws a `DomainError` before any repository call is made.
2.  **Given** `SalesService.createSalesOrder()` is called, **When** the company shape is `MANUFACTURING` and the order contains non-WIP items, **Then** the order is processed successfully (Policy allows it).

---

### User Story 4 - Business Shape is First-Class Citizen in Database (Priority: P1)

As a **system operator**, I want the `Company` entity to have a mandatory `businessShape` field so that the system's behavior is permanently tied to a single, immutable business decision.

**Why this priority**: The `BusinessShape` is the "root decision" per the Apple-Like Constitution. All other adaptations are consequences of this choice.

**Independent Test**: Query a `Company` record. The `businessShape` field is present and contains one of: `RETAIL`, `MANUFACTURING`, `SERVICE`.

**Acceptance Scenarios**:

1.  **Given** the `Company` Prisma model, **When** inspected, **Then** it contains a required `businessShape` enum field.
2.  **Given** the database is migrated, **When** a new company is created without a `businessShape`, **Then** the database rejects the insert.
3.  **Given** a company has a `businessShape` set, **When** an API attempts to change it, **Then** the system rejects the update (immutability).

---

### Edge Cases

- What happens when a company's shape is not yet set (during onboarding)? _(Assumption: A default "PENDING" status or a special onboarding flow handles this. The shape becomes immutable once set.)_
- How does the system handle existing data that was created before the shape was enforced? _(Assumption: A data migration will tag existing companies with a default shape, or a manual review process will be required.)_

## Clarifications

### Session 2025-12-16

- Q: Should this refactor include missing foundational schema (SystemConfig, Warehouse, Product enhancements)? → A: **Option B - Full Foundation**: Add `BusinessShape` + `SystemConfig` + `Warehouse` model + Enhance `Product` with all missing fields.
- Q: Default costing method for existing products during migration? → A: **Option C - Shape-Based**: Retail = AVG, Manufacturing = FIFO, Service = N/A (no inventory costing).
- Q: Default BusinessShape for existing companies during migration? → A: **Option A - PENDING**: Use a temporary "PENDING" shape that forces manual selection via admin flow. Blocks operations until resolved.
- Q: Should this refactor include the backend endpoint for shape selection? → A: **Option A - Include Endpoint**: Create `POST /company/select-shape` (backend only, no UI). Allows setting shape once (immutable after).
- Q: Should shape selection auto-seed configuration? → A: **Option A - Auto-Seed**: Automatically create default `SystemConfig` entries and seed a shape-appropriate Chart of Accounts.
- Design Decision: **Costing Method Strategy** → **AVG as Default, FIFO as Advanced Option**. MVP uses AVG (simpler, faster, scalable). FIFO support prepared via `stock_layer` table structure but not exposed in MVP UI. Product.costingMethod field exists but defaults to shape-based assignment.
- Design Decision: **Roadmap Positioning** → This refactor is **Phase 0 (Foundation)**. See [ROADMAP.md](../../docs/apple-like-development/ROADMAP.md) for full phase breakdown.

### Out of Scope (Deferred to Later Phases)

| Feature                 | Deferred To  |
| ----------------------- | ------------ |
| Reservation             | Phase 2 (v1) |
| Stock Transfer          | Phase 2 (v1) |
| Approval Flow           | Phase 2 (v1) |
| FIFO Costing (Active)   | Phase 3 (v2) |
| Onboarding UI           | Phase 2 (v1) |
| Manufacturing (BOM, WO) | Phase 3 (v2) |
| Reporting Intelligence  | Phase 3 (v2) |

### Costing Method Technical Notes (Reference)

**AVG (Weighted Average)**:

- Update formula: `new_avg = ((old_qty × old_avg) + (in_qty × in_price)) / total_qty`
- Data structure: `Product.stockQty`, `Product.averageCost`
- Suitable for: Retail, high-SKU operations

**FIFO (First-In First-Out)**:

- Requires: `stock_layer` table with `product_id`, `qty_remaining`, `unit_cost`, `received_at`
- Each sale loops oldest layers first
- Suitable for: Manufacturing, expensive goods, audit-heavy industries

**Implementation Rule**: Never calculate HPP in frontend or controller. HPP calculation MUST live in Service/Rules layer.

## Requirements _(mandatory)_

### Functional Requirements

**Schema Foundation**:

- **FR-001**: System MUST define a `BusinessShape` enum (`PENDING`, `RETAIL`, `MANUFACTURING`, `SERVICE`) in `packages/shared`. `PENDING` blocks all business operations until a shape is selected.
- **FR-002**: The `Company` Prisma model MUST include a `businessShape` field of the `BusinessShape` enum type.
- **FR-010**: System MUST create a `SystemConfig` table for feature toggles (e.g., `enableReservation`, `enableMultiWarehouse`, `enableApprovalFlow`, `accountingBasis`).
- **FR-011**: System MUST create a `Warehouse` model (`id`, `companyId`, `code`, `name`, `address`, `isActive`).
- **FR-012**: The `Product` model MUST be enhanced with: `categoryId` (optional FK), `unitOfMeasure` (string), `costingMethod` (enum: FIFO, AVG), `isService` (boolean).
- **FR-013**: System MUST create a `ProductCategory` model for product categorization.
- **FR-014**: The `InventoryMovement` model MUST be linked to `Warehouse` via `warehouseId`.

**Policy Layer**:

- **FR-003**: Every module requiring shape-based constraints MUST have a `*.policy.ts` file.
- **FR-004**: All Service methods MUST call a Policy check before executing Repository operations.
- **FR-005**: The Request Context (`req.company`) MUST include the `businessShape` loaded from the database.
- **FR-006**: Controllers MUST NOT contain conditional business logic (only HTTP mapping).
- **FR-007**: Policy files MUST be stateless and unit-testable in isolation.

**Refactor Scope**:

- **FR-008**: The `Inventory` module MUST be refactored as the "prototype" for the new architecture.
- **FR-009**: The `Sales` module MUST be refactored following the Inventory prototype (Modular Parity).
- **FR-015**: System MUST provide a `POST /company/select-shape` endpoint that sets `businessShape` (immutable once set, rejects if already non-PENDING).
- **FR-016**: When shape is selected via FR-015, system MUST auto-seed: (a) default `SystemConfig` for that shape, (b) shape-appropriate Chart of Accounts.
- **FR-017**: HPP (Cost of Goods Sold) calculation MUST live in Service/Rules layer. FORBIDDEN in Controller or Frontend.
- **FR-018**: Database schema MUST be prepared for future FIFO support by creating a `StockLayer` table (`id`, `productId`, `warehouseId`, `qtyRemaining`, `unitCost`, `receivedAt`). MVP uses AVG but structure is ready.

### Key Entities _(include if feature involves data)_

- **Company**: Extended with `businessShape` (enum) to define the operational mode.
- **SystemConfig**: New table for feature toggles per company.
- **Warehouse**: New entity for multi-warehouse stock tracking.
- **ProductCategory**: New entity for product categorization.
- **Product**: Enhanced with `categoryId`, `unitOfMeasure`, `costingMethod`, `isService`.
- **StockLayer**: New table for future FIFO support (batch/layer tracking with `qtyRemaining`, `unitCost`, `receivedAt`).
- **InventoryPolicy**: New class encapsulating stock-related Business Shape rules.
- **SalesPolicy**: New class encapsulating sales-related Business Shape rules.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All Controller files in `apps/api/src/modules/` have fewer than 5 lines of conditional logic (`if/else`).
- **SC-002**: 100% of Service methods in `Inventory` and `Sales` modules call a corresponding Policy method before any Repository call.
- **SC-003**: At least 3 distinct Business Shape restrictions (e.g., WIP for Retail, Stock for Service, Negative Stock for Manufacturing) are actively enforced and return clear Domain Errors.
- **SC-004**: `npx tsc --noEmit` passes with zero errors after refactoring.
- **SC-005**: Existing unit tests continue to pass (no regressions).

## Constitution Compliance _(mandatory for frontend features)_

### Technical Architecture Checklist (Part A)

- [x] **Feature Isolation**: N/A (Backend only feature)
- [x] **Schema-First**: `BusinessShape` enum defined in `packages/shared` via Zod.
- [x] **Backend Layers**: Full compliance with Route → Controller → Service → Policy → Repository.
- [x] **Multi-Tenant**: All queries scoped by `companyId`.

### Human Experience Checklist (Part B - Principles XIV-XVII)

- [x] **Simplicity & Clarity**: N/A (Backend only feature, but enables frontend simplicity).
- [x] **Clear Navigation**: N/A.
- [x] **Simplified Workflows**: N/A.
- [x] **Assistance**: N/A.
- [x] **Zero-Lag**: Enforced. Policy checks add negligible overhead.
- [x] **Pixel Perfection**: N/A.
