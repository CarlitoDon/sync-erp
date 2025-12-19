# Quickstart: PENDING Shape Guard

**Feature**: 027-pending-shape-guard  
**Date**: 2025-12-17

## What This Feature Does

Blocks all business operations (create, update, delete) when a company's business shape is still PENDING. This ensures companies complete setup before creating any business data.

## Files to Create/Modify

### New File

| File                                     | Purpose          |
| ---------------------------------------- | ---------------- |
| `apps/api/src/middlewares/shapeGuard.ts` | Guard middleware |

### Files to Modify

| File                                   | Change                        |
| -------------------------------------- | ----------------------------- |
| `apps/api/src/routes/product.ts`       | Apply guard to write routes   |
| `apps/api/src/routes/invoice.ts`       | Apply guard to write routes   |
| `apps/api/src/routes/bill.ts`          | Apply guard to write routes   |
| `apps/api/src/routes/salesOrder.ts`    | Apply guard to write routes   |
| `apps/api/src/routes/purchaseOrder.ts` | Apply guard to write routes   |
| `apps/api/src/routes/inventory.ts`     | Apply guard to write routes   |
| `apps/api/src/routes/payment.ts`       | Apply guard to write routes   |
| `apps/api/src/routes/finance.ts`       | Apply guard to journal routes |

## Implementation Pattern

```typescript
// apps/api/src/middlewares/shapeGuard.ts
import { Request, Response, NextFunction } from 'express';
import { BusinessShape } from '@sync-erp/database';
import { DomainError } from '../errors/domain-error';

export function requireActiveShape() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.company?.businessShape === BusinessShape.PENDING) {
      throw new DomainError(
        'Operations blocked until business shape is selected. Please complete company setup.',
        400
      );
    }
    next();
  };
}
```

## Route Integration

```typescript
// Example: routes/product.ts
import { requireActiveShape } from '../middlewares/shapeGuard';

// Apply to write operations
router.post(
  '/',
  auth,
  requireActiveShape(),
  productController.create
);
router.put(
  '/:id',
  auth,
  requireActiveShape(),
  productController.update
);
router.delete(
  '/:id',
  auth,
  requireActiveShape(),
  productController.delete
);

// No guard for reads
router.get('/', auth, productController.list);
router.get('/:id', auth, productController.getById);
```

## Testing

```typescript
// test/unit/middlewares/shapeGuard.test.ts
describe('requireActiveShape', () => {
  it('should allow request when shape is RETAIL', async () => {
    req.company = { businessShape: BusinessShape.RETAIL };
    requireActiveShape()(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should block request when shape is PENDING', async () => {
    req.company = { businessShape: BusinessShape.PENDING };
    expect(() => requireActiveShape()(req, res, next)).toThrow(
      'Operations blocked until business shape is selected'
    );
  });
});
```

## Verification

```bash
# Build check
npm run build

# Run all tests
npm test

# Specific middleware tests
npm test -w apps/api -- shapeGuard
```
