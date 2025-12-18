---
description: 'Task list template for feature implementation'
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Integration tests are MANDATORY for all business flows. Unit tests are optional and reserved for isolated pure logic.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.

  The /speckit-tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/

  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment

  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per implementation plan
- [ ] T002 Initialize [language] project with [framework] dependencies
- [ ] T003 [P] Configure linting and formatting tools

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your project):

- [ ] T004 Setup `packages/database` with Prisma schema
- [ ] T005 [P] Create `packages/shared` for Types/DTOs (Zod)
- [ ] T006 [P] Configure `apps/api` with Express and npm workspace links
- [ ] T007 [P] Configure `apps/web` with Vite and npm workspace links
- [ ] T008 Setup Turbo pipeline for build/dev
- [ ] T009 Implement Auth Middleware in `apps/api` (Multi-Tenant)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1 (OPTIONAL - only if tests requested) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T011 [P] [US1] Integration test for [user journey] in tests/integration/test\_[name].test.ts

### Implementation for User Story 1

- [ ] T012 [P] [US1] Create [Entity1] model in src/models/[entity1].py
- [ ] T013 [P] [US1] Create [Entity2] model in src/models/[entity2].py
- [ ] T014 [US1] Implement [Service] in src/services/[service].py (depends on T012, T013)
- [ ] T015 [US1] Implement [endpoint/feature] in src/[location]/[file].py
- [ ] T016 [US1] Add validation and error handling
- [ ] T017 [US1] Add logging for user story 1 operations

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2 (OPTIONAL - only if tests requested) ⚠️

- [ ] T019 [P] [US2] Integration test for [user journey] in tests/integration/test\_[name].test.ts

### Implementation for User Story 2

- [ ] T012 [P] [US1] Define DTOs in `packages/shared/src/types/[entity].ts`
- [ ] T013 [P] [US1] Add Prisma model in `packages/database/prisma/schema.prisma`
- [ ] T014 [US1] Create Repository in `apps/api/src/repositories/[repository].ts`
- [ ] T015 [US1] Create Policy in `apps/api/src/modules/[domain]/[domain].policy.ts` (Business Shape Rules)
- [ ] T016 [US1] Implement Service in `apps/api/src/services/[service].ts` (Checks Policy + Uses Repository)
- [ ] T017 [US1] Implement Controller in `apps/api/src/controllers/[controller].ts` (Dumb HTTP Adapter)
- [ ] T018 [US1] Create UI in `apps/web/src/features/[domain]/components/[component].tsx` (State Projection)
- [ ] T019 [US1] Integration in `apps/web/src/features/[domain]/services/[api].ts`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3 (OPTIONAL - only if tests requested) ⚠️

- [ ] T025 [P] [US3] Integration test for [user journey] in tests/integration/test\_[name].test.ts

### Implementation for User Story 3

- [ ] T026 [P] [US3] Create [Entity] model in src/models/[entity].py
- [ ] T027 [US3] Implement [Service] in src/services/[service].py
- [ ] T028 [US3] Implement [endpoint/feature] in src/[location]/[file].py

**Checkpoint**: All user stories should now be independently functional

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N-1: UI Components & Patterns (Frontend Features)

**Purpose**: Shared UI infrastructure that enables consistent frontend development

**⚠️ Constitution Compliance**: This phase implements Principles VI, VII, VIII

- Adopts Feature-Based Architecture (`src/features/`)

### Reusable Components (UI Atoms)

- [ ] TXXX [P] Create `ActionButton` component in `apps/web/src/components/ui/ActionButton.tsx`
- [ ] TXXX [P] Create `ConfirmModal` in `apps/web/src/components/ui/ConfirmModal.tsx`
- [ ] TXXX [P] Create `DataTable` component if table patterns are repeated

### Global Hooks & Utilities

- [ ] TXXX [P] Create `useApiAction` hook in `apps/web/src/hooks/useApiAction.ts`
- [ ] TXXX [P] Create `useCompanyData` hook in `apps/web/src/hooks/useCompanyData.ts`
- [ ] TXXX Setup global error toast in Axios interceptor (`apps/web/src/services/api.ts`)

### Systematic Updates

- [ ] TXXX Grep and replace all inline button styles with `ActionButton`
- [ ] TXXX Grep and replace all `window.confirm()` with `useConfirm()`
- [ ] TXXX Grep and replace all try-catch toast patterns with `apiAction()`
- [ ] TXXX Verify no remaining instances (grep validation)

**Checkpoint**: All frontend patterns consistent across application

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Documentation updates in docs/
- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Performance optimization across all stories
- [ ] TXXX [P] Additional integration coverage in tests/integration/
- [ ] TXXX Security hardening
- [ ] TXXX Run quickstart.md validation

### Task Completion Verification (Constitution Principles VIII & IX) ⚠️

> **CRITICAL**: These verification steps MUST pass before marking feature complete

- [ ] TXXX TypeScript check: `npx tsc --noEmit` (verify zero errors)
- [ ] TXXX Check `typecheck:watch` terminal (if running) for errors
- [ ] TXXX Full build: `npm run build` (verify all packages build)
- [ ] TXXX If `packages/shared` modified: rebuild before checking dependents
- [ ] TXXX Schema-first: New API fields exist in Zod schema, types use `z.infer`

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
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (if tests requested):
Task: "Contract test for [endpoint] in tests/contract/test_[name].py"
Task: "Integration test for [user journey] in tests/integration/test_[name].py"

# Launch all models for User Story 1 together:
Task: "Create [Entity1] model in src/models/[entity1].py"
Task: "Create [Entity2] model in src/models/[entity2].py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
