# Research: PENDING Shape Guard

**Feature**: 027-pending-shape-guard  
**Date**: 2025-12-17

## Research Topics

### 1. Existing Shape Check Implementations

**Task**: Research current PENDING shape checks in the codebase

**Findings**:

| Module      | Has Check | Location                                           |
| ----------- | --------- | -------------------------------------------------- |
| Sales       | ✅        | `SalesPolicy.ensureCanCreateSalesOrder()`          |
| Procurement | ✅        | `ProcurementPolicy.ensureCanCreatePurchaseOrder()` |
| Inventory   | ✅        | `InventoryPolicy.ensureCanAdjustStock()`           |
| Product     | ❌        | Missing                                            |
| Journal     | ❌        | Missing                                            |

**Decision**: Implement centralized middleware to cover all gaps. Keep existing policy checks as defense-in-depth.

**Rationale**:

- DRY principle - one guard instead of duplicating in every policy
- Fail-fast - block at middleware level before reaching business logic
- Completeness - no modules can slip through

---

### 2. Express Middleware Pattern

**Task**: Find best practices for guard middleware in Express

**Decision**: Use standard Express middleware with early return pattern:

```typescript
export function requireActiveShape() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.company?.businessShape === BusinessShape.PENDING) {
      throw new DomainError(
        'Operations blocked until business shape is selected',
        400
      );
    }
    next();
  };
}
```

**Rationale**:

- Consistent with existing auth middleware pattern
- Uses existing `DomainError` class for standardized error handling
- Error caught by global error handler

**Alternatives Considered**:

1. ~~Decorator pattern~~ - Not applicable to Express routes
2. ~~Controller base class~~ - Violates single responsibility, harder to test

---

### 3. Route Application Strategy

**Task**: Determine how to apply guard to routes

**Decision**: Apply middleware at route group level, not globally:

```typescript
// routes/product.ts
router.post('/', requireActiveShape(), productController.create);
router.put('/:id', requireActiveShape(), productController.update);
router.get('/', productController.list); // No guard - read allowed
```

**Rationale**:

- Granular control - allows read operations for PENDING companies
- Explicit - clear which routes are guarded
- Maintains dashboard/profile access for PENDING companies

**Alternatives Considered**:

1. ~~Global middleware~~ - Would block reads, breaking dashboard
2. ~~Path-based global~~ - Complex regex, error-prone
3. ~~Method-based global~~ - Not all POSTs need blocking (e.g., auth)

---

### 4. Request Context Requirements

**Task**: Verify company is available in request context

**Finding**: Company is already loaded by `auth.middleware.ts` and available as `req.company`:

```typescript
// auth.middleware.ts (existing)
req.company = await prisma.company.findUnique({
  where: { id: companyId },
  select: { id: true, businessShape: true, ... }
});
```

**Decision**: No changes to auth middleware needed. Guard can directly access `req.company.businessShape`.

---

## Summary

All research items resolved. No NEEDS CLARIFICATION markers remain.

| Topic                  | Decision                            |
| ---------------------- | ----------------------------------- |
| Implementation Pattern | Express middleware with DomainError |
| Application Strategy   | Per-route, write operations only    |
| Existing Policy Checks | Keep as defense-in-depth            |
| Request Context        | Already available from auth         |
