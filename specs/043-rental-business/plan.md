# Implementation Plan: Rental Business Support

**Branch**: `043-rental-business` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/043-rental-business/spec.md`

**Note**: This plan covers a production-ready mattress rental system with unit-level tracking, cleaning workflows, deposit management, customer risk profiling, and operational safeguards.

## Summary

Implement a comprehensive rental management system supporting mattress rental businesses with:

- **Unit-level tracking**: Each physical mattress tracked individually (not homogeneous inventory)
- **Hygiene-first workflow**: Mandatory cleaning status between rentals
- **Flexible deposit models**: Percentage, per-unit, or hybrid policies
- **Operational safeguards**: Reserved status, unit assignment locks, settlement finality
- **Risk management**: Customer profiling, damage severity classification, versioned policies

**Primary Technical Approach**: 4-layer backend architecture (Router → Service → Policy → Repository) with tRPC endpoints, Prisma ORM for 11 new entities, React frontend with feature-isolated components, and integration tests for complete rental lifecycle.

## Technical Context

**Language/Version**: TypeScript / Node.js 18+ (Backend), TypeScript / React 18 (Frontend)
**Primary Dependencies**:

- Backend: Express, tRPC, Prisma, Decimal.js, Zod
- Frontend: Vite, React, tRPC React Query, Tanstack Query

**Storage**: PostgreSQL (via Prisma ORM)

- 11 new entities: RentalItem, RentalItemUnit, RentalOrder, RentalOrderUnitAssignment, RentalDeposit, RentalDepositAllocation, RentalReturn, ItemConditionLog, CleaningLog, CustomerRentalRisk, RentalPolicy

**Testing**:

- **MANDATORY**: Integration tests for complete rental flows (create → reserve → release → return → settle)
- Unit tests for pure logic (pricing calculation, deposit allocation, late fee computation)

**Target Platform**: Web (Desktop + Mobile responsive)

**Project Type**: Full-stack web application (monorepo: apps/web + apps/api)

**Performance Goals**:

- Rental order creation: < 2 seconds (5 items or fewer)
- Availability check: < 1 second (calendar view)
- Settlement calculation: < 500ms

**Constraints**:

- Multi-tenant: ALL queries scoped by `companyId`
- Financial precision: Decimal.js for all money calculations
- Photo storage: External (S3/Cloudinary) - URLs only in DB
- Audit trail: Immutable settlement records

**Scale/Scope**:

- Expected: 5000 rental orders/month per company
- 50-200 rental units per company
- 10-20 concurrent staff users

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Dependency**: Frontend ↔ Backend via tRPC (HTTP). Apps → packages/shared → packages/database ✓
- [x] **I. Multi-Tenant**: ALL rental data isolated by `companyId` ✓
- [x] **II. Type System**: Rental types in `packages/shared/src/validators/rental.ts`, use `z.infer` ✓
- [x] **III. Backend Layers**: Service checks Policy before actions (rental.service → rental.policy → rental.repository) ✓
- [x] **III-A. Dumb Layers**: Router calls service directly (no controller layer in this codebase) ✓
- [x] **IV. Frontend**: Logic in `src/features/rental/` ✓, UI renders backend state ✓
- [x] **V. Callback-Safe**: Services export standalone functions ✓
- [x] **VI. Build Verification**: `npx tsc --noEmit` and `npm run build` will pass ✓
- [x] **VII. Parity**: N/A (Rental is standalone, not mirrored in Sales/Procurement)
- [x] **VIII. Performance**: Unit assignment uses `include` for order/item data, calendar uses indexed queries ✓
- [x] **IX. Apple-Standard**: Universal feature (all businessShapes), no technical questions to user ✓
- [x] **X. Data Flow**: UI → tRPC → Router → Service → Policy → Repository → Prisma ✓
- [x] **XI. Human Interface**: Wizard for order creation, clear unit assignment flow, dashboard for overdue ✓
- [x] **XIII. Engineering**: Zero-lag unit selection (optimistic updates), settlement calculation in background ✓
- [x] **XV. Test Contracts**: Mocks include all Policy-required fields (status, unitStatus, damageSeverity) ✓
- [x] **XVI. Financial Precision**: Decimal for deposit amounts, rental fees, late charges ✓
- [x] **XVII. Integration State**: Complete flow in single `it()`: create → confirm → release → return → settle ✓
- [ ] **XVIII. Schema for Raw SQL**: N/A (no raw SQL planned, all Prisma queries)
- [x] **XIX. Seed Completeness**: Default RentalPolicy, sample RentalItems for demo ✓
- [x] **XXI. Anti-Bloat**: Reuse existing Partner (customer) entity, no new customer table ✓
- [x] **XXIII. BusinessShape-Aware**: Universal feature, spec documents sidebar visibility rules ✓

## Project Structure

### Documentation (this feature)

```text
specs/043-rental-business/
├── spec.md              # Feature specification (DONE)
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output (NEXT)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (tRPC router types)
│   └── api.md          # tRPC procedures documentation
├── checklists/          # Quality validation
│   └── requirements.md  # Spec validation (DONE)
└── tasks.md             # Phase 2 output (/speckit-tasks - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── web/                           # Frontend (Vite + React + tRPC)
│   ├── src/
│   │   ├── features/rental/       # ** NEW ** Rental feature module
│   │   │   ├── components/        # RentalOrderForm, UnitCalendarView, etc.
│   │   │   ├── hooks/             # useRentalMutations, useUnitAvailability
│   │   │   ├── modals/            # RentalOrderModal, ReturnModal, UnitAssignmentModal
│   │   │   ├── pages/             # RentalOrdersPage, RentalItemsPage, ReturnsPage
│   │   │   └── types.ts           # Frontend-specific display types
│   │   ├── components/ui/         # Reuse existing (no new atoms)
│   │   └── lib/trpc.ts            # Import rental router type
│   └── vite.config.ts
│
└── api/                           # Backend (Express + tRPC + Prisma)
    ├── src/
    │   ├── trpc/
    │   │   ├── router.ts          # Add rentalRouter to appRouter
    │   │   ├── trpc.ts            # Reuse protectedProcedure
    │   │   └── routers/
    │   │       └── rental.router.ts  # ** NEW ** tRPC rental router
    │   ├── modules/
    │   │   ├── common/di/         # DI container (add RENTAL_SERVICE)
    │   │   └── rental/            # ** NEW ** Rental domain module
    │   │       ├── rental.service.ts       # Business orchestration
    │   │       ├── rental.policy.ts        # Availability checks, settlement rules
    │   │       ├── rental.repository.ts    # Prisma queries
    │   │       ├── rules/                  # Pure logic functions
    │   │       │   ├── pricing.ts          # Calculate economical tier
    │   │       │   ├── deposit.ts          # Deposit allocation logic
    │   │       │   └── late-fee.ts         # Grace period + late fee calculation
    │   │       └── types.ts                # Domain-specific DTOs
    │   └── scripts/
    │       └── seed-rental.ts     # Seed default RentalPolicy + sample items
    │
    └── test/integration/
        └── rental-flow.test.ts    # ** NEW ** Full lifecycle integration test

packages/
├── database/                      # Prisma
│   ├── prisma/
│   │   └── schema.prisma          # ** ADD ** 11 new rental entities
│   └── src/index.ts               # Export Prisma client
│
├── shared/                        # Types & Validators
│   ├── src/
│   │   └── validators/
│   │       └── rental.ts          # ** NEW ** Zod schemas for rental domain
│   └── package.json
```

**Structure Decision**:

- Rental is a **standalone feature** (not mirrored in Sales/Procurement), so it gets its own domain module
- Frontend uses feature-first structure (`src/features/rental/`) per Constitution IV
- Backend uses domain-first structure (`modules/rental/`) with full 4-layer architecture
- No new `packages/` - reuse `shared` and `database`

## Complexity Tracking

| Dimension          | Complexity  | Notes                                                                        |
| ------------------ | ----------- | ---------------------------------------------------------------------------- |
| **Entities**       | Medium-High | 11 entities with complex relationships                                       |
| **State Machines** | High        | Unit lifecycle (7 states), Order lifecycle (5 states), Settlement (2 states) |
| **Business Logic** | High        | Pricing tiers, deposit allocation, late fees with grace period               |
| **Integrations**   | Low         | Standalone (no external APIs, photo storage URLs only)                       |
| **Testing**        | Medium      | Full lifecycle integration test required                                     |
| **UI Complexity**  | Medium      | Wizard for order, modal for unit assignment, dashboard for overdue           |

## Governance Update (Constitution v3.4.0)

| Principle | Change  | Rationale                                                                                        |
| --------- | ------- | ------------------------------------------------------------------------------------------------ |
| XXIII     | APPLIED | Rental is universal feature (all businessShapes), sidebar appears when first rental item created |

> **No violations** - Plan fully compliant with Constitution v3.4.0

---

## Phase 0: Research & Unknowns

**Status**: Ready to generate `research.md`

### Research Tasks

1. **Deposit Allocation Algorithm**: How to fairly distribute deposit across multiple units when damages vary?
   - Research: Banking multi-collateral loan models
   - Decide: Pro-rata vs priority-based vs unit-specific coverage

2. **Photo Storage Strategy**: Where to store before/after photos? S3? Cloudinary? Local?
   - Research: Cost vs performance vs compliance (GDPR for customer data)
   - Decide: External URL storage with expiration policy

3. **Unit Lifecycle State Machine**: Validate 7-state model (Available → Reserved → Rented → Returned → Cleaning → Maintenance → Retired)
   - Research: Industrial equipment rental patterns, hotel room management
   - Decide: Confirm transitions, identify edge cases (e.g., Cleaning → Maintenance)

4. **Policy Versioning Pattern**: How to snapshot policy per order without bloating database?
   - Research: SaaS subscription pricing versioning, contract management systems
   - Decide: Embedded JSON vs separate PolicySnapshot table

5. **Damage Severity Auto-Retirement**: Should UNUSABLE damage auto-trigger Retired or require manual confirmation?
   - Research: Insurance claim workflows, automotive rental damage assessment
   - Decide: Auto-retire with audit log vs manual approval workflow

6. **Grace Period Calculation**: How to handle timezone differences for grace period (pickup in morning, return at night)?
   - Research: Car rental late return policies, library book due dates
   - Decide: Calendar hours vs business hours vs timezone-aware

**Output**: research.md with decisions for all 6 unknowns

---

## Phase 1: Design & Contracts

**Prerequisites**: research.md complete

### Deliverables

1. **data-model.md**: 11 entities with relationships, validation rules, indexes
2. **contracts/api.md**: tRPC procedures (mutations, queries, subscriptions if needed)
3. **quickstart.md**: Developer onboarding guide
4. **Agent context update**: Add rental module to `.github/copilot-instructions.md`

### Entity Design Preview

**Core Entities**:

- RentalItem (item type: "Single Bed")
- RentalItemUnit (physical unit: SB-001)
- RentalOrder (customer agreement)
- RentalOrderUnitAssignment (locked assignments)

**Financial Entities**:

- RentalDeposit (liability)
- RentalDepositAllocation (per-unit coverage)
- RentalReturn (settlement record)

**Operational Entities**:

- ItemConditionLog (before/after photos + severity)
- CleaningLog (sanitization tracking)
- CustomerRentalRisk (risk profiling)
- RentalPolicy (versioned configuration)

**Key Relationships**:

```
RentalItem 1───N RentalItemUnit
RentalOrder 1───N RentalOrderUnitAssignment
RentalOrderUnitAssignment N───1 RentalItemUnit
RentalOrder 1───1 RentalDeposit
RentalDeposit 1───N RentalDepositAllocation (optional, NULL if percentage-based)
RentalOrder 1───1 RentalReturn (optional, NULL until returned)
RentalItemUnit 1───N ItemConditionLog
RentalItemUnit 1───N CleaningLog
Partner 1───1 CustomerRentalRisk (extend existing Partner)
RentalOrder N───1 RentalPolicy (snapshot on creation)
```

### tRPC Router Structure

```typescript
rental.
  items.
    list()                  // Query
    create(input)           // Mutation
    addUnit(itemId, code)   // Mutation
    updateUnitStatus(...)   // Mutation

  orders.
    list(filters)           // Query
    create(input)           // Mutation
    confirm(id)             // Mutation (Reserved units)
    release(id, units[])    // Mutation (Active, photos required)
    cancel(id)              // Mutation (Free Reserved units)

  availability.
    check(dateRange)        // Query (calendar)
    getUnitsByItem(itemId)  // Query

  returns.
    process(orderId, ...)   // Mutation (settlement calculation)
    finalize(returnId)      // Mutation (lock settlement)

  policy.
    getCurrent()            // Query
    update(input)           // Mutation (creates new version)

  reports.
    utilization(period)     // Query
    revenue(period)         // Query
    overdue()               // Query
```

---

## Next Steps

1. ✅ Constitution check passed
2. **🔄 NEXT**: Generate `research.md` (Phase 0)
3. **THEN**: Generate `data-model.md` and `contracts/` (Phase 1)
4. **THEN**: Update agent context
5. **FINALLY**: Command ends, report artifacts

**Command Output**: Branch `043-rental-business`, plan at `specs/043-rental-business/plan.md`
