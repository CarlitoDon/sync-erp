# Data Model: Sidebar Navigation

**Feature**: 004-sidebar  
**Date**: 2025-12-10

## Overview

This feature is purely presentational and does not require database changes. The "data model" consists of frontend-only types and state.

---

## Frontend Types

### NavigationItem

Represents a single navigation link in the sidebar.

```typescript
interface NavigationItem {
  path: string; // Route path (e.g., "/suppliers")
  label: string; // Display text (e.g., "Suppliers")
  icon: ReactNode; // Icon component or element
}
```

**Source**: Derived from existing `navLinks` array in `Layout.tsx`.

---

### SidebarState

Represents the current state of the sidebar.

```typescript
interface SidebarState {
  isCollapsed: boolean; // true = icons only, false = full width
  isOpen: boolean; // Mobile only: true = sidebar visible
}
```

**Persistence**: `isCollapsed` persisted to `localStorage` under key `sidebar_collapsed`.

---

## State Transitions

```
Desktop:
  [Expanded] --click toggle--> [Collapsed]
  [Collapsed] --click toggle--> [Expanded]

Mobile:
  [Hidden] --click hamburger--> [Open/Overlay]
  [Open/Overlay] --click link--> [Hidden]
  [Open/Overlay] --click outside--> [Hidden]
  [Open/Overlay] --click close--> [Hidden]
```

---

## No Database Changes

This feature does not modify:

- Prisma schema
- Backend services
- API contracts

All state is client-side only.
