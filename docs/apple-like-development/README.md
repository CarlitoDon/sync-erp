# Apple-Like Development Series

This directory contains the foundational documents for the "Apple-Like" pivot of Sync ERP. These documents define the philosophy, architecture, and operational rules for building an opinionated, user-centric ERP.

## Reading Order

1.  **[CONSTITUTION.md](./CONSTITUTION.md)**
    - _The "Why" and "What"._
    - Defines the core philosophy: Simplicity, Privacy, and Human-Centered Design.
    - Establishes the "Zero-Lag" and "Essentialism" rules.

2.  **[BLUEPRINT.md](./BLUEPRINT.md)**
    - _The "How" (Experience)._
    - Describes the Progressive Onboarding flow.
    - Explains how we move users from an empty state to a "System Alive" state.

3.  **[FLOW-DIAGRAM.md](./FLOW-DIAGRAM.md)**
    - _The UI Specification._
    - Screen-by-screen breakdown of the onboarding interface.
    - Defines actions, system effects, and implicit progress.

4.  **[STATE-MACHINE.md](./STATE-MACHINE.md)**
    - _The Logic Core._
    - Formal definition of states, gates (Hard/Soft), and transitions.
    - Ready for implementation in XState or Backend workflows.

5.  **[ADAPTATION.md](./ADAPTATION.md)**
    - _The Architectural Decision Tree._
    - Details how the system structurally adapts for **Retail**, **Manufacturing**, or **Service**.
    - Lists active/hidden modules and accounting defaults per shape.

6.  **[ARCHITECTURE-MAP.md](./ARCHITECTURE-MAP.md)**
    - _The Implementation Guide._
    * Maps these concepts into the actual Turbo Monorepo structure.
    * Defines folder paths (`apps/api/src/onboarding/`), database schemas, and code boundaries.

7.  **[IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)**
    - _The Execution Strategy._
    - Proposes "Onboarding-Driven Development" (ODD).
    - Argues for building Onboarding _first_ to act as the system factory.

8.  **[REFACTOR-PLAN.md](./REFACTOR-PLAN.md)**
    - _The Backend Hardening Strategy._
    * Prioritizes strengthening the Core Backend _before_ Onboarding.
    * Introduces the "Policy Layer" concept to enforce Business Shape constraints.

9.  **[MODULE-EXAMPLE.md](./MODULE-EXAMPLE.md)**
    - _The "Gold Standard" Usage._
    * A deep-dive into the **Inventory Module** as a reference implementation.
    * Shows exact folder structure, file roles, and event flow.

10. **[IMPLEMENTATION-CHECKLIST.md](./IMPLEMENTATION-CHECKLIST.md)**
    - _The Tracker._
    - A step-by-step checklist to execute the "Core-First" strategy.
    - Covers Database, Shared Types, Inventory Refactor, and Onboarding groundwork.

## Core Mandates

- **Decision Lives Once**: The Business Shape selection controls 100+ downstream system behaviors.
- **UI is Consequence**: Frontend only projects backend state; it contains no business logic.
- **Invisible Complexity**: The system handles complex accounting setup (CoA, Tax, Costing) automatically based on the Business Shape.
