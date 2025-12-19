# Quickstart: Backend Shared Validation

**Feature**: 013-backend-shared-validation  
**Branch**: `013-backend-shared-validation`

## Prerequisites

1. Checkout branch:

   ```bash
   git checkout 013-backend-shared-validation
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build shared package:
   ```bash
   npm run build -w packages/shared
   ```

## Files to Modify

### Shared Package (if CreateBillSchema needed)

```
packages/shared/src/validators/index.ts
```

Add after CreateInvoiceSchema:

```typescript
export const CreateBillSchema = CreateInvoiceSchema.extend({
  type: z.literal('BILL'),
});
export type CreateBillInput = z.infer<typeof CreateBillSchema>;
```

### User Controller

```
apps/api/src/modules/user/user.controller.ts
```

Replace local schemas with imports:

```typescript
import { InviteUserSchema, AssignRoleSchema } from '@sync-erp/shared';
```

### Invoice Controller

```
apps/api/src/modules/accounting/controllers/invoice.controller.ts
```

Add validation:

```typescript
import { CreateInvoiceSchema } from '@sync-erp/shared';

// In create method:
const data = CreateInvoiceSchema.parse(req.body);
```

### Bill Controller

```
apps/api/src/modules/accounting/controllers/bill.controller.ts
```

Add validation using `CreateBillSchema` or `CreateInvoiceSchema` as appropriate.

## Verification

```bash
# Type check
npx tsc --noEmit -p apps/api

# Run tests
npm test -w apps/api

# Manual test - send invalid payload
curl -X POST http://localhost:3000/api/users/invite \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid"}'
# Should return 400 with validation error
```

## Success Criteria

- [ ] No local `z.object()` in user.controller.ts
- [ ] All create endpoints validate input
- [ ] Type check passes
- [ ] Tests pass
