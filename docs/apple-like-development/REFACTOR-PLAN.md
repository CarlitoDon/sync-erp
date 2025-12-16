# Backend Refactor Plan: The Constitutional Core

> **Verdict**: Yes, the backend needs refactoring. Not because the structure is wrong, but because it is **not yet opinionated enough** to support the Apple-style ERP + Onboarding.

This document outlines the **precise, minimum-viable refactor** required to move from a "Generic ERP" to an "Opinionated System".

---

## 1. Diagnosis of Current Backend

We are looking at `apps/api/src/modules`.

### 1.1 What is ALREADY CORRECT (Do Not Touch)

- **Domain-Oriented Structure**: Modules like `inventory`, `sales`, `accounting` are correctly separated. This is better than layer-based folding.
- **Auth Separation**: `auth` module is isolated.
- **Middleware**: `middlewares/auth.ts` and `rbac.ts` provides a good foundation.

**Conclusion**: We do _not_ need a "reset". We need to **sharpen the boundaries**.

### 1.2 The Core Problems

1.  **Routes are too "Smart"**: Routes often decide logic or flow. In Apple-style, Routes must be dumb (HTTP → Event only).
2.  **No Home for "Constitution"**: Rules like "Service companies cannot create stock" currently live scattered in Service checks or Configs, rather than a dedicated Policy layer.
3.  **Business Shape is not Root**: The system doesn't enforce `BusinessShape` at the service level, making it possible for "illegal" states to exist (e.g., WIP in a Retail company).

---

## 2. Refactor Strategy: precise & Targeted

We will **not** rewrite Express or Prisma. We will inject a **Policy Layer**.

### 2.1 The "Policy" Layer (The New Concept)

Every critical module gets a `*.policy.ts` file.

**Structure**:

```text
modules/inventory/
  inventory.controller.ts
  inventory.service.ts
  inventory.repository.ts
  inventory.policy.ts   ← NEW
```

**Responsibility of Policy**:
It answers "Can this action happen given the Company's Business Shape?"

- _Retail_ → Forbid `createWIP`.
- _Service_ → Forbid `adjustStock`.
- _Manufacturing_ → Forbid `negativeStock`.

**Rule**: The Service **MUST** consult the Policy before acting.

### 2.2 Shift Logic: Route → Service

- **Current**: Route might check basic params or combine data.
- **Target**: Route only calls `Service.action()`. Service takes full responsibility for validity.

### 2.3 Explicit Business Shape Checks

Access Control (RBAC) is not enough. We need **Shape Control**.

- **RBAC**: "Is this user an Admin?"
- **Policy**: "Is this company allowed to Manufacture?"

Do not mix these. RBAC lives in Middleware. Policy lives in Domain.

---

## 3. The Onboarding Module (Later)

Once the core is sturdy, we add the Onboarding module.

```text
modules/onboarding/
  onboarding.machine.ts
  onboarding.service.ts
  onboarding.controller.ts
```

- It does **not** touch the database directly (mostly).
- It orchestrates the _other_ services to set up the company.

---

## 4. Execution Sequence (The Safe Path)

We will execute this in order to avoid breaking the codebase.

### Step 1: Foundation

1.  Add `BusinessShape` enum to `packages/shared`.
2.  Add `businessShape` column to `Company` in Prisma.
3.  Ensure `req.company` (in Context) includes the `businessShape`.

### Step 2: The Policy Prototypes

1.  Create `inventory.policy.ts`.
2.  Refactor `inventory.service.ts` to use the policy.
3.  Create `accounting.policy.ts`.
4.  Refactor `accounting.service.ts` to use the policy.

### Step 3: Hardening Services

1.  Go through `sales` and `procurement`.
2.  Ensure they respect the new Constraints (e.g., Service companies skip delivery flow).

### Step 4: Onboarding (Finally)

1.  Now that the system rejects illegal actions, we build the Onboarding flow that _only_ calls legal actions.

---

## 5. Success Criteria

- **Dumb Routes**: Controllers/Routes have almost no `if/else`.
- **Strict Services**: Services reject "Generic" operations that don't fit the Shape.
- **Fail Fast**: Errors happen at the Policy check, not database constraint violations.
- **Frontend Relief**: Frontend doesn't need complex validation logic; it just handles the "Not Allowed" response.
