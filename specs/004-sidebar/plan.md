# Implementation Plan: Sidebar Navigation

**Branch**: `004-sidebar` | **Date**: 2025-12-10 | **Spec**: [spec.md](file:///c:/Offline/Coding/sync-erp/specs/004-sidebar/spec.md)
**Input**: Feature specification from `/specs/004-sidebar/spec.md`

## Summary

Implement a persistent vertical sidebar navigation component that replaces the current horizontal header navigation links. The sidebar will support collapse/expand functionality with state persistence, and adapt responsively for mobile devices with a hamburger menu. The simplified header will retain logo, user info, and logout only.

## Technical Context

**Language/Version**: TypeScript 5.x + React 18  
**Primary Dependencies**: React Router v6, React Context API, Tailwind CSS (or vanilla CSS)  
**Storage**: localStorage (for sidebar state persistence)  
**Testing**: Vitest + React Testing Library  
**Target Platform**: Web (Desktop + Mobile browsers)  
**Project Type**: Monorepo (apps/web frontend)  
**Performance Goals**: Sidebar collapse/expand transition < 300ms  
**Constraints**: Must work without JavaScript for basic navigation (fallback header)  
**Scale/Scope**: 9 navigation items, ~5 new components

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Boundaries**: Frontend-only change; no direct DB imports.
- [x] **II. Dependencies**: No new package dependencies on apps.
- [x] **III. Contracts**: No new shared types required (uses existing NavItem pattern).
- [x] **IV. Layered Backend**: N/A - No backend changes.
- [x] **V. Multi-Tenant**: N/A - Navigation is context-agnostic (CompanySwitcher already handles context).

## Project Structure

### Documentation (this feature)

```text
specs/004-sidebar/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # N/A for this feature
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── components/
│   │   ├── Layout.tsx           # [MODIFY] Integrate Sidebar, simplify header
│   │   ├── Sidebar.tsx          # [NEW] Main sidebar component
│   │   ├── SidebarNav.tsx       # [NEW] Navigation items list
│   │   ├── SidebarItem.tsx      # [NEW] Individual nav link with icon
│   │   ├── SidebarToggle.tsx    # [NEW] Collapse/expand button
│   │   └── MobileMenuButton.tsx # [NEW] Hamburger toggle for mobile
│   ├── hooks/
│   │   └── useSidebarState.ts   # [NEW] State management hook with localStorage
│   ├── contexts/
│   │   └── SidebarContext.tsx   # [NEW] Optional context for global state
│   └── styles/
│       └── sidebar.css          # [NEW] Sidebar-specific styles (if not Tailwind)
└── index.css                    # [MODIFY] Add sidebar CSS variables if needed
```

**Structure Decision**: Frontend-only implementation in `apps/web`. New components follow existing patterns (functional components, hooks for state). Sidebar context is optional but recommended for clean prop drilling avoidance.

## Complexity Tracking

> No Constitution violations. Simple frontend feature with no architectural concerns.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |
