# Apple-Style ERP Onboarding Blueprint

> An opinionated, progressive, and curated experience that moves the user from "empty account" to "alive system" with calm, certainty, and confidence.

## Core Principles (Non-Negotiable)

1.  **Onboarding is a Product**: It is not a tutorial; it is the first impression of the product itself.
2.  **Defaults over Choices**: Being right by default is better than offering many choices.
3.  **System Learns**: The user doesn't just fill in data; the system is learning their business.
4.  **One Step, One Impact**: Every screen asks for one decision and delivers one clear outcome.

## Global Onboarding Structure

```mermaid
graph LR
    A[Welcome] --> B[Identity]
    B --> C[Business Shape]
    C --> D[Invisible Config]
    D --> E[Core Data]
    E --> F[First Transaction]
    F --> G[System Alive]
    G --> H[Fade Out]
```

**Rule**: The full ERP menu is hidden until onboarding is complete.

## Detailed Flow

### 1. Welcome Screen

**"This ERP adapts to how you work."**

- **View**: Full-screen.
- **Elements**: One sentence. One button: "Continue".
- **Absent**: No forms, no module selection, no checklists.
- **Philosophy**: Don't explain features; explain the promise.

### 2. Identity Setup (Who Are You?)

User declares their role, not modules.

- **Choices**: Owner, Finance, Operations, Sales (Icon-based).
- **Micro-copy**: "You can add others later."
- **System Effect**:
  - Sidebar is locked to the specific role.
  - UI language adapts (removes technical jargon for non-technical roles).

### 3. Business Shape (Opinionated Fork)

One screen. One major decision.

- **Question**: "What do you sell?"
- **Choices**:
  - Products (Retail)
  - Products (Manufacturing)
  - Services
- **Constraint**: No multi-select.
- **Impact**: Determines 80% of default behavior:
  - Chart of Accounts (CoA) template.
  - Inventory logic.
  - Cost flow method.
  - Dashboard KPIs.

### 4. Invisible Configuration (System Thinks for You)

The user perceives this as a loading state, not a step.

- **UI**: "Setting things up..." (Visual silence).
- **System Actions**:
  - Generates default CoA.
  - Sets Costing Method (Average for Retail, FIFO for Mfg).
  - Activates minimum viable modules.
  - Sets approvals to OFF.
- **Constraint**: No checkboxes.

### 5. Core Data Minimal (Just Enough)

Only request what is needed to make the system "alive".

**Step 5.1: Product**

- **Fields**: Name, Type (Goods/Raw Material), Selling Price (Optional).
- **Action**: "Continue without product".
- **Absent**: SKU, Categories (not needed yet).

**Step 5.2: Cash Reality**

- **Question**: "How much money do you have today?"
- **Fields**: Cash, Bank.
- **System Effect**: Silently creates opening balance journal.

### 6. First Transaction (Guided, Real)

The most important moment. Real work, not a demo.

**Example (Retail)**: Create Purchase → Receive Item → See Stock Increase → See Journal Created.

- **UI**: Highlight the primary button. Disable others.
- **Micro-copy**: "This updates your inventory and accounting."
- **Philosophy**: No "General Ledger" terminology on the surface.

### 7. "System Is Alive" Moment

The "Aha!" moment.

- **UI**: "Your inventory is ready."
- **Stats Display**:
  - Stock: 12
  - Inventory Value: $X
  - Cash Remaining: $Y
- **Action**: "Start Using ERP"

### 8. Fade-Out Onboarding

Onboarding disappears, leaving a functional system.

- **State**: Simple Sidebar. Small badge: "You're set up".
- **Guidance**: Contextual tooltips only. No re-tours.

## UX Patterns

1.  **No Settings Page during Onboarding**: Settings are for advanced users. Onboarding is for core decisions.
2.  **Defaults Are Law**:
    - Default HPP method.
    - Approval OFF.
    - Lock period OFF.
    - _User can change these later, but must dig for them._
3.  **Language over Terminology**:
    - Bad: "Create Journal"
    - Good: "Money recorded"
4.  **Visual Silence**: Use whitespace, smooth animations, and avoid massive tables.

## Hard Rules (Onboarding Constitution)

1.  **Context**: User never sees an empty page without context.
2.  **No Acronyms**: User never chooses accounting structure (GAAP/IFRS) at the start.
3.  **Focus**: Max 1 important decision per screen.
4.  **Impact**: System always explains _impact_ (what happens), not _mechanism_ (how it works).
5.  **Speed**: Onboarding must be completable in < 10 minutes.

## Summary

The Apple-like ERP onboarding is **Opinionated**, **Calm**, **Decisive**, and hides complexity (**Invisible Complexity**) to move the user to real work as fast as possible.
