# Feature Specification: Backend Shared Validation

**Feature Branch**: `013-backend-shared-validation`  
**Created**: 2025-12-13  
**Status**: Draft  
**Input**: "Unify backend controllers to use shared types and validation from @sync-erp/shared. Update user, invoice, and bill controllers to use centralized schemas instead of local definitions."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Consistent API Validation (Priority: P1)

As a developer, I want all API endpoints to validate request payloads using centralized schemas from `@sync-erp/shared`, so that validation logic is consistent between frontend and backend, reducing bugs caused by payload mismatches.

**Why this priority**: This is the core value proposition - eliminating duplicate validation logic and ensuring type safety across the entire stack.

**Independent Test**: Can be tested by sending invalid payloads to any updated endpoint and verifying that validation error messages match the shared schema definitions.

**Acceptance Scenarios**:

1. **Given** a user controller with local `InviteUserSchema`, **When** it is updated to use `@sync-erp/shared` schema, **Then** the endpoint still validates email and name fields identically.
2. **Given** an invoice controller accepting `req.body` directly, **When** validation is added via `CreateInvoiceSchema`, **Then** invalid requests return structured 400 errors.
3. **Given** a bill controller with no validation, **When** validation is added, **Then** the endpoint rejects payloads missing required fields.

---

### User Story 2 - Standardized Error Responses (Priority: P2)

As an API consumer, I want validation errors to follow a consistent format across all endpoints, so that I can handle errors uniformly in the frontend.

**Why this priority**: Consistent error handling improves developer experience and reduces frontend error handling complexity.

**Independent Test**: Send invalid payloads to user, invoice, and bill endpoints and verify all return the same error structure with field-level validation messages.

**Acceptance Scenarios**:

1. **Given** an invalid email in user invite request, **When** the request is sent, **Then** the response includes `{ success: false, error: { message: "...", details: [...] } }` format.
2. **Given** a missing required field in invoice creation, **When** the request is sent, **Then** the error response identifies the specific missing field.

---

### User Story 3 - Remove Local Schema Duplication (Priority: P3)

As a maintainer, I want all local schema definitions in the backend to be replaced with imports from `@sync-erp/shared`, so that schema updates only need to happen in one place.

**Why this priority**: Reduces maintenance burden and prevents schema drift between codebases.

**Independent Test**: Verify that `user.controller.ts` no longer contains local `InviteUserSchema` or `AssignUserSchema` definitions.

**Acceptance Scenarios**:

1. **Given** `user.controller.ts` with local schemas, **When** refactored, **Then** no `z.object()` calls exist in the file.
2. **Given** the shared package, **When** a schema is updated there, **Then** the backend automatically uses the new validation rules.

---

### Edge Cases

- What happens when a shared schema is missing from `@sync-erp/shared`? (Add it first)
- How does the system handle validation of optional fields vs required fields?
- What happens when the shared package version is out of sync?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `user.controller.ts` MUST import `InviteUserSchema` from `@sync-erp/shared` instead of defining it locally.
- **FR-002**: `user.controller.ts` MUST use `AssignRoleSchema` from `@sync-erp/shared` for role assignment validation.
- **FR-003**: `invoice.controller.ts` MUST validate request body using `CreateInvoiceSchema` from `@sync-erp/shared` before processing.
- **FR-004**: `bill.controller.ts` MUST validate request body using appropriate schema from `@sync-erp/shared`.
- **FR-005**: All validation errors MUST return HTTP 400 with a structured error response.
- **FR-006**: `@sync-erp/shared` MUST export all schemas needed by the backend controllers.
- **FR-007**: Backend MUST rebuild shared package types before running type checks.

### Key Entities

- **Shared Schema**: Zod schema definitions in `packages/shared/src/validators/` that define input validation rules.
- **Controller**: Express route handlers in `apps/api/src/modules/` that receive and process HTTP requests.
- **Validation Middleware**: Logic that parses and validates `req.body` against a schema.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of backend controllers use shared schemas for input validation (no local `z.object()` definitions in controllers).
- **SC-002**: All endpoints with request bodies validate input before processing.
- **SC-003**: Validation error responses follow a consistent structure across all endpoints.
- **SC-004**: Zero type errors when running `npx tsc --noEmit` in `apps/api` after changes.
- **SC-005**: Existing API tests continue to pass after refactoring.

## Scope

### In Scope

- `apps/api/src/modules/user/user.controller.ts`
- `apps/api/src/modules/accounting/controllers/invoice.controller.ts`
- `apps/api/src/modules/accounting/controllers/bill.controller.ts`
- `packages/shared/src/validators/` (add missing schemas if needed)

### Out of Scope

- Refactoring controllers that already use shared schemas
- Adding new validation to endpoints that don't accept request bodies
- Frontend changes (already using shared types)

## Assumptions

- The `@sync-erp/shared` package is already configured as a dependency of `apps/api`.
- All required schemas either exist in shared or will be added as part of this feature.
- The existing error handling middleware can handle Zod validation errors.
