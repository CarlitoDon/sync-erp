# API Contracts: Rental tRPC Router

**Feature**: 043-rental-business
**Date**: 2026-01-08
**Status**: Phase 1 - API Design

## Overview

This document defines the tRPC procedures for the rental feature. All procedures use `protectedProcedure` (requires authentication + companyId). Rental is a universal feature - no shape gating per Constitution XXIII.

> **Note**: Router location: `apps/api/src/trpc/routers/rental.router.ts`

---

## Router Structure

```typescript
rental.
  items.{list, create, addUnit, updateUnitStatus}
  orders.{list, create, confirm, release, cancel}
  availability.{check, getUnitsByItem}
  returns.{process, finalize}
  policy.{getCurrent, update}
  reports.{utilization, revenue, overdue}
```

---

## Procedures

### Items Management

#### `rental.items.list`

- **Type**: Query
- **Input**: `{ filters?: { category?: string, isActive?: boolean }, pagination }`
- **Output**: `{ items: RentalItem[], total: number }`
- **Logic**: Filter by company, apply filters, paginate

#### `rental.items.create`

- **Type**: Mutation
- **Input**: `CreateRentalItemInput` (name, rates, depositPolicy)
- **Output**: `RentalItem`
- **Validation**:
  - weeklyRate < 7 × dailyRate
  - If PERCENTAGE, depositPercentage required
- **Side Effects**: Create item, log audit

#### `rental.items.addUnit`

- **Type**: Mutation
- **Input**: `{ itemId: string, unitCode: string, condition?: UnitCondition }`
- **Output**: `RentalItemUnit`
- **Validation**: unitCode unique per company
- **Side Effects**: Create unit with status AVAILABLE

#### `rental.items.updateUnitStatus`

- **Type**: Mutation
- **Input**: `{ unitId: string, status: UnitStatus, reason?: string }`
- **Output**: `RentalItemUnit`
- **Validation**: Enforce state machine transitions
- **Side Effects**: Update status, log transition

---

###Orders Management

#### `rental.orders.list`

- **Type**: Query
- **Input**: `{ filters?: { status?: OrderStatus, partnerId?: string, dateRange?: { start, end } }, pagination }`
- **Output**: `{ orders: RentalOrder[], total: number }`
- **Logic**: Filter by company, include units/items

#### `rental.orders.create`

- **Type**: Mutation
- **Input**: `CreateRentalOrderInput` (partnerId, dates, items[])
- **Output**: `RentalOrder`
- **Logic**:
  1. Calculate pricing tiers (most economical)
  2. Snapshot current RentalPolicy
  3. Create order with status DRAFT
- **Validation**:
  - rentalEndDate > rentalStartDate
  - Customer risk check (warn if BLACKLISTED)

#### `rental.orders.confirm`

- **Type**: Mutation
- **Input**: `{ orderId: string, depositAmount: Decimal, paymentMethod: string }`
- **Output**: `RentalOrder`
- **Logic**:
  1. Check availability (units not Reserved/Rented)
  2. Create RentalDeposit
  3. Assign units → RentalOrderUnitAssignment
  4. Set units to RESERVED
  5. Update order status → CONFIRMED
- **Validation**: Sufficient units available

#### `rental.orders.release`

- **Type**: Mutation
- **Input**: `{ orderId: string, unitAssignments: [{ unitId, beforePhotos[] }] }`
- **Output**: `RentalOrder`
- **Logic**:
  1. Validate all assigned units have photos
  2. Create ItemConditionLog (RELEASE type)
  3. Set units to RENTED
  4. Update order status → ACTIVE
- **Validation**: Photos must show unitCode

#### `rental.orders.cancel`

- **Type**: Mutation
- **Input**: `{ orderId: string, reason: string }`
- **Output**: `RentalOrder`
- **Logic**:
  1. Release Reserved units → AVAILABLE
  2. Refund deposit if collected
  3. Update order status → CANCELLED
- **Validation**: Can only cancel DRAFT or CONFIRMED

---

### Availability

#### `rental.availability.check`

- **Type**: Query
- **Input**: `{ itemId?: string, startDate: Date, endDate: Date }`
- **Output**: `{ [itemId]: availableCount }`
- **Logic**: Count units WHERE status = AVAILABLE AND NOT (assigned to conflicting order)

#### `rental.availability.getUnitsByItem`

- **Type**: Query
- **Input**: `{ itemId: string, status?: UnitStatus }`
- **Output**: `RentalItemUnit[]`
- **Logic**: List units for item, filter by status if provided

---

### Returns & Settlement

#### `rental.returns.process`

- **Type**: Mutation
- **Input**: `ProcessReturnInput` (orderId, returnDate, units: [{ unitId, afterPhotos[], damageSeverity?, notes? }])
- **Output**: `RentalReturn` (status DRAFT)
- **Logic**:
  1. Create ItemConditionLog (RETURN type) for each unit
  2. Calculate charges:
     - baseRentalFee (from order)
     - lateFee (using policySnapshot grace period)
     - damageCharges (sum of damage assessments)
     - cleaningFees (if applicable)
  3. Calculate settlement (deposit - charges)
  4. Set units to RETURNED
  5. Create RentalReturn (DRAFT)
- **Validation**: All rented units must be returned

#### `rental.returns.finalize`

- **Type**: Mutation
- **Input**: `{ returnId: string }`
- **Output**: `RentalReturn`
- **Logic**:
  1. Validate return calculations
  2. Update RentalDeposit status (REFUNDED | FORFEITED | PARTIAL_REFUND)
  3. Set units to CLEANING (auto-trigger)
  4. Set RentalReturn status → SETTLED (immutable)
  5. Update order status → COMPLETED
- **Validation**: Can only finalize DRAFT returns

---

### Policy Management

#### `rental.policy.getCurrent`

- **Type**: Query
- **Input**: None
- **Output**: `RentalPolicy` (isActive = true)
- **Logic**: Find active policy for company

#### `rental.policy.update`

- **Type**: Mutation
- **Input**: `UpdateRentalPolicyInput` (graceHours, cleaningFee, etc.)
- **Output**: `RentalPolicy`
- **Logic**:
  1. Mark current policy inactive (replacedAt = now)
  2. Create new policy (effectiveFrom = now, isActive = true)
- **Validation**: Only one active policy per company

---

### Reports

#### `rental.reports.utilization`

- **Type**: Query
- **Input**: `{ period: { start: Date, end: Date }, itemId?: string }`
- **Output**: `{ itemId, itemName, totalDays, rentedDays, utilizationRate }`
- **Logic**: Calculate % of time units were RENTED in period

#### `rental.reports.revenue`

- **Type**: Query
- **Input**: `{ period: { start: Date, end: Date }, category?: string }`
- **Output**: `{ category, revenue, orderCount }`
- **Logic**: Sum rental fees by category

#### `rental.reports.overdue`

- **Type**: Query
- **Input**: None
- **Output**: `{ orderId, partner, daysLate, accruedLateFees }`
- **Logic**: Find orders WHERE status = ACTIVE AND dueDateTime < now

---

## Input Schemas

```typescript
// Zod schemas in packages/shared/src/validators/rental.ts

const CreateRentalItemInput = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    category: z.string().min(1),
    dailyRate: z.number().positive(),
    weeklyRate: z.number().positive(),
    monthlyRate: z.number().positive(),
    depositPolicyType: z.enum(['PERCENTAGE', 'PER_UNIT', 'HYBRID']),
    depositPercentage: z.number().min(1).max(100).optional(),
    depositPerUnit: z.number().positive().optional(),
  })
  .refine(/* weeklyRate < 7 × dailyRate */);

const CreateRentalOrderInput = z.object({
  partnerId: z.string().uuid(),
  rentalStartDate: z.date(),
  rentalEndDate: z.date(),
  dueDateTime: z.date(),
  items: z.array(
    z.object({
      rentalItemId: z.string().uuid(),
      quantity: z.number().int().positive(),
    })
  ),
  notes: z.string().optional(),
});

const ProcessReturnInput = z.object({
  orderId: z.string().uuid(),
  actualReturnDate: z.date(),
  units: z.array(
    z.object({
      unitId: z.string().uuid(),
      afterPhotos: z.array(z.string().url()), // Min 1 if damaged
      damageSeverity: z
        .enum(['MINOR', 'MAJOR', 'UNUSABLE'])
        .optional(),
      notes: z.string().optional(),
    })
  ),
});
```

---

## Error Handling

**Standard tRPC Errors**:

- `UNAUTHORIZED`: Not authenticated or no companyId
- `FORBIDDEN`: Insufficient permissions (future)
- `NOT_FOUND`: Entity not found or doesn't belong to company
- `BAD_REQUEST`: Validation failures
- `CONFLICT`: Business rule violations (e.g., insufficient availability)

**Business Errors**:

```typescript
throw new TRPCError({
  code: 'CONFLICT',
  message: 'Insufficient units available for rental period',
  cause: { itemId, requested, available },
});
```

---

## Authentication & Permissions

All procedures use `protectedProcedure` with DI container:

```typescript
import { router, protectedProcedure } from '../trpc';
import { container, ServiceKeys } from '../../modules/common/di';
import { RentalService } from '../../modules/rental/rental.service';

const rentalService = container.resolve<RentalService>(
  ServiceKeys.RENTAL_SERVICE
);

export const rentalRouter = router({
  items: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // ctx.companyId! is the standard pattern (non-null assertion)
      return rentalService.listItems(ctx.companyId!);
    }),
  }),
});
```

**Future**: Add permission checks (e.g., `RENTAL.CREATE`, `RENTAL.PROCESS_RETURN`)

---

## Next Steps

1. ✅ API contracts defined
2. **NEXT**: Generate `quickstart.md`
3. **THEN**: Update agent context
4. **FINALLY**: Report completion

**Phase 1 Progress**: 66% complete
