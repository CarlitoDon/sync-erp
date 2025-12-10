# Research: Company Selection Feature

**Decision 1: Routing Strategy**

- **Decision**: Use a dedicated `/select-company` route.
- **Rationale**: Keeps the URL structure clean and distinct from the main app (`/`) or auth (`/login`). It allows for a specific "no company selected" state that is authenticated but not yet authorized for tenant data.
- **Alternatives**:
  - Modal on Dashboard: Complex to manage empty dashboard state and security.
  - Dropdown only: Doesn't solve the "initial login" ambiguity.

**Decision 2: State Persistence**

- **Decision**: Persist `companyId` in `localStorage` and syncing with `CompanyContext`.
- **Rationale**: Survives page refreshes.
- **Alternatives**:
  - URL Param (e.g. `/app/:companyId/dashboard`): cleaner REST-wise but requires massive refactor of all existing routes.
  - Session/Cookie only: Harder to read from client-side code immediately without an API call.

**Decision 3: Invite Code Implementation**

- **Decision**: Simple random string stored on `Company` model (e.g. `inviteCode`).
- **Rationale**: Minimal complexity for MVP. Easy to share.
- **Alternatives**:
  - Email invitations (SendGrid etc.): Too complex for MVP.
  - Signed JWT links: Overkill for now.

**Decision 4: Join Flow**

- **Decision**: "Join" action asks for code -> API validates -> Adds User to Company -> Returns new Company object.
- **Rationale**: Atomic operation. Immediate feedback.
