# Quickstart: Rental Business Development

**Feature**: 043-rental-business  
**Branch**: `043-rental-business`  
**Last Updated**: 2026-01-08

## Overview

This guide helps developers implement the rental business feature. Read this before starting implementation.

---

## Prerequisites

1. **Constitution Knowledge**: Read `.specify/memory/constitution.md` (v3.4.0)
2. **Planning Artifacts**: Review `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`
3. **Environment**: Node.js 18+, PostgreSQL, Prisma CLI

---

## Development Workflow

### Phase 1: Database Schema

**Files**:

- `packages/database/prisma/schema.prisma`

**Steps**:

1. Add 11 new models from `data-model.md`
2. Run migration:
   ```bash
   cd packages/database
   npx prisma migrate dev --name add-rental-entities
   npx prisma generate
   ```
3. Seed default policy:
   ```bash
   npm run seed:rental  # Create this script
   ```

**Validation**:

```bash
npx prisma studio  # Inspect tables
```

---

### Phase 2: Shared Types & Validators

**Files**:

- `packages/shared/src/validators/rental.ts` (NEW)
- `packages/shared/src/validators/index.ts` (`export * from './rental'`)

**Steps**:

1. Define Zod schemas (from `contracts/api.md`)
2. Export inferred types:
   ```typescript
   export type CreateRentalItemInput = z.infer<
     typeof CreateRentalItemSchema
   >;
   ```
3. Rebuild shared package:
   ```bash
   cd packages/shared
   npm run build
   ```

**Key Schemas**:

- `CreateRentalItemSchema`
- `CreateRentalOrderSchema`
- `ProcessReturnSchema`
- `UpdateRentalPolicySchema`

---

### Phase 3: Backend Implementation

**Module Structure**:

```
apps/api/src/modules/rental/
├── rental.router.ts          # tRPC router
├── # No controller - router calls service directly      # Procedure handlers
├── rental.service.ts         # Business orchestration
├── rental.policy.ts          # Availability checks, settlement rules
├── rental.repository.ts      # Prisma queries
├── rules/
│   ├── pricing.ts            # Calculate tier (daily/weekly/monthly)
│   ├── deposit.ts            # Allocate deposit per-unit
│   └── late-fee.ts           # Grace period + late fee calc
└── types.ts                  # Internal DTOs
```

**Implementation Order**:

#### 1. Repository (Data Access)

```typescript
// rental.repository.ts
export class RentalRepository {
  constructor(private prisma: PrismaClient) {}

  async findAvailableUnits(
    itemId: string,
    startDate: Date,
    endDate: Date
  ) {
    // Query units WHERE status = AVAILABLE
    // AND NOT assigned to conflicting orders
  }

  async createOrder(
    data: CreateOrderData,
    tx?: Prisma.TransactionClient
  ) {
    // Use transaction client if provided
  }
}
```

**Key Methods**:

- `findAvailableUnits(itemId, dateRange)`
- `createOrder(data)`
- `assignUnitsToOrder(orderId, unitIds)`
- `updateUnitStatus(unitId, status)`
- `calculateSettlement(orderId, returnDate)`

#### 2. Policy (Business Rules)

```typescript
// rental.policy.ts
export class RentalPolicy {
  async validateAvailability(
    itemId: string,
    quantity: number,
    dateRange: DateRange
  ) {
    const available = await repo.findAvailableUnits(
      itemId,
      dateRange
    );
    if (available.length < quantity) {
      throw new Error(
        `Insufficient units. Need ${quantity}, got ${available.length}`
      );
    }
  }

  validateStateTransition(from: UnitStatus, to: UnitStatus) {
    // Enforce state machine rules
  }
}
```

#### 3. Rules (Pure Logic)

```typescript
// rules/pricing.ts
export function calculatePricingTier(
  days: number,
  rates: RentalItemRates
): {
  tier: PricingTier;
  unitPrice: Decimal;
} {
  if (days >= 30)
    return { tier: 'MONTHLY', unitPrice: rates.monthlyRate };
  if (days >= 7)
    return { tier: 'WEEKLY', unitPrice: rates.weeklyRate };
  return { tier: 'DAILY', unitPrice: rates.dailyRate.mul(days) };
}
```

#### 4. Service (Orchestration)

```typescript
// rental.service.ts
export class RentalService {
  async createOrder(companyId: string, input: CreateRentalOrderInput) {
    // 1. Validate availability (Policy)
    await this.policy.validateAvailability(...)

    // 2. Calculate pricing (Rules)
    const pricing = calculatePricingTier(...)

    // 3. Snapshot policy
    const policySnapshot = await this.repo.getCurrentPolicy(companyId)

    // 4. Create order (Repository)
    return this.repo.createOrder({ ...input, policySnapshot })
  }

  async confirmOrder(orderId: string, depositInput: DepositInput) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validate order status
      // 2. Create deposit
      // 3. Assign units (set to RESERVED)
      // 4. Update order status to CONFIRMED
    })
  }
}
```

#### 5. Router (tRPC)

```typescript
// rental.router.ts
import { router } from '../../trpc/trpc';
import { protectedProcedure } from '../../trpc/trpc';

export const rentalRouter = router({
  items: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const service = container.resolve(RentalService);
      return service.listItems(ctx.companyId);
    }),

    create: protectedProcedure
      .input(CreateRentalItemSchema)
      .mutation(async ({ ctx, input }) => {
        const service = container.resolve(RentalService);
        return service.createItem(ctx.companyId, input, ctx.userId);
      }),
  }),
  // ... more routers
});
```

#### 6. Register in App Router

```typescript
// apps/api/src/trpc/router.ts
import { rentalRouter } from '../modules/rental/rental.router';

export const appRouter = router({
  // ... existing routers
  rental: rentalRouter, // Add this
});
```

---

### Phase 4: Frontend Implementation

**Module Structure**:

```
apps/web/src/features/rental/
├── components/
│   ├── RentalOrderForm.tsx       # Wizard for order creation
│   ├── UnitAssignmentModal.tsx   # Assign specific units
│   ├── ReturnModal.tsx           # Process return + settlement
│   └── UnitCalendarView.tsx      # Availability calendar
├── hooks/
│   ├── useRentalMutations.ts     # tRPC mutations
│   └── useUnitAvailability.ts    # Availability queries
├── pages/
│   ├── RentalOrdersPage.tsx      # List orders
│   ├── RentalItemsPage.tsx       # Manage items/units
│   ├── ReturnsPage.tsx           # Process returns
│   └── OverduePage.tsx           # Overdue dashboard
└── types.ts                      # Frontend display types
```

**Key Components**:

#### 1. Order Creation Wizard

```tsx
// components/RentalOrderForm.tsx
export function RentalOrderForm() {
  const [step, setStep] = useState(1); // 1: Customer, 2: Items, 3: Dates, 4: Review

  const createMutation = trpc.rental.orders.create.useMutation({
    onSuccess: (order) => {
      toast.success('Order created!');
      navigate(`/rental/orders/${order.id}`);
    },
  });

  // Step 1: Select customer (with risk warning)
  // Step 2: Add items
  // Step 3: Set dates
  // Step 4: Review & confirm
}
```

#### 2. Unit Assignment

```tsx
// components/UnitAssignmentModal.tsx
export function UnitAssignmentModal({ orderId, itemId, quantity }) {
  const { data: units } =
    trpc.rental.availability.getUnitsByItem.useQuery({
      itemId,
      status: 'AVAILABLE',
    });

  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  // Photo upload for each unit
  // Confirm assignment
}
```

#### 3. tRPC Hooks

```tsx
// hooks/useRentalMutations.ts
export function useRentalMutations() {
  const utils = trpc.useUtils();

  const confirmOrder = trpc.rental.orders.confirm.useMutation({
    onSuccess: async () => {
      await apiAction(
        () => Promise.resolve(),
        'Order confirmed! Units reserved.'
      );
      await utils.rental.orders.list.invalidate();
    }
  });

  return { confirmOrder, ... };
}
```

---

### Phase 5: Testing

**Integration Test** (`apps/api/test/integration/rental-flow.test.ts`):

```typescript
describe('Rental Business Flow', () => {
  it('Complete lifecycle: Create → Confirm → Release → Return → Settle', async () => {
    // Setup: Create customer, rental item, units
    const customer = await createTestCustomer();
    const item = await createRentalItem({ dailyRate: 50000, ... });
    const units = await addUnits(item.id, 2);  // SB-001, SB-002

    // 1. Create order
    const order = await rentalService.createOrder(companyId, {
      partnerId: customer.id,
      rentalStartDate: new Date('2026-01-10'),
      rentalEndDate: new Date('2026-01-15'),
      items: [{ rentalItemId: item.id, quantity: 2 }]
    });
    expect(order.status).toBe('DRAFT');

    // 2. Confirm order (deposit + reserve units)
    const confirmed = await rentalService.confirmOrder(order.id, {
      depositAmount: new Decimal(100000),
      paymentMethod: 'Cash'
    });
    expect(confirmed.status).toBe('CONFIRMED');
    const reservedUnits = await getUnitsByOrderId(order.id);
    expect(reservedUnits.every(u => u.status === 'RESERVED')).toBe(true);

    // 3. Release to customer (activate order)
    const released = await rentalService.releaseOrder(order.id, {
      unitAssignments: [
        { unitId: units[0].id, beforePhotos: ['url1.jpg'] },
        { unitId: units[1].id, beforePhotos: ['url2.jpg'] }
      ]
    });
    expect(released.status).toBe('ACTIVE');

    // 4. Return items (late by 1 day)
    const returnDate = new Date('2026-01-16');  // 1 day late
    const returnRecord = await rentalService.processReturn({
      orderId: order.id,
      actualReturnDate: returnDate,
      units: [
        { unitId: units[0].id, afterPhotos: ['url3.jpg'], damageSeverity: null },
        { unitId: units[1].id, afterPhotos: ['url4.jpg'], damageSeverity: 'MINOR' }
      ]
    });

    expect(returnRecord.status).toBe('DRAFT');
    expect(Number(returnRecord.lateFee)).toBeGreaterThan(0);  // Grace period exceeded

    // 5. Finalize settlement
    const finalized = await rentalService.finalizeReturn(returnRecord.id);
    expect(finalized.status).toBe('SETTLED');
    expect(finalized.settledAt).toBeDefined();

    // 6. Verify final state
    const finalOrder = await getOrderById(order.id);
    expect(finalOrder.status).toBe('COMPLETED');
    const finalUnits = await getUnitsByIds([units[0].id, units[1].id]);
    expect(finalUnits.every(u => u.status === 'CLEANING')).toBe(true);
  });
});
```

---

## Common Pitfalls

### 1. ❌ Hardcoded Enums

**Wrong**:

```typescript
// rental.service.ts
if (order.status === 'CONFIRMED') { ... }
```

**Right**:

```typescript
import { OrderStatus } from '@sync-erp/database';
if (order.status === OrderStatus.CONFIRMED) { ... }
```

### 2. ❌ Missing Multi-Tenant Scoping

**Wrong**:

```typescript
const orders = await prisma.rentalOrder.findMany(); // All companies!
```

**Right**:

```typescript
const orders = await prisma.rentalOrder.findMany({
  where: { companyId: ctx.companyId },
});
```

### 3. ❌ Number() in Business Logic

**Wrong**:

```typescript
const total = item.dailyRate * days; // Loses precision!
```

**Right**:

```typescript
import Decimal from 'decimal.js';
const total = new Decimal(item.dailyRate).mul(days);
```

### 4. ❌ Business Logic in Repository

**Wrong**:

```typescript
// rental.repository.ts
async confirmOrder(orderId) {
  const order = await this.prisma.rentalOrder.findUnique(...);
  if (order.status !== 'DRAFT') throw new Error(...);  // ❌ Policy check in repo!
}
```

**Right**:

```typescript
// rental.service.ts
await this.policy.validateOrderStatus(order, 'DRAFT'); // ✅ Policy in service
await this.repository.updateOrderStatus(orderId, 'CONFIRMED'); // ✅ Repo only data
```

---

## Debugging Tips

1. **Availability Issues**: Check unit status + assignment dates

   ```sql
   SELECT u.unitCode, u.status, a.rentalOrderId
   FROM "RentalItemUnit" u
   LEFT JOIN "RentalOrderUnitAssignment" a ON u.id = a.rentalItemUnitId
   WHERE u.rentalItemId = 'item-id';
   ```

2. **Settlement Calculations**: Log policy snapshot used

   ```typescript
   console.log(
     'Policy at order creation:',
     JSON.parse(order.policySnapshot)
   );
   ```

3. **Photo Upload**: Verify Supabase Storage bucket permissions
   ```bash
   curl -I https://storage.supabase.co/object/public/rental-photos/test.jpg
   ```

---

## Next Steps After Implementation

1. **Manual Testing**: Create demo order through UI
2. **Integration Tests**: Run full lifecycle test
3. **Code Review**: Check Constitution compliance
4. **Documentation**: Update README with rental feature

---

## Support

- **Spec Issues**: Update `spec.md` and re-run `/speckit-plan`
- **Data Model Changes**: Migrate Prisma schema, regenerate
- **API Questions**: Review `contracts/api.md`

**Ready to start?** Begin with Phase 1 (Database Schema).
