# Research: Backend Shared Validation

**Feature**: 013-backend-shared-validation  
**Date**: 2025-12-13

## Resolved Decisions

### 1. Schema Location Strategy

**Decision**: Use existing `packages/shared/src/validators/` for all schemas.

**Rationale**:

- Constitution Principle III mandates shared types in `packages/shared`.
- Existing modules (product, partner, inventory, etc.) already follow this pattern.
- `InviteUserSchema` was already added during feature 012.

**Alternatives Considered**:

- Local schemas per module (REJECTED - violates Principle III, causes drift)
- Separate validation package (REJECTED - over-engineering for current scope)

---

### 2. Validation Error Handling

**Decision**: Use existing `errorHandler.ts` middleware which already handles ZodError.

**Rationale**:

- `apps/api/src/middlewares/errorHandler.ts` already imports `ERROR_CODES` from shared.
- ZodError instances can be caught and formatted consistently.
- Avoids adding new middleware.

**Alternatives Considered**:

- Per-controller try-catch (REJECTED - DRY violation, inconsistent)
- New validation middleware wrapper (REJECTED - existing error handler sufficient)

---

### 3. Schemas Needed

**Decision**: Use and/or add the following schemas from `@sync-erp/shared`:

| Schema                | Status                 | Used By               |
| --------------------- | ---------------------- | --------------------- |
| `InviteUserSchema`    | ✅ Exists (company.ts) | user.controller.ts    |
| `AssignRoleSchema`    | ✅ Exists (index.ts)   | user.controller.ts    |
| `CreateInvoiceSchema` | ✅ Exists (index.ts)   | invoice.controller.ts |
| `CreateBillSchema`    | ⚠️ May need addition   | bill.controller.ts    |

**Rationale**: Audit confirmed most schemas exist. Only CreateBillSchema may need to be added if bill creation uses different fields than invoice.

---

### 4. Controller Update Pattern

**Decision**: Direct schema import and parse in controller handlers.

**Pattern**:

```typescript
import { InviteUserSchema } from '@sync-erp/shared';

invite = async (req, res, next) => {
  try {
    const data = InviteUserSchema.parse(req.body);
    // ... business logic
  } catch (error) {
    next(error); // errorHandler handles ZodError
  }
};
```

**Rationale**:

- Follows existing patterns in other controllers (procurement, sales).
- No additional abstraction layer needed.
- Type-safe at compile time via z.infer.

---

## Technical Context Resolved

- **Language/Version**: TypeScript 5.x, Node.js 20+
- **Primary Dependencies**: Express, Zod, @sync-erp/shared
- **Storage**: N/A (validation layer only)
- **Testing**: Vitest, existing e2e tests
- **Target Platform**: Node.js server
- **Performance Goals**: N/A (refactoring, no new functionality)
- **Constraints**: Must not break existing API behavior
- **Scale/Scope**: 3 controllers, ~10 endpoints
