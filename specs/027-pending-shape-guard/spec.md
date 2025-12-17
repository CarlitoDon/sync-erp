# Feature Specification: PENDING Shape Guard

**Feature Branch**: `027-pending-shape-guard`  
**Created**: 2025-12-17  
**Status**: Draft  
**Input**: User description: "Central PENDING shape guard middleware to block operations until business shape is selected"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Block Operations for PENDING Companies (Priority: P1)

A company is created but the business owner has not yet selected a business shape (RETAIL, DISTRIBUTION, MANUFACTURING). Until this selection is made, the company should be blocked from performing any business operations that could create inconsistent data.

**Why this priority**: This is the core requirement—preventing data corruption when shape-specific rules haven't been established.

**Independent Test**: Create a new company, skip shape selection, attempt to create a product/invoice/journal—all should be blocked with clear error message.

**Acceptance Scenarios**:

1. **Given** a company with `businessShape = PENDING`, **When** any business operation endpoint is called (create product, create order, create journal, etc.), **Then** the request is rejected with HTTP 400 and message "Operations blocked until business shape is selected"
2. **Given** a company with `businessShape = PENDING`, **When** the user accesses read-only endpoints (view dashboard, list existing data), **Then** the request succeeds normally
3. **Given** a company with `businessShape = RETAIL`, **When** any business operation endpoint is called, **Then** the request proceeds normally

---

### User Story 2 - Clear User Guidance (Priority: P2)

When a user with a PENDING company tries to perform a blocked operation, they should receive guidance on how to resolve the issue (complete shape selection).

**Why this priority**: Good UX ensures users understand what's wrong and how to fix it.

**Independent Test**: Trigger a blocked operation and verify the error message includes actionable next steps.

**Acceptance Scenarios**:

1. **Given** a blocked operation due to PENDING shape, **When** the error is displayed, **Then** the message includes "Please complete company setup" with navigation guidance
2. **Given** a PENDING company, **When** the user logs into the dashboard, **Then** a prominent banner indicates shape selection is required

---

### User Story 3 - Admin Override Capability (Priority: P3)

System administrators may need to perform certain operations on PENDING companies for support purposes.

**Why this priority**: Operational edge case for support scenarios.

**Independent Test**: Admin user successfully performs operation on PENDING company; regular user is blocked.

**Acceptance Scenarios**:

1. **Given** a system admin role, **When** operating on a PENDING company, **Then** the guard allows specific administrative operations
2. **Given** a regular user, **When** operating on a PENDING company, **Then** the guard blocks the operation regardless of user role

---

### Edge Cases

- What happens when shape selection is in progress (race condition)?
- How does system handle companies with corrupted/null shape values?
- What operations are explicitly allowed for PENDING companies (e.g., shape selection itself)?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a centralized guard that checks company `businessShape` before allowing write operations
- **FR-002**: System MUST reject operations with HTTP 400 and clear error message when company shape is PENDING
- **FR-003**: System MUST allow read operations (GET requests) regardless of company shape
- **FR-004**: System MUST allow shape selection operation itself for PENDING companies
- **FR-005**: System MUST cover all business operation endpoints including:
  - Product management (create, update, delete)
  - Order management (sales, procurement)
  - Inventory operations (adjustments, movements)
  - Accounting operations (invoices, bills, journals, payments)
- **FR-006**: Error response MUST include guidance directing users to complete company setup

### Allowed Operations for PENDING Companies

The following operations MUST remain allowed:

- Shape selection endpoint
- Company profile read
- User profile management
- Dashboard view (read-only)
- Logout

### Key Entities

- **Company**: Has `businessShape` attribute (PENDING, RETAIL, DISTRIBUTION, MANUFACTURING)
- **Request Context**: Must include company information with shape for guard to evaluate

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of write operations on PENDING companies are blocked (no gaps)
- **SC-002**: Error message is understood by 95% of users (includes clear next action)
- **SC-003**: Guard adds less than 5ms overhead to request processing
- **SC-004**: Zero data corruption incidents due to PENDING shape operations (audit trail shows no gaps)

## Assumptions

- Company shape is loaded as part of the authentication middleware and available in request context
- The existing scattered policy checks will be kept as secondary validation (defense in depth)
- Shape selection wizard is already implemented and functional

## Out of Scope

- Shape-specific negative stock rules (covered in separate A2 item)
- Per-shape configuration system
- Migration of existing PENDING companies (handled separately)
