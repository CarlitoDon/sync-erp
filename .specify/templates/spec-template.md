# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: User description: "$ARGUMENTS"

## User Scenarios & Testing _(mandatory)_

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Verified via Integration Testing
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Integration Scenario**: [Describe how this can be verified via integration test - e.g., "Full flow from [trigger] to [DB record] and [UI update]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements _(mandatory)_

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

_Example of marking unclear requirements:_

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities _(include if feature involves data)_

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria _(mandatory)_

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]

## Constitution & Architecture Compliance _(mandatory)_

<!--
  ACTION REQUIRED: Verify compliance with Constitution v3.1.0.
  See `.agent/rules/constitution.md` for full details.
-->

### Backend Architecture (Apps/API) - Principles I, II, III

- [ ] **5-Layer Architecture**: Logic strictly follows Route → Controller → Service → Policy → Repository.
- [ ] **Schema-First**: All new fields defined in `packages/shared` Zod schemas first.
- [ ] **Multi-Tenant**: All DB queries scoped by `companyId`.
- [ ] **Service Purity**: Service layer DOES NOT import `prisma` (uses Repository only).
- [ ] **Policy & Rules**: Business constraints in Policy, pure logic in `rules/`.
- [ ] **Repository Purity**: No business logic in Repository (Data access only).

### Frontend Architecture (Apps/Web) - Principles IV, XI

- [ ] **Feature Isolation**: Logic in `src/features/[domain]` (not global).
- [ ] **No Business Logic**: Components do not calculate state (render `backendState` only).
- [ ] **API Patterns**: Using `apiAction()` helper (never direct toast/try-catch).
- [ ] **User Safety**: Using `useConfirm()` hook (never `window.confirm`).
- [ ] **State Projection**: UI reflects exact backend state without optimistic guessing (unless specific policy).

### Testing & Quality - Principles XV, XVII

- [ ] **Integration Tests**: Full business flow covered in single `it()` block.
- [ ] **Mock Compliance**: Mocks satisfy all Policy/Service contract expectations.
- [ ] **Financial Precision**: All assertions use `Number()` or `Decimal` aware checks.
- [ ] **Zero-Lag**: No interaction freezes the main thread.
