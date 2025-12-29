# Feature Specification: Frontend Code Quality & Performance Improvements

**Feature Branch**: `039-frontend-improvements`  
**Created**: December 29, 2025  
**Status**: Draft  
**Input**: Analysis from `docs/frontend-improvements.md`

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Application Resilience (Priority: P1)

As a user, I want the application to gracefully handle unexpected errors so that I don't lose my work or see a blank screen when something goes wrong.

**Why this priority**: Critical for production stability - without error boundaries, any component error crashes the entire app, potentially losing unsaved work.

**Integration Scenario**: Trigger component error → ErrorBoundary catches → User sees friendly error message with recovery options → User can reload or navigate away without data loss.

**Acceptance Scenarios**:

1. **Given** a component throws an error during render, **When** the error occurs, **Then** the user sees a friendly error message instead of blank screen
2. **Given** an error is displayed, **When** user clicks "Reload", **Then** the page reloads and user can continue working
3. **Given** an error occurs in a nested component, **When** caught by ErrorBoundary, **Then** only the affected section shows error, not the entire app

---

### User Story 2 - Accessible Input Dialogs (Priority: P1)

As a user with accessibility needs, I want input dialogs (for reasons, notes, etc.) to be properly styled, keyboard-navigable, and screen-reader friendly.

**Why this priority**: Current `window.prompt()` usage blocks main thread, isn't accessible, and breaks consistent UX. Required for accessibility compliance.

**Integration Scenario**: User triggers action requiring reason → Styled modal appears with focus trap → User enters text via keyboard → Submits or cancels → Action proceeds or aborts.

**Acceptance Scenarios**:

1. **Given** an action requires user input (e.g., cancel reason), **When** triggered, **Then** a styled modal appears (not browser prompt)
2. **Given** the prompt modal is open, **When** user presses Escape, **Then** the modal closes without action
3. **Given** the prompt modal is open, **When** user tabs, **Then** focus stays within modal (focus trap)
4. **Given** a screen reader, **When** modal opens, **Then** it announces modal title and purpose

---

### User Story 3 - Faster Initial Load (Priority: P2)

As a user, I want the application to load quickly so that I can start working without waiting for all features to download.

**Why this priority**: Impacts first impression and perceived performance. Large ERP with 30+ pages loading eagerly creates unnecessary initial bundle.

**Integration Scenario**: User navigates to app → Only core shell loads → User clicks feature link → Feature code loads on-demand → Feature renders with loading indicator.

**Acceptance Scenarios**:

1. **Given** initial app load, **When** user opens the app, **Then** only essential code (shell, auth) is downloaded initially
2. **Given** user navigates to a feature, **When** feature code is loading, **Then** user sees a loading indicator
3. **Given** a feature is loaded once, **When** user returns to it, **Then** it loads instantly from cache

---

### User Story 4 - Reduced Network Requests (Priority: P2)

As a user, I want the application to be responsive without excessive loading indicators caused by unnecessary data refetching.

**Why this priority**: Improves perceived performance and reduces server load. Currently, queries refetch unnecessarily due to missing staleTime configuration.

**Integration Scenario**: User loads data → Data is cached → User switches tabs/returns → Cached data shows instantly without refetch (within stale window).

**Acceptance Scenarios**:

1. **Given** data is fetched, **When** user navigates away and returns within 30 seconds, **Then** cached data is shown without refetch
2. **Given** data is stale (>30 seconds), **When** user views the data, **Then** background refetch occurs while showing cached data

---

### User Story 5 - Consistent Component Usage (Priority: P3)

As a developer, I want consistent usage of shared UI components so that the codebase is maintainable and styling is uniform.

**Why this priority**: Technical debt reduction. Inconsistent component usage increases maintenance burden and creates visual inconsistencies.

**Integration Scenario**: Developer implements new feature → Uses existing LoadingSpinner, Input, EmptyState components → Visual consistency maintained.

**Acceptance Scenarios**:

1. **Given** a page needs loading state, **When** implemented, **Then** uses shared `LoadingState` component (not inline spinner)
2. **Given** a form needs text input, **When** implemented, **Then** uses shared `Input` component with consistent styling
3. **Given** a list is empty, **When** rendered, **Then** uses shared `EmptyState` component

---

### Edge Cases

- What happens when ErrorBoundary itself throws an error? (Should have fallback to minimal error display)
- How does PromptModal handle very long text input? (Should support multiline with reasonable max length)
- What happens if lazy-loaded chunk fails to load? (Network error boundary with retry option)
- How does staleTime affect real-time data needs? (Per-query override for time-sensitive data)

## Requirements _(mandatory)_

### Functional Requirements

**Error Handling**
- **FR-001**: System MUST wrap application routes in an ErrorBoundary component
- **FR-002**: ErrorBoundary MUST display user-friendly error message with reload option
- **FR-003**: ErrorBoundary MUST log errors to console for debugging

**Prompt Modal**
- **FR-004**: System MUST provide `usePrompt()` hook as replacement for `window.prompt()`
- **FR-005**: PromptModal MUST support title, message, placeholder, and required props
- **FR-006**: PromptModal MUST trap focus within modal while open
- **FR-007**: PromptModal MUST close on Escape key press (returning null)
- **FR-008**: PromptModal MUST be accessible with proper ARIA attributes

**Code Splitting**
- **FR-009**: System MUST lazy-load feature pages (procurement, sales, accounting, inventory)
- **FR-010**: Lazy-loaded routes MUST display loading indicator during chunk load
- **FR-011**: System MUST handle chunk load failures gracefully with retry option

**Query Optimization**
- **FR-012**: tRPC QueryClient MUST configure default staleTime of 30 seconds
- **FR-013**: Time-sensitive queries MAY override default staleTime as needed

**Component Consistency**
- **FR-014**: All loading states MUST use `LoadingState` or `LoadingSpinner` component
- **FR-015**: All form text inputs SHOULD use shared `Input` component
- **FR-016**: All empty list states SHOULD use `EmptyState` component

### Key Entities

- **ErrorBoundary**: React component capturing render errors, displaying fallback UI
- **PromptModal**: Modal component for text input, returning Promise<string | null>
- **usePrompt**: Hook providing promise-based prompt functionality via context

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Zero blank screens from unhandled component errors (100% error boundary coverage)
- **SC-002**: All `window.prompt()` calls replaced with accessible PromptModal (0 occurrences of window.prompt in codebase)
- **SC-003**: Initial bundle size reduced by 30%+ through code splitting
- **SC-004**: Perceived load time improved (no unnecessary loading flickers from refetching)
- **SC-005**: 80%+ of loading states use shared LoadingState component
- **SC-006**: WCAG 2.1 AA compliance for all modal interactions

## Constitution & Architecture Compliance _(mandatory)_

### Backend Architecture (Apps/API) - Principles I, II, III, XXI

- [N/A] **5-Layer Architecture**: Frontend-only feature
- [N/A] **Schema-First**: Frontend-only feature
- [N/A] **Multi-Tenant**: Frontend-only feature
- [N/A] **Service Purity**: Frontend-only feature
- [N/A] **Policy & Rules**: Frontend-only feature
- [N/A] **Repository Purity**: Frontend-only feature
- [N/A] **Anti-Bloat**: Frontend-only feature

### Frontend Architecture (Apps/Web) - Principles IV, XI

- [ ] **Feature Isolation**: ErrorBoundary in `components/`, PromptModal in `components/ui/`
- [ ] **No Business Logic**: Components only handle UI state (error display, input capture)
- [ ] **API Patterns**: N/A for these components
- [ ] **User Safety**: PromptModal replaces unsafe window.prompt
- [ ] **State Projection**: ErrorBoundary projects error state from React error boundary lifecycle

### Testing & Quality - Principles XV, XVII

- [ ] **Integration Tests**: Test ErrorBoundary catches errors, PromptModal returns correct values
- [ ] **Mock Compliance**: N/A
- [ ] **Financial Precision**: N/A
- [ ] **Zero-Lag**: Lazy loading with Suspense prevents UI freeze

## Assumptions

1. React 18+ is used (supports Suspense for lazy loading)
2. Existing `useConfirm()` pattern can be replicated for `usePrompt()`
3. Tailwind CSS is used for styling new components
4. tRPC React Query is the data fetching solution
5. Bundle analyzer will be used to measure code splitting impact

## Out of Scope

- React Hook Form integration (separate initiative)
- Generic DataTable component (separate initiative)
- Full accessibility audit (separate initiative)
- Consolidating Partner pages (requires more refactoring)
- Consolidating PageHeader components (cosmetic improvement)
