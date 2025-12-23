# Quickstart: Using Generated Zod Schemas

This feature introduces `zod-prisma-types` to automatically generate Zod schemas from our Prisma schema.

## 1. Generation

When you run:

```bash
npx prisma generate
```

Zod schemas are generated to: `packages/shared/src/generated/zod`

## 2. Usage in Shared Types

Instead of manually defining enums, import them:

```ts
// packages/shared/src/validators/index.ts
export * from '../generated/zod'; // Export all generated types
```

## 3. Usage in Validators

```ts
import { PaymentTermsSchema } from '@/generated/zod'; // Path via tsconfig paths if configured, or relative

export const CreatePOSchema = z.object({
  paymentTerms: PaymentTermsSchema, // Uses stricter literal union
  // ...
});
```

## 4. Usage in tRPC

```ts
// apps/api/src/trpc/routers/purchaseOrder.router.ts
import { CreatePOSchema } from '@sync-erp/shared';

export const purchaseOrderRouter = router({
  create: protectedProcedure
    .input(CreatePOSchema)
    .mutation(async ({ input }) => {
      // input.paymentTerms is strictly typed
    }),
});
```

## 5. Troubleshooting "Type Mismatch"

If you see errors like `Type 'string' is not assignable to type 'PaymentTerms'`, it means you are using a string literal where an Enum is expected.

**Fix**:
Use the Enum object/Schema or strict literal:

```ts
// Good
const terms: PaymentTerms = 'NET30';

// Bad (if derived from enum key vs value mismatch)
const terms = 'SOME_INVALID_STRING';
```
