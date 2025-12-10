# Feature Specification: Company Selection Screen

**Feature Branch**: `003-company-selection`  
**Created**: 2025-12-10  
**Status**: Draft  
**Input**: User description: "Redirect to company selection page after login"

## Clarifications

### Session 2025-12-10

- Q: How should the system handle users who have just registered or belong to no companies? → A: Show the Company Selection screen with options to "Create Company" or "Join Company".
- Q: How does the "Join Company" mechanism work? → A: User enters a unique Invite Code provided by an admin.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Select Company after Login (Priority: P1)

As a user with access to multiple companies, I want to see a list of my companies immediately after logging in, so that I can choose which company's data I want to work with.

**Why this priority**: Essential for multi-tenancy support. Users need a clear way to switch contexts before entering the application.

**Independent Test**: Can be tested by logging in with a user account assigned to multiple companies and verifying redirection to the company list instead of the dashboard.

**Acceptance Scenarios**:

1. **Given** a user is on the login page, **When** they successfully authenticate, **Then** they are redirected to the Company Selection screen.
2. **Given** a user is on the Company Selection screen, **When** they click on a company card/button, **Then** the application context updates to that company and they are redirected to the Dashboard.
3. **Given** a user is on the Company Selection screen, **When** they view the list, **Then** only companies they are authorized to access are displayed.

---

### User Story 2 - Switch Company from Dashboard (Priority: P2)

As a user, I want to be able to return to the company selection screen from the main application, so that I can switch work contexts without logging out.

**Why this priority**: Provides flexibility for users managing multiple businesses.

**Independent Test**: Verify navigation from the top navbar/profile menu to the company selection page.

**Acceptance Scenarios**:

1. **Given** a logged-in user is on the Dashboard, **When** they click specific "Switch Company" action (e.g. in the company dropdown), **Then** they are taken back to the Company Selection screen.

---

### User Story 3 - Onboard New User (Priority: P1)

As a new user without any companies (or a user wanting to add one), I want options to create a new company or join an existing one, so that I can start using the application.

**Why this priority**: Critical for self-service onboarding. Without this, new registrations are dead ends.

**Independent Test**: Register a new account and verify the landing page offers creation/joining options.

**Acceptance Scenarios**:

1. **Given** a user with no companies, **When** they reach the Company Selection screen, **Then** they see "Create Company" and "Join Company" buttons prominently.
2. **Given** a user with existing companies, **When** they reach the Company Selection screen, **Then** they see their list of companies AND actions to create/join another.
3. **Given** a user selects "Join Company", **When** they enter a valid Invite Code, **Then** they are added to the company and redirected to its dashboard.

### Edge Cases

- **User has only one company**: System should still show the selection screen (or auto-direct if configured, but default to show for consistency).
- **User has no companies**: System must NOT show an error, but rather the "Create/Join" empty state.
- **Session expiry**: If session expires while on selection screen, redirect to login.
- **Invalid Invite Code**: System should display a clear error message if the entered code is nonexistent or expired.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST redirect users to the Company Selection page (`/select-company` or similar) immediately after successful login.
- **FR-002**: Company Selection page MUST display a list of all companies associated with the authenticated user.
- **FR-003**: System MUST NOT allow access to protected Dashboard routes until a company is selected (or `currentCompany` context is valid).
- **FR-004**: Selecting a company MUST persist the selection (e.g., in client state/context or local storage) for the active session.
- **FR-005**: If a user tries to access a protected route without a selected company, the system MUST redirect them to the Company Selection page (unless they are also unauthenticated, then Login).
- **FR-006**: Company Selection page MUST provide clear actions to "Create New Company" and "Join Existing Company".
- **FR-007**: If the user has no companies, the list area MUST display a friendly empty state encouraging them to create or join one.
- **FR-008**: The "Join Company" feature MUST validate a provided Invite Code against the database and grant access if valid.

### Key Entities

- **Company**: Represents the business entity. Attributes: Name, ID, Access Level (implied).
- **User**: The authenticated actor.
- **Invite Code**: A unique token associated with a Company (or Role within Company) used for joining.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of successful logins for multi-company users redirect to Company Selection page first.
- **SC-002**: Users can select a company and reach the dashboard in under 2 clicks from the selection screen.
- **SC-003**: Protected routes are inaccessible without an active company context.
