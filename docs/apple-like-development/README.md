# Apple-Like Development Series

This directory contains the foundational documents for the "Apple-Like" pivot of Sync ERP. These documents define the philosophy, architecture, and operational rules for building an opinionated, user-centric ERP.

## Directory Structure

```
docs/apple-like-development/
├── README.md              # This index
├── ROADMAP.md             # Master phase plan (0→1→2→3)
├── philosophy/            # Core principles (archived)
│   └── CONSTITUTION.md    # Human-Centered Design philosophy
├── onboarding/            # Onboarding flow design
│   ├── BLUEPRINT.md       # Progressive onboarding experience
│   ├── FLOW-DIAGRAM.md    # Screen-by-screen UI specification
│   └── STATE-MACHINE.md   # States, gates, and transitions
├── implementation/        # Technical implementation guides
│   ├── ADAPTATION.md      # Business shape decision tree
│   ├── ARCHITECTURE-MAP.md# Monorepo structure mapping
│   └── MODULE-EXAMPLE.md  # Gold standard module reference
├── reviews/               # Phase gate reviews
│   ├── PHASE_0_REVIEW.md  # Foundation review
│   └── PHASE_1_REVIEW.md  # MVP review
└── archive/               # Completed/superseded docs
    ├── IMPLEMENTATION-PLAN.md
    ├── IMPLEMENTATION-CHECKLIST.md
    └── REFACTOR-PLAN.md
```

## Reading Order

### 1. Philosophy & Vision

- **[ROADMAP.md](./ROADMAP.md)** — Phase plan: MVP → v1 → v2
- **[philosophy/CONSTITUTION.md](./philosophy/CONSTITUTION.md)** — Core principles (now merged to `.agent/rules/constitution.md`)

### 2. Onboarding Design

- **[onboarding/BLUEPRINT.md](./onboarding/BLUEPRINT.md)** — Progressive onboarding flow
- **[onboarding/FLOW-DIAGRAM.md](./onboarding/FLOW-DIAGRAM.md)** — Screen-by-screen UI spec
- **[onboarding/STATE-MACHINE.md](./onboarding/STATE-MACHINE.md)** — State machine for XState/Backend

### 3. Implementation

- **[implementation/ADAPTATION.md](./implementation/ADAPTATION.md)** — Retail/Manufacturing/Service decision tree
- **[implementation/ARCHITECTURE-MAP.md](./implementation/ARCHITECTURE-MAP.md)** — Turbo monorepo structure
- **[implementation/MODULE-EXAMPLE.md](./implementation/MODULE-EXAMPLE.md)** — Gold standard: Inventory module

### 4. Phase Reviews

- **[reviews/PHASE_0_REVIEW.md](./reviews/PHASE_0_REVIEW.md)** — Foundation gate review ✅
- **[reviews/PHASE_0_CRITICAL_AUDIT.md](./reviews/PHASE_0_CRITICAL_AUDIT.md)** — 🔴 Gap analysis & hard gate checklist
- **[reviews/PHASE_1_REVIEW.md](./reviews/PHASE_1_REVIEW.md)** — MVP gate review ✅

---

## Core Mandates

- **Decision Lives Once**: Business Shape selection controls 100+ downstream behaviors
- **UI is Consequence**: Frontend only projects backend state; no business logic
- **Invisible Complexity**: System handles CoA, Tax, Costing automatically
