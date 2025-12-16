# Apple-Style ERP Onboarding: UI Flow Diagram

> "One step. One decision. One impact."

This document details the screen-by-screen flow for the onboarding process. It is designed as a specification for implementation, defining states, primary actions, and system effects.

## Global Rules

- **Viewport**: Full screen (Modal or dedicated layout).
- **Navigation**: No sidebar. No settings menu.
- **Actions**: One primary action per screen. Optional, non-distracting secondary actions.
- **Progress**: Implicit markers (e.g., dots or subtle bar), never a checklist.
- **Back Navigation**: Allowed only for _Identity_ and _Business Shape_.

---

## Screen Flow

### SCREEN 0 — Entry Gate

**Status Check**:

- If `company.status == NOT_INITIALIZED` → **Start Onboarding**
- If `company.status == ACTIVE` → **Go to Dashboard**

### SCREEN 1 — Welcome

```text
┌──────────────────────────────────┐
│                                  │
│  This ERP adapts to how          │
│  you work.                       │
│                                  │
│          [ Continue ]            │
│                                  │
└──────────────────────────────────┘
```

- **Primary Action**: Continue.
- **System Effect**: Initialize `onboarding_session`. No data mutation.

### SCREEN 2 — Identity (Role Declaration)

```text
┌──────────────────────────────────┐
│ Who are you in this business?    │
│                                  │
│  [ Owner ]   [ Finance ]         │
│                                  │
│  [ Ops ]     [ Sales ]           │
│                                  │
│        [ Continue ]              │
└──────────────────────────────────┘
```

- **Primary Action**: Select Role → Continue.
- **System Effect**:
  - Set `user.primary_role`.
  - Precompute sidebar visibility (role-locked).
  - Adjust UI language tone.

### SCREEN 3 — Business Shape (Opinionated Fork)

```text
┌──────────────────────────────────┐
│ What do you sell?                │
│                                  │
│ [ Retail Products ]              │
│ [ Manufactured Products ]        │
│ [ Services ]                     │
│                                  │
│        [ Continue ]              │
└──────────────────────────────────┘
```

- **Constraint**: Single selection only.
- **System Effect**: Generate Business Profile.
  - **Logic**: Set Inventory Logic.
  - **Costing**: Set Default Method (Average vs FIFO).
  - **Finance**: Select CoA Template.
  - **Modules**: Enable core modules only.

### SCREEN 4 — Invisible Configuration

```text
┌──────────────────────────────────┐
│ Setting things up…               │
│                                  │
│  • Accounts                      │
│  • Inventory logic               │
│  • Reporting                     │
│                                  │
│   (Animated subtle progress)     │
└──────────────────────────────────┘
```

- **User Action**: None (Auto-advance).
- **System Effect**:
  - Create Chart of Accounts.
  - **Defaults**: HPP method, Approval OFF, Lock Period OFF.
  - Create system policies.

### SCREEN 5 — Core Data: Product (Minimal)

```text
┌──────────────────────────────────┐
│ Add your first product           │
│                                  │
│ Name        [___________]        │
│ Type        [ Goods ▼ ]          │
│ Price       [ Optional ]         │
│                                  │
│ [ Continue ]                     │
│ [ Skip for now ]                 │
└──────────────────────────────────┘
```

- **Soft Gate**: Product creation is optional.
- **System Effect**:
  - If input provided: Create minimal product record.
  - **Defaults**: No SKU, No Category.

### SCREEN 6 — Cash Reality (Opening Balance)

```text
┌──────────────────────────────────┐
│ How much money do you have       │
│ today?                           │
│                                  │
│ Cash     [___________]           │
│ Bank     [___________]           │
│                                  │
│        [ Continue ]              │
└──────────────────────────────────┘
```

- **Hard Gate**: Must submit value (0 is allowed).
- **System Effect**:
  - Create Opening Balance Journal.
  - Initialize Cash & Bank Ledgers.

### SCREEN 7 — First Transaction (Guided Mode)

```text
┌──────────────────────────────────┐
│ Let's record your first          │
│ purchase                         │
│                                  │
│  ➜ Create Purchase               │
│                                  │
│ (Everything else disabled)       │
└──────────────────────────────────┘
```

- **Sub-flow**: Create Purchase (Modal) → Receive Item → Done.
- **System Effect**:
  - Create real transaction.
  - Update stock level.
  - Auto-create journal entry.
  - _Constraint_: No edit allowed in this mode.

### SCREEN 8 — "System Is Alive" Moment

```text
┌──────────────────────────────────┐
│ You're set up.                   │
│                                  │
│ Inventory    12 items            │
│ Value        $ 1,200             │
│ Cash left    $ 5,000             │
│                                  │
│    [ Start Using ERP ]           │
└──────────────────────────────────┘
```

- **Purpose**: Confidence reinforcement.
- **Content**: Real data from previous steps.

### SCREEN 9 — Transition to Dashboard

```text
┌──────────────────────────────────┐
│ Inventory Dashboard              │
│                                  │
│  (Clean, calm, minimal)          │
│                                  │
│  Badge: "Set up complete"        │
└──────────────────────────────────┘
```

- **System Effect**:
  - `company.status = ACTIVE`
  - Close onboarding session.
  - Unlock Sidebar.

---

## Flow Summary

1.  Welcome
2.  Identity
3.  Business Shape
4.  System Setup (Invisible)
5.  Product (Optional)
6.  Cash Balance
7.  First Transaction
8.  Alive Moment
9.  Dashboard

- **Total Decisions**: 4
- **Target Time**: ≤ 10 minutes

## Engineering Notes

1.  **State Management**: Each screen corresponds to a distinct state in the onboarding machine.
2.  **Navigation**: No skipping hard gates (Cash Balance).
3.  **Persistance**: All mutations are event-based; data is saved as steps complete.
