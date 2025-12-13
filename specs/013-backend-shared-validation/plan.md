# Implementation Plan: Backend Shared Validation

**Branch**: `013-backend-shared-validation` | **Date**: 2025-12-13 | **Spec**: [spec.md](./spec.md)

## Summary

Unify backend controllers to use centralized validation schemas from `@sync-erp/shared` instead of local definitions. This ensures consistent validation between frontend and backend, reducing bugs and maintenance burden.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20+  
**Primary Dependencies**: Express, Zod, @sync-erp/shared  
**Storage**: N/A (validation layer only)  
**Testing**: Vitest, existing e2e tests  
**Target Platform**: Node.js server  
**Project Type**: Monorepo (apps/api + packages/shared)  
**Performance Goals**: N/A (refactoring)  
**Constraints**: Must not break existing API behavior  
**Scale/Scope**: 3 controllers, ~10 endpoints

## Constitution Check

_GATE: Passed - all principles upheld by this change._

- [x] **I. Boundaries**: Frontend strictly avoids direct DB/Logic imports.
- [x] **II. Dependencies**: Dependencies are uni-directional (apps/api → packages/shared).
- [x] **III. Contracts**: Shared types defined in `packages/shared/src/validators/`. ✅ Key principle.
- [x] **IV. Layered Backend**: Logic strictly in Services (Controllers only validate & delegate).
- [x] **IV. Repository Pattern**: DB access strictly in Repositories.
- [x] **V. Multi-Tenant**: Data isolated by `companyId` (not affected by this change).
- [x] **VI. Feature-First**: N/A - backend refactoring only.

## Project Structure

### Documentation (this feature)

```text
specs/013-backend-shared-validation/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (affected files)

```text
apps/api/src/modules/
├── user/
│   └── user.controller.ts      # Remove local schemas, import from shared
│
└── accounting/controllers/
    ├── invoice.controller.ts   # Add CreateInvoiceSchema validation
    └── bill.controller.ts      # Add CreateBillSchema validation

packages/shared/src/validators/
├── index.ts                    # Add CreateBillSchema if needed
└── company.ts                  # InviteUserSchema (already exists)
```

## Proposed Changes

### Phase 1: Add Missing Schemas to Shared (if needed)

1. Check if `CreateBillSchema` exists in `packages/shared/src/validators/index.ts`
2. If not, add it as an extension of `CreateInvoiceSchema`:
   ```typescript
   export const CreateBillSchema = CreateInvoiceSchema.extend({
     type: z.literal('BILL'),
   });
   ```
3. Rebuild shared package: `npm run build -w packages/shared`

### Phase 2: Update User Controller

**File**: `apps/api/src/modules/user/user.controller.ts`

1. Remove local `InviteUserSchema` definition
2. Remove local `AssignUserSchema` definition
3. Import from shared:
   ```typescript
   import {
     InviteUserSchema,
     AssignRoleSchema,
   } from '@sync-erp/shared';
   ```
4. Keep existing validation logic (already uses .parse())

### Phase 3: Update Invoice Controller

**File**: `apps/api/src/modules/accounting/controllers/invoice.controller.ts`

1. Import `CreateInvoiceSchema`:
   ```typescript
   import { CreateInvoiceSchema } from '@sync-erp/shared';
   ```
2. Add validation to `create` method:
   ```typescript
   create = async (req, res, next) => {
     try {
       const companyId = req.context.companyId!;
       const data = CreateInvoiceSchema.parse(req.body);
       // ... existing logic
     } catch (error) {
       next(error);
     }
   };
   ```

### Phase 4: Update Bill Controller

**File**: `apps/api/src/modules/accounting/controllers/bill.controller.ts`

1. Import appropriate schema
2. Add validation to `create` method (same pattern as invoice)

### Phase 5: Verification

1. Run type check: `npx tsc --noEmit` in `apps/api`
2. Run existing tests: `npm test` in `apps/api`
3. Manual API testing with invalid payloads

## Complexity Tracking

> No constitution violations. This change enforces Principle III (Shared Contracts).

| Change                         | Risk Level | Notes                                    |
| ------------------------------ | ---------- | ---------------------------------------- |
| Remove local schemas           | Low        | Replacing with equivalent shared schemas |
| Add validation to invoice/bill | Low        | Using existing error handling            |
| Add CreateBillSchema           | Low        | Simple extension of existing schema      |
