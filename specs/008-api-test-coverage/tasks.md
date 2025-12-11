# Tasks: API Test Coverage

**Input**: Design documents from `/specs/008-api-test-coverage/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, quickstart.md ✅

**Tests**: Not explicitly requested - no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US3)
- Include exact file paths in descriptions

> **Note**: US2 (CI Integration) is DEFERRED per clarification session.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install coverage dependencies

- [ ] T001 Install @vitest/coverage-v8 in apps/api: `cd apps/api && npm install @vitest/coverage-v8 --save-dev`

---

## Phase 2: User Story 1 - Developer Runs Coverage Report (Priority: P1) 🎯 MVP

**Goal**: Enable developers to run `npm run test:coverage` and get coverage reports with 80% threshold enforcement.

**Independent Test**: Run `npm run test:coverage` from `apps/api` and verify:

1. Terminal shows coverage percentages
2. HTML report generates in `apps/api/coverage/`
3. Command fails if coverage < 80%

### Implementation for User Story 1

- [ ] T002 [US1] Create vitest.config.ts in apps/api/vitest.config.ts with: provider v8, thresholds (80% all metrics), exclude patterns, reporters (text, html)
- [ ] T003 [P] [US1] Add test:coverage script to apps/api/package.json
- [ ] T004 [P] [US1] Add coverage/ to apps/api/.gitignore

**Checkpoint**: At this point, `npm run test:coverage` should work with threshold enforcement.

---

## Phase 3: User Story 3 - Developer Identifies Uncovered Code (Priority: P2)

**Goal**: Enable developers to view detailed HTML coverage report with per-file breakdown.

**Independent Test**: Open `apps/api/coverage/index.html` in browser and verify:

1. Navigable list of all source files
2. Clicking a file shows line-by-line coverage
3. Uncovered lines highlighted in red

### Implementation for User Story 3

- [ ] T005 [US3] Verify HTML reporter generates navigable index at apps/api/coverage/index.html
- [ ] T006 [US3] Verify per-file coverage breakdown with line-level highlighting (FR-007)
- [ ] T007 [US3] Document HTML report usage in specs/008-api-test-coverage/quickstart.md

**Checkpoint**: HTML coverage report is fully functional.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Finalize and verify configuration

- [ ] T008 Run npm run test:coverage and verify exit code behavior (pass/fail threshold)
- [ ] T009 Verify coverage report excludes dist/, node_modules/, and test files
- [ ] T010 Update root package.json to add workspace coverage script if needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - install dependency first
- **User Story 1 (Phase 2)**: Depends on Setup - core coverage configuration
- **User Story 3 (Phase 3)**: Depends on US1 - HTML report depends on coverage being configured
- **Polish (Phase 4)**: Depends on US1 and US3 completion

### User Story Dependencies

| Story    | Depends On | Status   |
| -------- | ---------- | -------- |
| US1 (P1) | Setup only | Active   |
| US2 (P3) | US1        | DEFERRED |
| US3 (P2) | US1        | Active   |

### Parallel Opportunities

- T002, T003, T004, T005 can be combined into single vitest.config.ts edit
- T006, T007 can run in parallel (different files)
- T008, T009 can run in parallel (verification vs documentation)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: User Story 1 (T002-T007)
3. **STOP and VALIDATE**: Test `npm run test:coverage` works
4. Continue to US3 if needed

### Single Developer Execution

```bash
# Phase 1
T001 → Install dependency

# Phase 2 (US1 - can consolidate into 2-3 edits)
T002-T005 → Single vitest.config.ts creation
T006 → Update package.json
T007 → Update .gitignore

# Phase 3 (US3)
T008 → Verify HTML report
T009 → Update documentation

# Phase 4
T010-T012 → Final verification
```

---

## Summary

| Metric             | Value                         |
| ------------------ | ----------------------------- |
| **Total Tasks**    | 10                            |
| **US1 Tasks**      | 3                             |
| **US3 Tasks**      | 3                             |
| **Polish Tasks**   | 3                             |
| **Setup Tasks**    | 1                             |
| **Deferred (US2)** | CI integration                |
| **MVP Scope**      | T001-T004 (Phase 1 + Phase 2) |
