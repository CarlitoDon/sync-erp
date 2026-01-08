# Research: Rental Business Implementation Decisions

**Feature**: 043-rental-business
**Date**: 2026-01-08
**Status**: Phase 0 - Research Complete

## Overview

This document records technical decisions made during research phase to resolve unknowns from the implementation plan. All decisions are informed by industry best practices and aligned with Constitution v3.4.0.

---

## 1. Deposit Allocation Algorithm

### Context

Multi-unit orders (e.g., 3 mattresses) with single deposit (e.g., 300,000 IDR). If one unit has major damage (200,000) and others are fine, how is deposit allocated?

### Research Findings

**Banking Multi-Collateral Loans**:

- Banks use "cross-collateralization" where single loan backed by multiple assets
- If one asset depreciates, bank proportionally adjusts coverage
- Formula: `unit_coverage = total_deposit × (unit_damage / total

\_damages)`

**Hotel Mini-Bar Models**:

- Single deposit covers all items
- Charges deducted in order of severity (most expensive first)
- Simple, predictable for customers

**Car Rental Multi-Vehicle**:

- Per-unit deposit allocation upfront
- Each vehicle has independent coverage
- Clearer accountability but complex for customers

### Decision: **Hybrid Approach**

**Model**:

```typescript
// If deposit policy = PER_UNIT
deposit_per_unit = unit_deposit_amount
each unit gets independent coverage up to `unit_deposit_amount`

// If deposit policy = PERCENTAGE
total_deposit = order_total × percentage
allocation = PRO-RATA based on item rental value
unit_coverage = (unit_rental_value / order_total) × total_deposit

// If deposit policy = HYBRID
total_deposit = max(percentage_deposit, units × per_unit_amount)
allocation = PER-UNIT model (fair and deterministic)
```

**Rationale**:

- **Per-unit**: Clear, fair, protects high-value items
- **Percentage**: Simple for customers (standard practice)
- **Hybrid**: Best of both - safety for business, fairness for customer
- **Pro-rata fallback**: When percentage used, allocate by value proportion

**Implementation**:

- `RentalDepositAllocation` table stores per-unit coverage
- Service calculates at order confirmation
- Settlement deducts from specific unit allocations first

**Alternatives Considered**:

- **Waterfall (most damaged first)**: Rejected - unpredictable for customers
- **Equal split**: Rejected - unfair when units have different values

---

## 2. Photo Storage Strategy

### Context

Before/after photos are MANDATORY for disputes. Need storage that balances cost, performance, GDPR compliance, and availability.

### Research Findings

**S3-Compatible (Supabase Storage, AWS S3, MinIO)**:

- **Pros**: Scalable, low cost ($0.023/GB/month), CDN integration
- **Cons**: External dependency, requires signed URL generation
- **GDPR**: Compliant with proper bucket policies (data residency)

**Cloudinary**:

- **Pros**: Auto-optimization, transformations, built-in CDN
- **Cons**: More expensive ($0.10/GB/month), feature overkill for compliance photos
- **GDPR**: Compliant, has EU data centers

**Local File System**:

- **Pros**: No external dependency, zero cost
- **Cons**: Not scalable, backup complexity, no CDN
- **GDPR**: Manual compliance setup

**Base64 in Database**:

- **Pros**: Simple, no external service
- **Cons**: Bloats database, slow queries, costly backups
- **GDPR**: Automatic compliance with DB backups

### Decision: **Supabase Storage (S3-Compatible)**

**Model**:

```typescript
// Store only URLs in database
ItemConditionLog {
  beforePhotos: string[]  // ["https://storage.../unit-SB001-before-1.jpg"]
  afterPhotos: string[]   // ["https://storage.../unit-SB001-after-1.jpg"]
}

// Upload flow
1. Frontend: Direct upload to Supabase Storage (signed upload URL)
2. Backend: Receive uploaded URL, validate, save to ItemConditionLog
3. Expiration: Set bucket policy to delete after 7 years (legal retention)
```

**Rationale**:

- **Cost-effective**: ~ 100 photos/month × 2MB = 200MB = $0.005/month
- **Scalable**: Handles growth to 10,000 orders/month
- **GDPR-compliant**: Supabase has EU region, bucket policies for data residency
- **Performance**: CDN for fast loading during disputes
- **Integration**: Supabase already in stack (existing auth/db), minimal new dependency

**Implementation**:

- Use Supabase Storage SDK on frontend for direct upload
- Backend validates URL format, checks file exists via HEAD request
- Bucket policy: `rental-photos/` prefix, 7-year retention, private (signed URLs only)

**Alternatives Considered**:

- **Cloudinary**: Rejected - overkill for our use case, 4× more expensive
- **Local FS**: Rejected - not scalable, backup nightmares
- **Base64 in DB**: Rejected - violates performance requirements

---

## 3. Unit Lifecycle State Machine

### Context

Validate 7-state model is sufficient and transitions are logical. Need to handle edge cases like "unit goes to maintenance during cleaning".

### Research Findings

**Industrial Equipment Rental (Caterpillar, Hertz Equipment)**:

- States: Available, Reserved, Out (rented), Returned, Servicing, Offline
- Clean step often bundled with "Returned" (not separate state)
- Our separation of Cleaning is BETTER for hygiene-sensitive items

**Hotel Room Management (PMS Systems)**:

- States: Vacant-Clean, Vacant-Dirty, Occupied, Out-of-Order, Out-of-Service
- **Key insight**: "Dirty" → "Clean" is critical state for room reuse
- Parallels our Returned → Cleaning → Available

**Automotive Rental (Enterprise, Avis)**:

- States: Available, Reserved, On-Rent, Returned, Inspection, Maintenance, Retired
- **Inspection = our Cleaning + condition check**
- Maintenance can happen from any state (emergency repairs)

### Decision: **Confirm 7-State Model with Transition Rules**

**States**:

1. **Available**: Ready to rent
2. **Reserved**: Locked for confirmed order (awaiting pickup)
3. **Rented**: Released to customer (order Active)
4. **Returned**: Awaiting inspection
5. **Cleaning**: Mandatory sanitization (mattress-specific)
6. **Maintenance**: Repair/deep servicing
7. **Retired**: Permanently removed from circulation

**Allowed Transitions**:

```
Available → Reserved (order confirmed)
Reserved → Available (order cancelled)
Reserved → Rented (order released / activated)
Rented → Returned (customer returns items)
Returned → Cleaning (auto-trigger on return)
Cleaning → Available (cleaning complete)
Cleaning → Maintenance (damage found during cleaning)
Maintenance → Available (repair complete)
ANY → Retired (UNUSABLE damage OR manual retirement)
```

**Edge Cases Handled**:

- **Maintenance during Cleaning**: Allowed (damage found during clean)
- **Direct Reserve → Retired**: Allowed (unit damaged before pickup, e.g., warehouse accident)
- **Returned → Retired**: Allowed (lost item marked on return)
- **Cleaning → Retired**: Allowed (severe damage found during inspection)

**Forbidden Transitions**:

- Rented → Available (must go through Returned → Cleaning)
- Maintenance → Rented (must return to Available first)
- Retired → ANY (permanent state)

**Rationale**:

- **Returned is mandatory**: Ensures inspection checkpoint
- **Cleaning is mandatory**: Hygiene for mattresses (Constitution IX: Apple Standard)
- **Retired is terminal**: Audit trail for capacity tracking

**Implementation**:

- Prisma enum: `UnitStatus` with 7 values
- Service validates transitions (throw error if forbidden)
- Unit status updated via `updateUnitStatus()` method with audit log

**Alternatives Considered**:

- **5 states (merge Returned + Cleaning)**: Rejected - loses hygiene checkpoint visibility
- **8 states (add "Inspecting")**: Rejected - over-engineering, Returned implies inspection

---

## 4. Policy Versioning Pattern

### Context

Rental policies change (e.g., grace period 6h → 12h). Need to prevent retroactive application while avoiding database bloat.

### Research Findings

**SaaS Subscription Pricing (Stripe, Chargebee)**:

- Strategy: Create new Price object with `effective_from` date
- Subscriptions snapshot current price at creation
- Changes only affect NEW subscriptions
- **Implementation**: Embedded `price_snapshot` JSON in Subscription

**Contract Management (DocuSign, PandaDoc)**:

- Strategy: Full contract PDF stored per agreement
- Changes to template don't affect signed contracts
- **Implementation**: Document storage (overkill for our case)

**Insurance Policies (Guidewire, Duck Creek)**:

- Strategy: Policy versions with `effective_date` and `expiry_date`
- Claims reference policy version active at incident date
- **Implementation**: Separate `PolicyVersion` table with foreign key

### Decision: **Embedded JSON Snapshot + Active Policy Table**

**Model**:

```typescript
// Active policy (current version)
RentalPolicy {
  id: string
  effectiveFrom: Date
  graceHours: number
  defaultCleaningFee: Decimal
  lateFeeFormula: string  // e.g., "daily_rate * days_late"
  depositPolicy: DepositPolicyType  // PERCENTAGE | PER_UNIT | HYBRID
  depositPercentage: Decimal?
  depositPerUnit: Decimal?
  companyId: string
}

// Snapshot in order (embedded)
RentalOrder {
  id: string
  policySnapshot: Json  // Full RentalPolicy object at order creation
  ...
}
```

**Rationale**:

- **Simple**: No separate PolicyVersion table
- **Audit-safe**: Each order has immutable policy reference
- **Query-friendly**: Can query active policy separately from historical snapshots
- **Storage-efficient**: JSON ~500 bytes per order vs separate table overhead

**Workflow**:

1. **Policy Update**: Create/update RentalPolicy with new `effectiveFrom`
2. **Order Creation**: Snapshot `RentalPolicy.toJSON()` → `order.policySnapshot`
3. **Settlement**: Use `order.policySnapshot` for late fee / grace period (not current policy)

**Implementation**:

- `packages/shared/src/validators/rental.ts`: Zod schema for policy
- Service: `createOrder()` snapshots `JSON.stringify(currentPolicy)`
- Settlement: `JSON.parse(order.policySnapshot)` for calculations

**Alternatives Considered**:

- **Separate PolicyVersion table**: Rejected - unnecessary complexity, harder to query
- **No versioning (always use current)**: Rejected - violates fairness/legal requirements
- **Document storage (PDF)**: Rejected - overkill, we don't need human-readable contract

---

## 5. Damage Severity Auto-Retirement

### Context

UNUSABLE damage detected - should unit auto-retire or require manual confirmation?

### Research Findings

**Insurance Auto Claims (Allstate, Geico)**:

- **Total Loss** (>75% value): Auto-flagged but requires adjuster approval
- Never fully automated - legal/fraud risk

**Equipment Rental (United Rentals)**:

- Severe damage triggers "Out of Service" (not permanent retirement)
- Inspection team manually decides repair vs retire
- **Insight**: Safety buffer prevents premature disposal

**Automotive (Copart, IAA)**:

- Salvage vehicles auto-flagged but auction decision is manual
- Prevents disposal of repairable vehicles

### Decision: **Auto-Flag + Manual Confirmation**

**Model**:

```typescript
// Damage severity classification
damageSeverity: MINOR | MAJOR | UNUSABLE

// Unit status on UNUSABLE damage
if (damageSeverity === UNUSABLE) {
  unitStatus = MAINTENANCE  // Not Retired
  flagForRetirement = true
  retirementReason = "UNUSABLE damage recorded on {date}"
  assignedTo = "manager"
}

// Manager reviews, then:
confirmRetirement(unitId) {
  unitStatus = RETIRED
  retiredAt = now
  retirementConfirmedBy = userId
}
```

**Rationale**:

- **Safety net**: Manager can assess if repair is possible (e.g., foam replacement vs full unit)
- **Audit trail**: Explicit confirmation prevents "accidental" retirements
- **Cost optimization**: Some UNUSABLE damages might be economically repairable
- **Fraud prevention**: Staff can't easily "retire" units to hide theft

**Workflow**:

1. Staff marks damage as **UNUSABLE** on return
2. System sets unit to **MAINTENANCE** (not Available, not Retired)
3. System creates task: "Review unit SB-001 for retirement"
4. Manager inspects, decides: Retire permanently OR Repair and return to service

**Implementation**:

- `ItemConditionLog.damageSeverity = UNUSABLE` triggers workflow
- Service: `flagUnitForRetirement(unitId, reason)`
- Frontend: Manager dashboard shows flagged units
- API: `confirmRetirement(unitId)` sets `status = RETIRED`

**Alternatives Considered**:

- **Full auto-retirement**: Rejected - too risky, irreversible without audit pain
- **Always manual (no auto-flag)**: Rejected - staff might forget to escalate severe damage

---

## 6. Grace Period Calculation

### Context

Grace period (e.g., 6 hours) for late returns - how to handle timezone, business hours, night returns?

### Research Findings

**Car Rental (Budget, Sixt)**:

- Grace period: **59 minutes** (< 1 hour = no charge)
- Calculated as: `actual_return_time > due_time + grace_period`
- **Clock time, not business hours**

**Library Systems (Follett, SirsiDynix)**:

- Due date: Calendar day (e.g., Jan 15)
- Grace: Until library closes next day (business hours aware)
- Our case: Mattress pickup/return isn't time-sensitive like library hours

**Parking Systems (ParkMobile, SpotHero)**:

- Grace: 5-15 minutes after expiry
- **Absolute time** (timezone-aware): `expires_at + grace_minutes`

### Decision: **Calendar Hours (Absolute Time), Timezone-Aware**

**Model**:

```typescript
// Order return calculation
dueDateTime: Date  // e.g., 2026-01-17 18:00:00 +07:00 (Jakarta)
graceHours: number  // from policySnapshot (e.g., 6)

actualReturnDateTime: Date  // e.g., 2026-01-17 22:00:00 +07:00

// Late fee logic
gracePeriodEnd = dueDateTime + (graceHours * 1 hour)
if (actualReturnDateTime <= gracePeriodEnd) {
  lateFee = 0
} else {
  hoursLate = actualReturnDateTime - gracePeriodEnd
  daysLate = Math.ceil(hoursLate / 24)
  lateFee = dailyRate * daysLate
}
```

**Rationale**:

- **Predictable**: Customer knows exact cutoff (6pm + 6h = midnight)
- **Timezone-safe**: All timestamps in local timezone (Jakarta Time)
- **Fair**: Night returns (e.g., 10pm for 6pm due) covered by grace period
- **Simple**: No business hours complexity (mattress rental isn't 9-5 operation)

**Edge Cases**:

- **Return at 11:59pm on due date**: Grace period extends to 5:59am next day → No charge
- **Return at 6:01am next day**: 1 minute late after grace → Charge 1 full day (policy)
- **Multiple days late**: Round up to nearest day (3.5 days = 4 days charged)

**Implementation**:

- `RentalOrder.dueDateTime` stored as timestamptz (Postgres timezone-aware)
- Service: `calculateLateFee(order, actualReturn)` uses policy grace period
- Frontend: Display due time + grace period (e.g., "Due: Jan 17, 6pm (grace until midnight)")

**Alternatives Considered**:

- **Business hours only**: Rejected - rental business often operates odd hours
- **Full-day grace (next midnight)**: Rejected - too generous, reduces revenue
- **Minutes-based (59 min like cars)**: Rejected - insufficient for mattress logistics

---

## Summary of Decisions

| Research Topic         | Decision                       | Key Rationale                             |
| ---------------------- | ------------------------------ | ----------------------------------------- |
| **Deposit Allocation** | Hybrid (per-unit or pro-rata)  | Fair, deterministic, flexible             |
| **Photo Storage**      | Supabase Storage (S3)          | Cost-effective, scalable, GDPR-compliant  |
| **Unit Lifecycle**     | 7-state model confirmed        | Mandatory cleaning checkpoint for hygiene |
| **Policy Versioning**  | Embedded JSON snapshot         | Simple, audit-safe, query-friendly        |
| **Damage Auto-Retire** | Auto-flag + manual confirm     | Safety net, fraud prevention              |
| **Grace Period**       | Calendar hours, timezone-aware | Predictable, fair for night returns       |

**All unknowns from Phase 0 resolved. Ready for Phase 1: Design.**

---

## Implementation Notes

1. **Deposit**: Service calculates allocation at order confirmation, stored in `RentalDepositAllocation`
2. **Photos**: Frontend uploads to Supabase, backend validates URL before saving
3. **State Machine**: Service enforces transitions, throws error if invalid
4. **Policy**: Snapshot at `createOrder()`, parsed at settlement
5. **Retirement**: Workflow task created on UNUSABLE, manager confirms
6. **Late Fee**: Use policy snapshot grace period, round up to full days

**Next**: Proceed to Phase 1 (data-model.md, contracts/)
