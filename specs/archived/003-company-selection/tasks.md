---
description: 'Task list for Company Selection feature'
---

# Tasks: Company Selection Screen

**Input**: Design documents from `specs/003-company-selection/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Verify project structure and dependencies in `apps/web` and `apps/api`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Update Prisma schema to add `inviteCode` to `Company` model in `packages/database/prisma/schema.prisma`
- [x] T003 Run DB migration `npx prisma migrate dev`
- [x] T004 Define shared types (`Company`, `CreateCompanyDto`, `JoinCompanyDto`) in `packages/shared/src/types/company.ts`
- [x] T005 Create Zod validators for create/join payloads in `packages/shared/src/validators/company.ts`
- [x] T006 Implement `create` and `join` methods in `apps/api/src/services/CompanyService.ts`
- [x] T007 Implement company routes (`list`, `create`, `join`) in `apps/api/src/routes/company.ts`
- [x] T008 Update `apps/api/src/index.ts` to register new company routes
- [x] T009 Implement frontend `companyService` in `apps/web/src/services/companyService.ts`
- [x] T010 Update `CompanyContext` to support strictly nullable `currentCompany` and persistence in `apps/web/src/contexts/CompanyContext.tsx`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Select Company after Login (Priority: P1) 🎯 MVP

**Goal**: Users see a list of companies after login and must select one to proceed.

**Independent Test**: Login as multi-company user -> verify redirection to `/select-company` -> select company -> verify dashboard access.

### Implementation for User Story 1

- [x] T011 [US1] Create `CompanySelectionPage` component in `apps/web/src/pages/CompanySelectionPage.tsx`
- [x] T012 [P] [US1] Implement list of available companies in `apps/web/src/pages/CompanySelectionPage.tsx`
- [x] T013 [US1] Update `LoginPage` to redirect to `/select-company` on success in `apps/web/src/pages/LoginPage.tsx`
- [x] T014 [US1] Update `ProtectedRoute` to redirect to `/select-company` if context is missing in `apps/web/src/components/ProtectedRoute.tsx`
- [x] T015 [US1] Add `/select-company` route to `apps/web/src/App.tsx`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 3 - Onboard New User (Priority: P1)

**Goal**: New users can Create or Join a company from the selection screen.

**Independent Test**: Register new user -> see Create/Join options -> successfully create new company -> verify dashboard.

### Implementation for User Story 3

- [x] T016 [US3] Add "Create Company" form/modal to `apps/web/src/pages/CompanySelectionPage.tsx`
- [x] T017 [US3] Add "Join Company" form (Invite Code input) to `apps/web/src/pages/CompanySelectionPage.tsx`
- [x] T018 [US3] Integrate `companyService.create` in `apps/web/src/pages/CompanySelectionPage.tsx`
- [x] T019 [US3] Integrate `companyService.join` in `apps/web/src/pages/CompanySelectionPage.tsx`
- [x] T020 [US3] Add error handling for invalid invite codes in `apps/web/src/pages/CompanySelectionPage.tsx`

**Checkpoint**: At this point, User Stories 1 AND 3 should both work independently

---

## Phase 5: User Story 2 - Switch Company from Dashboard (Priority: P2)

**Goal**: Users can return to selection screen from dashboard.

**Independent Test**: Click "Switch Company" in navbar -> verify redirection -> select different company -> verify new context.

### Implementation for User Story 2

- [x] T021 [US2] Add "Switch Company" button/logic to `apps/web/src/components/CompanySwitcher.tsx`
- [x] T022 [US2] Implement navigation to `/select-company` from switcher in `apps/web/src/components/CompanySwitcher.tsx`

**Checkpoint**: All user stories should now be independently functional

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T023 [P] Add empty state for users with no companies (friendly message)
- [x] T024 Verify session expiry behavior on selection screen
- [x] T025 Run quickstart.md validation steps manually

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### Parallel Opportunities

- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Different user stories can be worked on in parallel by different team members
