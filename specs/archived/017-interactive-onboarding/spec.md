# Feature Specification: Interactive Getting Started Guide

**Feature Branch**: `17-interactive-onboarding`  
**Created**: 2025-12-14  
**Status**: Draft  
**Input**: User description: "buat getting started di dashboard beneran jadi fungsional bisa tracking, bisa di klik, bisa jadi guidance new user"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - New User Sees Clear Onboarding Steps (Priority: P1) 🎯 MVP

A new user logs in and sees a Getting Started guide on their dashboard that shows exactly what steps they need to complete to set up their company. Each step has a clear status (completed/pending), a description, and can be clicked to navigate directly to the relevant page.

**Why this priority**: This is the core value - providing visual guidance for new users to understand what they need to do next. Without clickable navigation, the checklist is just informational.

**Independent Test**: Log in as a new user with no data, verify checklist shows all steps as pending, click on a step and verify navigation to correct page.

**Acceptance Scenarios**:

1. **Given** a new user with an empty company, **When** they view the dashboard, **Then** they see a Getting Started card with all onboarding steps listed with pending status (○)
2. **Given** a user viewing an incomplete step, **When** they click on the step, **Then** they are navigated to the relevant page to complete that action
3. **Given** a user has completed some steps, **When** they return to dashboard, **Then** completed steps show checkmark (✓) and pending steps show circle (○)

---

### User Story 2 - Progress Tracking Persists Across Sessions (Priority: P2)

The system tracks which onboarding steps a user has completed based on actual data in the system (products created, customers added, orders made, etc.) rather than manual checkbox tracking. This ensures the progress is always accurate and reflects real usage.

**Why this priority**: Accurate tracking builds trust - users see their actual progress, not just what they clicked. This prevents confusion where users think they completed something but haven't actually done it.

**Independent Test**: Create a product, refresh the dashboard, verify the "Add products" step is marked complete.

**Acceptance Scenarios**:

1. **Given** a user has created at least one product, **When** they view the dashboard, **Then** the "Add products" step shows as completed
2. **Given** a user has added at least one supplier, **When** they view the dashboard, **Then** the "Set up suppliers" step shows as completed
3. **Given** a user has created at least one sales order, **When** they view the dashboard, **Then** the "Create first order" step shows as completed
4. **Given** all onboarding steps are completed, **When** they view the dashboard, **Then** they see a success message or the Getting Started section is minimized/hidden

---

### User Story 3 - Progressive Disclosure with Step Details (Priority: P3)

Users can expand each step to see more details about what that step involves and why it's important. This helps users understand the value of each action before taking it.

**Why this priority**: Adds polish and education but not essential for core functionality. Users can complete onboarding without needing to understand "why" each step matters.

**Independent Test**: Click an expand icon on a step, verify description text appears, click again to collapse.

**Acceptance Scenarios**:

1. **Given** a user viewing the Getting Started card, **When** they click on the expand icon for a step, **Then** additional detail text about that step appears
2. **Given** a step is expanded, **When** they click the expand icon again, **Then** the details collapse and hide

---

### Edge Cases

- What happens when user completes all onboarding steps? → Show congratulations message, option to hide/dismiss the Getting Started card
- What happens when user deletes all products after completing step? → Step reverts to pending status (data-driven tracking)
- What happens when user belongs to multiple companies? → Onboarding progress is per-company, switching company shows that company's progress
- What happens on mobile/small screens? → Steps stack vertically, remain clickable and readable

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display an Onboarding Progress component on the Dashboard
- **FR-002**: Each onboarding step MUST show its current status: completed (✓) or pending (○)
- **FR-003**: Each onboarding step MUST be clickable and navigate to the relevant page
- **FR-004**: System MUST determine step completion status based on actual data:
  - "Create company" → completed if user has at least one company
  - "Add products" → completed if company has at least one product
  - "Set up suppliers" → completed if company has at least one supplier partner
  - "Set up customers" → completed if company has at least one customer partner
  - "Create first order" → completed if company has at least one sales or purchase order
  - "Set up chart of accounts" → completed if company has at least one account
- **FR-005**: System MUST persist onboarding progress per company (not per user)
- **FR-006**: Completed steps MUST show visual distinction from pending steps (color, icon)
- **FR-007**: System MUST show overall progress indicator (e.g., "3 of 6 completed")
- **FR-008**: User MUST be able to dismiss/minimize the Getting Started card after completion
- **FR-009**: Each step SHOULD have expandable details explaining the action and its benefit

### Key Entities

- **OnboardingStep**: Represents a single step in the onboarding flow (id, title, description, targetPath, isCompleted)
- **OnboardingProgress**: Aggregated progress state for a company (completedSteps, totalSteps, allComplete)

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: New users can complete first action within 2 clicks from dashboard (click step → perform action)
- **SC-002**: 100% of onboarding steps are clickable and navigate to correct pages
- **SC-003**: Progress indicator accurately reflects actual data state (no stale/incorrect status)
- **SC-004**: 80% of new users complete at least 3 onboarding steps within first session
- **SC-005**: Getting Started section renders correctly on mobile devices (320px width minimum)

## Constitution Compliance _(mandatory for frontend features)_

### Frontend Architecture Checklist

- [ ] **Feature Isolation**: Logic in `src/features/dashboard` (onboarding component)
- [ ] **Component Abstraction**: OnboardingStep component extracted as reusable UI
- [ ] **Hook Abstraction**: useOnboardingProgress hook for status checking
- [ ] **No Copy-Paste**: Step navigation logic centralized
- [ ] **Global Error Handling**: Errors handled via Axios interceptor
- [ ] **Success Toasts**: Using `apiAction()` helper where applicable
- [ ] **Confirmation Dialogs**: Using `useConfirm()` hook for dismissing Getting Started
- [ ] **Systematic Updates**: All instances updated when changing patterns

## Assumptions

- Dashboard is only shown when user has selected a company (X-Company-Id header is set)
- The existing dashboard already fetches metrics including products count and pending orders
- Navigation uses react-router-dom's Link or useNavigate hook
- Onboarding completion does not require backend API - determined purely from existing data endpoints
