# Sync ERP Apple-Style Implementation Plan

> **Strategy Update**: We have pivoted to a **Core-First** approach.
> The previous "Onboarding-First" proposal is replaced by a "Refactor-First" strategy to ensure the backend is robust enough to support the opinionated onboarding.

## The Strategy: "Core Integrity First"

We cannot build a rigid Apple-style onboarding on top of a loose, generic ERP backend. We must first "harden" the core modules to respect the `BusinessShape` before we build the UI that selects it.

---

## Phase 1: The Constitutional Refactor (The Foundation)

**Goal**: Make the system **aware** of its identity (`BusinessShape`) and **enforce** it at the deepest level.

_Reference: `docs/apple-like-development/REFACTOR-PLAN.md`_

### Step 1.1: Shared Contracts & Schema

- Define `BusinessShape` (`RETAIL` | `MANUFACTURING` | `SERVICE`) in `packages/shared`.
- Add `businessShape` to `Company` model in `schema.prisma`.
- Inject `shape` into the Request Context (`req.company.shape`).

### Step 1.2: The Policy Layer Injection

- Create the **Policy Layer** in key modules (Inventory, Accounting).
- Refactor Services to **ALWAYS** check `Policy` before `Repository`.
- _Outcome_: Attempting to generic tasks (e.g. "Create WIP" in Retail) throws a Domain Error, not a DB error.

### Step 1.3: Data Flow Standardization

- Refactor Controllers to be **Dumb Adapters**.
- Refactor Frontend to remove all business logic (no "If Manufacturing then show X").
- _Outcome_: Frontend blindly renders what the Backend State dictates.

---

## Phase 2: The Onboarding "Factory"

**Goal**: Build the Onboarding process as a **Configurator**, not a logic creator.

- Because Phase 1 is done, Onboarding does not need to "create" logic.
- It simply toggles the flags in the Database that the Policy Layer reads.

### Step 2.1: The State Machine

- Implement `onboarding.machine.ts`.
- It acts as a wizard that guides the user to set the initial `BusinessShape`.

### Step 2.2: The Configuration Seeder

- When User selects "Manufacturing", Onboarding service runs:
  ```typescript
  await settingsService.enableFeature('WIP');
  await accountingService.seedChartOfAccounts('MANUFACTURING');
  ```

---

## Phase 3: The Apple-Like UI (State Projection)

**Goal**: Update the frontend to reflect the new strictness.

- **Sidebar**: Hides modules not allowed by the Shape.
- **Forms**: Do not show fields irrelevant to the Shape.
- **Dashboard**: Shows metrics relevant to the Shape.

---

## Order of Execution

1.  **Execute `REFACTOR-PLAN.md`** (We are here).
    - Inventory Module First (as the prototype).
    - Sales Module Second.
2.  **Build Onboarding State Machine**.
3.  **Build UI**.

---

## Legacy Note

_Previous Plan "Onboarding-Driven Development" (ODD) is deprecated in favor of this "Core-Integrity" approach._
