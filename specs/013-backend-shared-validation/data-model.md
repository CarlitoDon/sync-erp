# Data Model: Backend Shared Validation

**Feature**: 013-backend-shared-validation  
**Date**: 2025-12-13

## Overview

This feature does not introduce new data models. It focuses on unifying validation schemas between frontend and backend using existing schemas from `@sync-erp/shared`.

## Schema Inventory

### Existing Schemas (Already in `@sync-erp/shared`)

| Schema                | File                    | Fields                                               | Used By Backend       |
| --------------------- | ----------------------- | ---------------------------------------------------- | --------------------- |
| `InviteUserSchema`    | `validators/company.ts` | `email`, `name`                                      | user.controller.ts    |
| `AssignRoleSchema`    | `validators/index.ts`   | `userId`, `roleId`                                   | user.controller.ts    |
| `CreateInvoiceSchema` | `validators/index.ts`   | `orderId?`, `partnerId`, `type`, `dueDate`, `amount` | invoice.controller.ts |

### Schema to Add

| Schema             | Target File           | Fields                                            | Used By            |
| ------------------ | --------------------- | ------------------------------------------------- | ------------------ |
| `CreateBillSchema` | `validators/index.ts` | Same as `CreateInvoiceSchema` with `type: 'BILL'` | bill.controller.ts |

**Note**: `CreateBillSchema` can extend `CreateInvoiceSchema` with a literal type constraint:

```typescript
export const CreateBillSchema = CreateInvoiceSchema.extend({
  type: z.literal('BILL'),
});
```

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                      @sync-erp/shared                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  validators/                                               │  │
│  │  ├── index.ts  ←─ AssignRoleSchema, CreateInvoiceSchema   │  │
│  │  ├── company.ts ←─ InviteUserSchema                        │  │
│  │  └── auth.ts    ←─ registerSchema, loginSchema             │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ imports
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ user.controller │ │invoice.controller│ │ bill.controller │
│  - invite()     │ │  - create()      │ │  - create()     │
│  - assign()     │ │  - post()        │ │  - post()       │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Validation Rules

### InviteUserSchema

- `email`: Valid email format, required
- `name`: Minimum 2 characters, required

### AssignRoleSchema

- `userId`: Valid UUID, required
- `roleId`: Valid UUID, required

### CreateInvoiceSchema

- `orderId`: Valid UUID, optional
- `partnerId`: Valid UUID, required
- `type`: Enum `['INVOICE', 'BILL']`, required
- `dueDate`: Valid date, required
- `amount`: Positive number, required

## Migration Notes

No database migrations required. This is a code-only refactoring.
