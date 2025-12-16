# Apple-Like Implementation Checklist

This checklist tracks the execution of the "Core Integrity First" strategy.

> **Legend**:
>
> - [ ] Todo
> - [/] In Progress
> - [x] Done

---

## Phase 1: Constitutional Foundation (Shared & DB)

We must define the "Business Shape" before we can enforce it.

- [ ] **1.1 Shared Contract**
  - [ ] Create `BusinessShape` enum in `packages/shared/src/types/company.ts` (`RETAIL` | `MANUFACTURING` | `SERVICE`).
  - [ ] Export `BusinessShape` from root `packages/shared/src/index.ts`.
  - [ ] Run `npm run build` in `packages/shared`.

- [ ] **1.2 Database Schema**
  - [ ] Update `Company` model in `packages/database/prisma/schema.prisma` to include `shape` (Enum) and `status` (Enum).
  - [ ] Run `npx prisma migrate dev --name add_business_shape`.
  - [ ] Run `npx prisma generate`.

- [ ] **1.3 Request Context**
  - [ ] Update `apps/api/src/types/express.d.ts` to include `shape` in `req.company`.
  - [ ] Update `authMiddleware` to load the shape into the request object.

---

## Phase 2: The Vertical Refactor (Module: Inventory)

We use **Inventory** as the prototype for the new "Policy-Driven" architecture.

- [ ] **2.1 File Structure**
  - [ ] Rename/Move existing files in `apps/api/src/modules/inventory/`.
  - [ ] Create folder structure: `entities/`, `dto/`, `rules/`, `policy/`.

- [ ] **2.2 Policy Layer (New)**
  - [ ] Create `inventory.constants.ts`.
  - [ ] Create `inventory.policy.ts` with methods like `canCreateWIP()`, `canTrackStock()`.

- [ ] **2.3 Rules Layer (New)**
  - [ ] Extract logic from Service to `rules/stockRule.ts` (e.g. `ensureAvailable()`).
  - [ ] Extract logic to `rules/reservationRule.ts`.

- [ ] **2.4 Service Refactor**
  - [ ] Rewrite `InventoryService` to inject `InventoryPolicy`.
  - [ ] Enforce: `policy.ensureCan(ACTION)` before every method.
  - [ ] Replace direct logic with `Rules` calls.

- [ ] **2.5 Controller Refactor**
  - [ ] Ensure `InventoryController` has ZERO business logic.
  - [ ] Ensure it uses the new Service.

---

## Phase 3: The Mirror Refactor (Module: Sales)

Apply the same pattern to Sales to verify "Modular Parity".

- [ ] **3.1 Structure & Policy**
  - [ ] Create `sales.policy.ts`.
  - [ ] Define "Retail Sales" vs "Service Sales" constraints.

- [ ] **3.2 Service Refactor**
  - [ ] Refactor `SalesService` to use Policy.
  - [ ] Ensure Sales triggers Inventory (via Event/Call) respecting the shape.

---

## Phase 4: Onboarding (The Configurator)

Now that the core respects the shape, we build the switch.

- [ ] **4.1 Backend State Machine**
  - [ ] Create `apps/api/src/modules/onboarding/onboarding.machine.ts`.
  - [ ] Define transitions: `WELCOME` → `SHAPE_SELECTION` → `SETUP`.

- [ ] **4.2 Shape Selection Endpoint**
  - [ ] Create `POST /onboarding/select-shape`.
  - [ ] Implement: Save to DB + Trigger Default Configuration (e.g. standard COA).

---

## Technical Verification Gates

- [ ] **Gate 1**: Can I compile `packages/shared`?
- [ ] **Gate 2**: Does `npx tsc --noEmit` pass in `apps/api`?
- [ ] **Gate 3**: Can a "Retail" company successfully block a "Manufacturing" action (WIP)?
- [ ] **Gate 4**: Can a "Service" company successfully block a stock movement?
