# Apple-Style Architecture Map for Sync ERP

> "Decision lives once. UI is consequence. State > CRUD."

This document maps the Apple-style constitution, onboarding blueprint, and business shape adaptation into the existing Turbo monorepo structure. It defines folder structures, code boundaries, and runtime flows.

## 0. Foundational Principles

Before touching code, these laws must live in the codebase:

1.  **Decision Lives Once**: The "Business Shape" decision happens once and controls the entire system forever.
2.  **UI is Consequence**: Frontend does not configure the system; it reflects backend state.
3.  **State > CRUD**: The system is driven by state machines and events, not just data entry endpoints.

## 1. Technical Translation of Constitution

| Constitution               | Technical Implementation                                |
| :------------------------- | :------------------------------------------------------ |
| **Opinionated**            | Backend dictates defaults (e.g., Costing Method).       |
| **Simplicity**             | Modules are _Hidden_ via RBAC/State, not deleted.       |
| **No Knobs**               | Configuration tables exists, but are not exposed to UI. |
| **End-to-End Control**     | Backend State Machine orchestrates flow.                |
| **Progressive Disclosure** | Features are unlocked by successful state transitions.  |

## 2. Monorepo Structure Analysis

Current structure is neutral. We need to add _meaning_ and _opinion_.

```text
apps/
  api        ← Backend Runtime (Needs State Machine)
  web        ← Frontend Runtime (State Projection)
packages/
  database   ← Prisma + Postgres (Source of Truth)
  shared     ← Types + Constants (Contract)
```

**Missing**: Domain Boundaries, Business Shape Enforcement, State Orchestration.

## 3. Domain Layer Implementation

### 3.1 Business Shape as First-Class Citizen

**Location**: `packages/shared/src/constants/business-shape.ts`

```typescript
export type BusinessShape = 'RETAIL' | 'MANUFACTURING' | 'SERVICE';
```

_This is not just an enum; it is the root logic branch._

### 3.2 Database Persistence

**Location**: `packages/database/prisma/schema.prisma`

```prisma
model Company {
  id             String   @id @default(uuid())
  name           String
  businessShape  BusinessShape?
  status         CompanyStatus @default(ONBOARDING)
}
```

_Reasoning_: UI must not "remember" state; API must verify it against DB truth.

## 4. Onboarding as a Backend State Machine

### 4.1 Domain Structure

**Location**: `apps/api/src/modules/onboarding/`

- `onboarding.machine.ts` (The "Law")
- `onboarding.service.ts` (The Executor)
- `onboarding.controller.ts` (The Interface)

### 4.2 Machine Logic (`onboarding.machine.ts`)

```typescript
export type OnboardingState =
  | 'WELCOME'
  | 'ROLE'
  | 'BUSINESS_SHAPE'
  | 'SYSTEM_SETUP'
  | 'PRODUCT' // Variance by shape
  | 'MATERIAL' // Manufacturing only
  | 'OPENING_BALANCE'
  | 'FIRST_TRANSACTION'
  | 'ACTIVE';

function getNextState(current: State, shape: BusinessShape): State {
  // Hard-coded transitions based on constitutional laws
}
```

### 4.3 Shape-Driven Flow

- **Retail**: `PRODUCT` → `OPENING_BALANCE` → `PURCHASE`
- **Manufacturing**: `MATERIAL` → `BOM` → `OPENING_BALANCE` → `PRODUCTION`
- **Service**: `SERVICE_SETUP` → `INVOICE`

_Critical_: Frontend does not know the flow. Frontend asks: "What is next?"

## 5. Backend Implementation (Express)

### 5.1 Dumb Controller

Controller **must not** choose logic sequences.

- **Input**: `POST /onboarding/event { event: "SELECT_SHAPE", payload: "RETAIL" }`
- **Action**: Validation → Machine Transition → Service execution.
- **Output**: New State.

### 5.2 Service as "Apple OS"

The service enforces the "Constitution":

- If _Manufacturing_ but no BOM? **Reject**.
- If _Service_ but creating Inventory? **Reject**.

## 6. Prisma & Database Strategy

### 6.1 Opinionated Guards

Do not use conditional schemas. Use strict Service limitations.

- **Manufacturing**: Code enforces "BOM Required".
- **Retail**: Code enforces "No WIP".

### 6.2 Data Integrity Events

"Opening Balance" is not just `account.balance = x`.
It is an **Immutable Event** → Generates **Journal Entry**.
_Matches Philosophy_: No "magic edits", everything is a recorded action.

## 7. Frontend Implementation (Vite + Tailwind)

### 7.1 UI as State Projection

**Frontend contains NO Business Logic.**

1.  Fetch `currentOnboardingState`.
2.  Render Component mapped to State.
3.  Send Event.

_No logic like_: `if (isManufacturing) showButton()`.
_Instead_: Backend sends `allowedActions`.

### 7.2 State-Driven Routing

```typescript
// Component Mapping
const ScreenMap = {
  WELCOME: WelcomeScreen,
  BUSINESS_SHAPE: BusinessShapeScreen,
  BOM: BomScreen, // Only rendered if backend says we are in BOM state
};
```

## 8. Shared Package Roles

`packages/shared` is **not** a utility dump.

- **Allowed**: Cross-boundary Types, Pure Validators (Zod), Constants.
- **Forbidden**: Business Logic, Prisma code, Express code.

## 9. Turbo Repo Fit

- **Isolation**: Domains can be isolated easily.
- **Single Source**: Shared constants enforce the "Shape" across apps.
- **Boundary**: "Apple-style" requires clear boundaries, which simple monorepos support well.

## 10. The "Apple-Like" Check

1.  **User makes 1 big choice?** ✅
2.  **System makes 100 small decisions?** ✅
3.  **No config pages?** ✅
4.  **Flow cannot be broken by user?** ✅
5.  **UI is calm?** ✅

If these pass, the architecture is correct.
