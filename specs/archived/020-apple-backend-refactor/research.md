# Research: Apple-Style Backend Core Refactor

**Feature**: 020-apple-backend-refactor
**Date**: 2025-12-16
**Status**: Complete

## Research Summary

This document consolidates research findings for the backend core refactor. All "NEEDS CLARIFICATION" items from the Technical Context have been resolved through the `/speckit-clarify` workflow.

---

## 1. Policy Layer Pattern

### Decision

Implement Policy as a **static class** with pure methods that accept `BusinessShape` and return boolean or throw `DomainError`.

### Rationale

- **Static methods** are simpler than dependency injection for stateless checks
- **Pure functions** are easily unit-testable
- **Throw on violation** pattern aligns with Express error handling middleware

### Alternatives Considered

| Alternative             | Rejected Because                                          |
| ----------------------- | --------------------------------------------------------- |
| Middleware-based policy | Would require duplicate checks in services                |
| Decorator pattern       | TypeScript decorators add complexity and are experimental |
| Database-driven rules   | Overkill for MVP; shape-based rules are static            |

### Implementation Pattern

```typescript
// policy.ts
export class InventoryPolicy {
  static canAdjustStock(shape: BusinessShape): boolean {
    return shape !== BusinessShape.SERVICE;
  }

  static ensureCanAdjustStock(shape: BusinessShape): void {
    if (!this.canAdjustStock(shape)) {
      throw new DomainError('Stock tracking is disabled for Service companies');
    }
  }
}

// service.ts
async adjustStock(companyId: string, dto: AdjustStockDto) {
  const company = await this.getCompany(companyId);
  InventoryPolicy.ensureCanAdjustStock(company.shape); // Policy check FIRST
  // ... repository calls
}
```

---

## 2. DomainError Class

### Decision

Create a custom `DomainError` class that extends `Error` and includes an HTTP status code.

### Rationale

- Distinguishes business rule violations from system errors
- Allows Express error middleware to return appropriate HTTP status (400 vs 500)
- Provides clear, user-facing error messages

### Implementation Pattern

```typescript
// shared/errors/domain-error.ts
export class DomainError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'DomainError';
    this.statusCode = statusCode;
  }
}
```

---

## 3. BusinessShape Enum in Prisma

### Decision

Define `BusinessShape` as a Prisma enum with **database-level enforcement**.

### Rationale

- Prisma generates type-safe enum in TypeScript
- Database constraint prevents invalid values
- Single source of truth across backend

### Implementation Pattern

```prisma
enum BusinessShape {
  PENDING
  RETAIL
  MANUFACTURING
  SERVICE
}

model Company {
  id            String        @id @default(uuid())
  name          String
  businessShape BusinessShape @default(PENDING)
  // ...
}
```

### Sync with packages/shared

The `BusinessShape` enum must also be defined in `packages/shared/src/types/company.ts` for frontend use. These must be kept in sync manually (or via code generation in the future).

---

## 4. SystemConfig Table Design

### Decision

Use a **key-value pair** design with typed JSON values.

### Rationale

- Flexible for future config additions
- No schema migration needed for new config keys
- Can be cached in memory for fast access

### Implementation Pattern

```prisma
model SystemConfig {
  id        String   @id @default(uuid())
  companyId String
  key       String
  value     Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id])

  @@unique([companyId, key])
  @@index([companyId])
}
```

### Default Config per Shape

| Shape         | enableReservation | enableMultiWarehouse | accountingBasis |
| ------------- | ----------------- | -------------------- | --------------- |
| RETAIL        | false             | false                | CASH            |
| MANUFACTURING | true              | true                 | ACCRUAL         |
| SERVICE       | false             | false                | CASH            |

---

## 5. Shape Selection and Immutability

### Decision

Shape selection is **one-time only**. Once a company moves from PENDING to any other shape, the shape is immutable.

### Rationale

- Aligns with Apple-Like principle: "Decision Lives Once"
- Prevents complex data migration scenarios
- Simplifies system state management

### Implementation Pattern

```typescript
async selectShape(companyId: string, newShape: BusinessShape) {
  const company = await this.repository.findById(companyId);

  if (company.businessShape !== BusinessShape.PENDING) {
    throw new DomainError('Business shape cannot be changed after initial selection');
  }

  await this.repository.updateShape(companyId, newShape);
  await this.seedSystemConfig(companyId, newShape);
  await this.seedChartOfAccounts(companyId, newShape);

  return { success: true, shape: newShape };
}
```

---

## 6. Chart of Accounts Seeding

### Decision

Seed a **minimal, shape-appropriate** Chart of Accounts when shape is selected.

### Rationale

- Reduces user setup burden (Apple-Like: "Defaults are correct")
- Different business types need different account structures
- Can be expanded later by user

### Default CoA per Shape

**All Shapes (Common)**:

- 1000 Cash
- 1100 Accounts Receivable
- 2000 Accounts Payable
- 3000 Equity

**RETAIL**:

- 4000 Sales Revenue
- 5000 Cost of Goods Sold
- 1200 Inventory

**MANUFACTURING**:

- 4000 Sales Revenue
- 5000 Cost of Goods Sold
- 1200 Raw Materials Inventory
- 1210 Work in Progress
- 1220 Finished Goods Inventory

**SERVICE**:

- 4000 Service Revenue
- 5000 Operating Expenses

---

## 7. Migration Strategy for Existing Companies

### Decision

Existing companies are migrated to `PENDING` shape and must manually select their shape via admin flow.

### Rationale

- Avoids incorrect assumptions about existing data
- Forces explicit decision from company owner
- Clean separation between pre-refactor and post-refactor data

### Migration Script

```sql
-- Migration: add_business_shape
ALTER TABLE "Company" ADD COLUMN "businessShape" "BusinessShape" NOT NULL DEFAULT 'PENDING';
```

---

## 8. Request Context Enhancement

### Decision

Load `company.shape` into `req.company` during authentication middleware.

### Rationale

- Shape is needed in almost every service call
- Avoid repeated database lookups
- Single point of truth for request context

### Implementation Pattern

```typescript
// middlewares/auth.ts
const company = await prisma.company.findUnique({
  where: { id: companyId },
  select: { id: true, name: true, businessShape: true },
});

req.company = company;
```

---

## Research Conclusion

All technical decisions have been made. The implementation can proceed with:

1. **Phase 0**: Schema changes (Prisma migration)
2. **Phase 1**: Policy layer injection
3. **Phase 2**: Service refactoring
4. **Phase 3**: Shape selection endpoint

No further research is required.
