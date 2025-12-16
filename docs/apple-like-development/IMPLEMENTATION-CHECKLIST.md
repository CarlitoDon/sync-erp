# Apple-Like Implementation Checklist

This checklist tracks the execution of the "Core Integrity First" strategy.

> **Legend**:
>
> - [x] Todo
> - [/] In Progress
> - [x] Done

---

## Phase 1: Constitutional Foundation (Shared & DB)

We must define the "Business Shape" before we can enforce it.

- [x] **1.1 Shared Contract**
  - [x] Create `BusinessShape` enum in `packages/shared/src/types/company.ts` (`RETAIL` | `MANUFACTURING` | `SERVICE`).
  - [x] Export `BusinessShape` from root `packages/shared/src/index.ts`.
  - [x] Run `npm run build` in `packages/shared`.

- [x] **1.2 Database Schema**
  - [x] Update `Company` model in `packages/database/prisma/schema.prisma` to include `shape` (Enum) and `status` (Enum).
  - [x] Run `npx prisma migrate dev --name add_business_shape`.
  - [x] Run `npx prisma generate`.

- [x] **1.3 Request Context**
  - [x] Update `apps/api/src/types/express.d.ts` to include `shape` in `req.company`.
  - [x] Update `authMiddleware` to load the shape into the request object.

---

## Phase 2: The Vertical Refactor (Module: Inventory)

We use **Inventory** as the prototype for the new "Policy-Driven" architecture.

- [x] **2.1 File Structure**
  - [x] Rename/Move existing files in `apps/api/src/modules/inventory/`.
  - [x] Create folder structure: `entities/`, `dto/`, `rules/`, `policy/`.

- [x] **2.2 Policy Layer (New)**
  - [x] Create `inventory.constants.ts`.
  - [x] Create `inventory.policy.ts` with methods like `canCreateWIP()`, `canTrackStock()`.

- [x] **2.3 Rules Layer (New)**
  - [x] Extract logic from Service to `rules/stockRule.ts` (e.g. `ensureAvailable()`).
  - [x] Extract logic to `rules/reservationRule.ts`.

- [x] **2.4 Service Refactor**
  - [x] Rewrite `InventoryService` to inject `InventoryPolicy`.
  - [x] Enforce: `policy.ensureCan(ACTION)` before every method.
  - [x] Replace direct logic with `Rules` calls.

- [x] **2.5 Controller Refactor**
  - [x] Ensure `InventoryController` has ZERO business logic.
  - [x] Ensure it uses the new Service.

---

## Phase 3: The Mirror Refactor (Module: Sales)

Apply the same pattern to Sales to verify "Modular Parity".

- [x] **3.1 Structure & Policy**
  - [x] Create `sales.policy.ts`.
  - [x] Define "Retail Sales" vs "Service Sales" constraints.

- [x] **3.2 Service Refactor**
  - [x] Refactor `SalesService` to use Policy.
  - [x] Ensure Sales triggers Inventory (via Event/Call) respecting the shape.

---

## Phase 4: Onboarding (The Configurator)

Now that the core respects the shape, we build the switch.

- [x] **4.1 Backend State Machine**
  - [x] Create `apps/api/src/modules/onboarding/onboarding.machine.ts`.
  - [x] Define transitions: `WELCOME` → `SHAPE_SELECTION` → `SETUP`.

- [x] **4.2 Shape Selection Endpoint**
  - [x] Create `POST /onboarding/select-shape`.
  - [x] Implement: Save to DB + Trigger Default Configuration (e.g. standard COA).

---

## Technical Verification Gates

- [x] **Gate 1**: Can I compile `packages/shared`?
- [x] **Gate 2**: Does `npx tsc --noEmit` pass in `apps/api`?
- [x] **Gate 3**: Can a "Retail" company successfully block a "Manufacturing" action (WIP)?
- [x] **Gate 4**: Can a "Service" company successfully block a stock movement?
