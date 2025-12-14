# Feature Specification: Refactor Frontend Architecture to Feature-Based Structure

**Feature Branch**: `011-frontend-feature-refactor`  
**Created**: 2025-12-12  
**Status**: Draft  
**Input**: User description: "Refactor Frontend Architecture to Feature-Based Structure (apps/web)"

## User Scenarios & Testing

### User Story 1 - Feature Directory Structure (Priority: P1)

As a developer, I want to organize the codebase by business domain (features) so that related code (pages, components, services, hooks) is co-located, making the application easier to maintain and scale.

**Why this priority**: This is the foundation of the refactor. Without the structure, code cannot be moved.

**Independent Test**: Verify that the directory structure exists and `apps/web/vite.config.ts` (if using aliases) or imports are updated to support it. Verify that tests in `apps/web/test/` still pass.

**Acceptance Scenarios**:

1. **Given** the current flat structure, **When** I browse `src/features`, **Then** I should see directories for `auth`, `finance`, `sales`, `procurement`, `inventory`, `company`, `partners`.
2. **Given** generic UI components, **When** I browse `src/components`, **Then** I should see `ui` and `layout` subdirectories.

---

### User Story 2 - Migration of Business Logic (Priority: P1)

As a developer, I want to move existing domain-specific logic from `src/pages`, `src/services`, and global `src/components` into their respective `src/features/[domain]` folders to enforce the constitution's Feature-Based Architecture.

**Why this priority**: Essential for achieving the architectural goal.

**Independent Test**: Build the application and run all existing tests. There should be no compilation errors and no regression in functionality.

**Acceptance Scenarios**:

1. **Given** `FinancialReport.tsx` and `financeService.ts`, **When** the refactor is complete, **Then** they should reside in `src/features/finance` (e.g., `src/features/finance/components/FinancialReport.tsx`, `src/features/finance/services/financeService.ts`).
2. **Given** global `api.ts`, **When** refactor is complete, **Then** it should Remain in `src/services/api.ts` or `src/lib/api.ts` as it is a global utility.
3. **Given** `src/pages/Finance.tsx`, **When** refactor is complete, **Then** it should be a thin wrapper importing the view from `src/features/finance`.

---

## Requirements

### Functional Requirements

- **FR-001**: The Frontend (`apps/web`) MUST adopt a Feature-Based Architecture with `src/features/` as the root for business domains.
- **FR-002**: The following domains MUST be created: `auth`, `finance`, `sales`, `procurement`, `inventory`, `company`, `partners`, `shared` (for cross-feature logic), `dashboard` (optional).
- **FR-003**: `src/components` MUST be restructured into `src/components/ui` (atoms, no logic) and `src/components/layout` (structural).
- **FR-004**: All page components in `src/pages/` MUST be refactored to be thin routing wrappers. Actual page logic/views MUST move to `src/features/[domain]/pages/` or `views/`.
- **FR-005**: Domain-specific services (e.g., `authService`, `financeService`) MUST be moved to `src/features/[domain]/services/`.
- **FR-006**: Global configuration (e.g., `api.ts`) MUST remain in global `src/services/`.
- **FR-007**: All application import paths MUST be updated to reflect the new location of files.
- **FR-008**: **CRITICAL**: All test files in `apps/web/test/` MUST be updated to match the new paths and imports so tests do not break.
- **FR-009**: The application MUST build successfully without type errors.

## Clarifications

### Session 2025-12-12

- Q: Where should shared logic-bearing components reside? → A: Create `src/features/shared`.
- Q: How should routing definitions be managed? → A: Centralized (Option B). Keep routes in `src/App.tsx` or `src/routes.tsx` importing from features.

## Constitution Compliance

### Frontend Architecture Checklist

- [x] **Feature Isolation**: Logic in `src/features` (not global pages/components)
- [x] **Component Abstraction**: Any repeated UI pattern extracted to reusable `ui` component
- [x] **Hook Abstraction**: Any repeated logic extracted to custom hook
- [x] **No Copy-Paste**: No duplicate button styles, error handling, or API patterns
- [x] **Global Error Handling**: Errors handled via Axios interceptor, not per-page try-catch
- [x] **Success Toasts**: Using `apiAction()` helper, not direct toast imports
- [x] **Confirmation Dialogs**: Using `useConfirm()` hook, not native `window.confirm()`
- [x] **Systematic Updates**: All instances updated when changing patterns (grep verified)
