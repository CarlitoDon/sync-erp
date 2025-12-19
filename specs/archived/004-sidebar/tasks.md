---
description: 'Task list for Sidebar Navigation feature'
---

# Tasks: Sidebar Navigation

**Input**: Design documents from `specs/004-sidebar/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Tests are OPTIONAL - not explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Verify project structure matches plan.md in `apps/web`
- [x] T002 [P] Add Heroicons dependency if not present in `apps/web/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create `useSidebarState` hook with localStorage persistence in `apps/web/src/hooks/useSidebarState.ts`
- [x] T004 [P] Create `SidebarContext` provider in `apps/web/src/contexts/SidebarContext.tsx`
- [x] T005 Define navigation items array with icons in `apps/web/src/components/Sidebar.tsx` (or constants file)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Navigate via Sidebar (Priority: P1) 🎯 MVP

**Goal**: Users can navigate between different sections using a persistent vertical sidebar.

**Independent Test**: User logs in, sees sidebar with navigation links, clicks any link, and is taken to the corresponding page with the link highlighted.

### Implementation for User Story 1

- [x] T006 [P] [US1] Create `SidebarItem.tsx` component in `apps/web/src/components/SidebarItem.tsx`
- [x] T007 [P] [US1] Create `SidebarNav.tsx` component (list of items) in `apps/web/src/components/SidebarNav.tsx`
- [x] T008 [US1] Create main `Sidebar.tsx` component in `apps/web/src/components/Sidebar.tsx`
- [x] T009 [US1] Integrate `Sidebar` into `Layout.tsx` with flexbox layout in `apps/web/src/components/Layout.tsx`
- [x] T010 [US1] Simplify header in `Layout.tsx` (remove nav links, keep logo/user/logout) in `apps/web/src/components/Layout.tsx`
- [x] T011 [US1] Add active link highlighting logic to `SidebarItem.tsx` in `apps/web/src/components/SidebarItem.tsx`
- [x] T012 [US1] Add sidebar CSS styles (width, colors, transitions) in `apps/web/src/index.css` or `apps/web/src/styles/sidebar.css`
- [x] T013 [US1] Add CompanySwitcher to sidebar footer in `apps/web/src/components/Sidebar.tsx`
- [x] T014 [US1] Add user info display and logout to sidebar footer in `apps/web/src/components/Sidebar.tsx`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Collapse/Expand Sidebar (Priority: P2)

**Goal**: Users can collapse the sidebar to icons-only mode and expand it back, with state persisted.

**Independent Test**: User clicks collapse button, sidebar shrinks to icons, clicks expand, sidebar returns to full width, refresh page, state persists.

### Implementation for User Story 2

- [x] T015 [P] [US2] Create `SidebarToggle.tsx` button component in `apps/web/src/components/SidebarToggle.tsx`
- [x] T016 [US2] Add collapsed state handling to `Sidebar.tsx` in `apps/web/src/components/Sidebar.tsx`
- [x] T017 [US2] Update `SidebarItem.tsx` to show icon-only when collapsed in `apps/web/src/components/SidebarItem.tsx`
- [x] T018 [US2] Add CSS transition for collapse animation (width, opacity) in `apps/web/src/index.css`
- [x] T019 [US2] Add tooltips on hover for collapsed items in `apps/web/src/components/SidebarItem.tsx`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Responsive Sidebar on Mobile (Priority: P3)

**Goal**: On mobile devices, sidebar is hidden by default and toggleable via hamburger menu.

**Independent Test**: User views app on mobile, taps hamburger, sidebar slides in as overlay, taps link, navigates and sidebar closes.

### Implementation for User Story 3

- [x] T020 [P] [US3] Create `MobileMenuButton.tsx` (hamburger icon) in `apps/web/src/components/MobileMenuButton.tsx`
- [x] T021 [US3] Add mobile-specific state (`isOpen`) to `SidebarContext` in `apps/web/src/contexts/SidebarContext.tsx`
- [x] T022 [US3] Update `Sidebar.tsx` for mobile overlay behavior in `apps/web/src/components/Sidebar.tsx`
- [x] T023 [US3] Add responsive CSS breakpoint (768px) to hide/show sidebar in `apps/web/src/index.css`
- [x] T024 [US3] Add click-outside-to-close logic for mobile sidebar in `apps/web/src/components/Sidebar.tsx`
- [x] T025 [US3] Auto-close sidebar on navigation link click (mobile) in `apps/web/src/components/SidebarItem.tsx`
- [x] T026 [US3] Integrate `MobileMenuButton` into simplified header in `apps/web/src/components/Layout.tsx`

**Checkpoint**: All user stories should now be independently functional

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T027 Verify sidebar adapts when resizing browser from desktop to mobile width (manual test)
- [ ] T028 Run quickstart.md validation steps manually

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 components but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Builds on US1/US2 components but independently testable

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, user story components marked [P] can be parallelized
- T006 and T007 can run in parallel (different components)
- T013 (toggle button) can be built while US1 is in progress

---

## Parallel Example: User Story 1

```bash
# Launch these tasks together (different files):
Task: "Create SidebarItem.tsx component"
Task: "Create SidebarNav.tsx component"

# Then proceed with:
Task: "Create main Sidebar.tsx component" (depends on above)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test sidebar navigation independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test collapse/expand → Deploy/Demo
4. Add User Story 3 → Test mobile → Deploy/Demo
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
