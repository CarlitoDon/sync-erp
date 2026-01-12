# Tasks: Rental Business Implementation

**Feature**: 043-rental-business
**Date**: 2026-01-08
**Status**: Ready for Implementation

---

## Phase 1: Database Schema

### T-001: Add Rental Entities to Prisma Schema

- [x] Add 11 new models from `data-model.md` to `packages/database/prisma/schema.prisma`
- [x] Add 8 new enums (DepositPolicyType, UnitCondition, UnitStatus, etc.)
- [x] Add relation to Partner model: `rentalRisk CustomerRentalRisk?`
- [x] Add relation to Company model for all rental entities
- [x] Run `npx prisma migrate dev --name add-rental-entities`
- [x] Run `npx prisma generate`
- [x] Verify schema with `npx prisma studio`

**Dependencies**: None
**Effort**: Medium

---

## Phase 2: Shared Types & Validators

### T-002: Create Rental Zod Schemas

- [x] Create `packages/shared/src/validators/rental.ts`
- [x] Add rental schemas for Item, Order, Return
- [x] Add types for all API inputs/outputs
- [x] Add `export * from './rental'` to `validators/index.ts`
- [x] Rebuild: `cd packages/shared && npm run build`

**Dependencies**: T-001
**Effort**: Low

---

## Phase 3: Backend Module

### T-003: Create Rental Repository

- [x] Create `apps/api/src/modules/rental/rental.repository.ts`
- [x] Implement methods: `createRentalItem`, `listRentalItems`
- [x] Implement methods: `createRentalOrder`, `findOrderById`
- [x] Implement methods for Returns and Deposits
- [x] Implement methods:
  - `findItems()`, `createItem()`, `addUnit()`
  - `findAvailableUnits()`, `updateUnitStatus()`
  - `createOrder()`, `confirmOrder()`, `releaseOrder()`
  - `processReturn()`, `finalizeReturn()`
  - `getCurrentPolicy()`, `updatePolicy()`

**Dependencies**: T-001, T-002
**Effort**: High

### T-004: Create Rental Policy

- [x] Create `apps/api/src/modules/rental/rental.policy.ts`
- [x] Implement Validation:
  - `ensureUnitsAvailable`
  - `ensureDepositSufficient`
  - `ensureCanRelease`, `ensureCanReturn`
  - `validateSettlement(returnId)`
  - `validateCustomerRisk(partnerId)`

**Dependencies**: T-003
**Effort**: Medium

### T-005: Create Rental Rules (Pure Logic)

- [X] Create `apps/api/src/modules/rental/rules/pricing.ts`
- [X] Create `apps/api/src/modules/rental/rules/deposit.ts`
- [X] Create `apps/api/src/modules/rental/rules/late-fee.ts`
- [X] All functions pure (no side effects, testable)

**Dependencies**: None
**Effort**: Low

### T-006: Create Rental Service

- [X] Create `apps/api/src/modules/rental/rental.service.ts`
- [X] Inject Repository, Policy via constructor
- [X] Implement orchestration methods following 4-phase pattern (Prepare, Orchestrate, Execute, Post-Process)
- [X] Use transactions for multi-step operations

**Dependencies**: T-003, T-004, T-005
**Effort**: High

### T-007: Register DI Container

- [X] Add `RENTAL_SERVICE`, `RENTAL_REPOSITORY` to `ServiceKeys` enum
- [X] Register in `apps/api/src/modules/common/di/register.ts`

**Dependencies**: T-006
**Effort**: Low

### T-008: Create Rental Router

- [X] Create `apps/api/src/trpc/routers/rental.router.ts`
- [X] Use `protectedProcedure` for all endpoints
- [X] Resolve service via DI container
- [X] Add to `apps/api/src/trpc/router.ts`: `rental: rentalRouter`

**Dependencies**: T-007
**Effort**: Medium

---

## Phase 4: Frontend Module

### T-009: Create Feature Structure

- [x] Create `apps/web/src/features/rental/` folder structure
- [x] Add folders: `components/`, `hooks/`, `modals/`, `pages/`, `utils/`
- [x] Create `types.ts` for frontend types

**Dependencies**: T-008
**Effort**: Low

### T-010: Create Rental Hooks

- [x] Create `hooks/useRentalMutations.ts` (apiAction + cache invalidation)
- [x] Create `hooks/useUnitAvailability.ts` (availability queries)

**Dependencies**: T-008, T-009
**Effort**: Medium

### T-011: Create Main Pages

- [x] Create `pages/RentalItemsPage.tsx` (list items, add units)
- [x] Create `pages/RentalOrdersPage.tsx` (list orders)
- [x] Create `pages/ReturnsPage.tsx` (process returns)
- [x] Create `pages/OverduePage.tsx` (overdue dashboard)

**Dependencies**: T-010
**Effort**: High

### T-012: Create Modals

- [x] Create `modals/RentalOrderModal.tsx` (order wizard)
- [x] Create `modals/UnitAssignmentModal.tsx` (assign units with photos)
- [x] Create `modals/ReturnModal.tsx` (return + settlement)
- [x] Create `modals/UnitStatusModal.tsx` (status transitions)

**Dependencies**: T-010
**Effort**: High

### T-013: Add Sidebar & Routing

- [x] Add rental routes to router configuration
- [x] Add "Rental" menu to sidebar (visible when rental items exist)
- [x] Follow existing sidebar patterns

**Dependencies**: T-011
**Effort**: Low

---

## Phase 5: Testing

### T-014: Create Integration Test

- [ ] Create `apps/api/test/integration/rental-flow.test.ts`
- [ ] Test complete lifecycle in single `it()`:
  - Create item → Add units
  - Create order → Confirm → Release
  - Return → Finalize
  - Verify final states
- [ ] Run: `npm test -- rental-flow`

**Dependencies**: T-008
**Effort**: High

### T-015: Create Rules Unit Tests

- [ ] Test `pricing.ts` (tier selection)
- [ ] Test `deposit.ts` (allocation logic)
- [ ] Test `late-fee.ts` (grace period calculation)

**Dependencies**: T-005
**Effort**: Low

---

## Phase 6: Seed Data

### T-016: Create Rental Seed Script

- [ ] Create `apps/api/scripts/seed-rental.ts`
- [ ] Seed default RentalPolicy for demo company
- [ ] Seed sample RentalItem with 2-3 units
- [ ] Add to package.json: `"seed:rental": "npx ts-node scripts/seed-rental.ts"`

**Dependencies**: T-001
**Effort**: Low

---

## Phase 7: Coverage Gaps (Analysis Remediation)

### T-017: Implement Auto-Cancel Scheduler (FR-008A)

- [ ] Add pickup grace period config to RentalPolicy
- [ ] Create scheduled job to check expired reservations
- [ ] Auto-cancel orders past `rentalStartDate + pickupGraceHours`
- [ ] Release reserved units back to AVAILABLE
- [ ] Send notification (future: email/SMS)

**Dependencies**: T-006
**Effort**: Medium

### T-018: Generate Rental Agreement PDF (FR-009)

- [ ] Create PDF template for rental agreement
- [ ] Add `generateAgreement()` method to RentalService
- [ ] Include: items, dates, pricing, deposit, terms
- [ ] Add download button to RentalOrderModal

**Dependencies**: T-006, T-012
**Effort**: Medium

### T-019: Reports Endpoints & Pages (FR-029-031)

- [ ] Add `rental.reports.utilization` endpoint (% rented per period)
- [ ] Add `rental.reports.revenue` endpoint (by category)
- [ ] Add `rental.reports.calendar` endpoint (availability grid)
- [ ] Create `pages/ReportsPage.tsx` with charts
- [ ] Add to sidebar navigation

**Dependencies**: T-008, T-011
**Effort**: High

### T-020: Customer Risk UI (FR-025-028)

- [ ] Create `modals/CustomerRiskModal.tsx` (view/edit risk level)
- [ ] Add risk badge to customer selector in RentalOrderModal
- [ ] Show warning modal for Watchlist/Blacklisted customers
- [ ] Allow staff override with reason

**Dependencies**: T-012
**Effort**: Medium

---

## Summary

| Phase         | Tasks  | Effort        |
| ------------- | ------ | ------------- |
| Database      | 1      | Medium        |
| Shared        | 1      | Low           |
| Backend       | 6      | High          |
| Frontend      | 5      | High          |
| Testing       | 2      | Medium        |
| Seed          | 1      | Low           |
| Coverage Gaps | 4      | Medium-High   |
| **Total**     | **20** | **4-5 weeks** |

## Critical Path

```
T-001 → T-002 → T-003 → T-004 → T-006 → T-007 → T-008 → T-014
                  ↑
                T-005
```

## Notes

- All IDs use `uuid()` (not cuid)
- All Decimals use `(15, 2)` precision
- Router is at `trpc/routers/`, not in module folder
- No controller layer - router calls service directly
- Use `protectedProcedure` (not shapedProcedure)
- Frontend has separate `modals/` folder
