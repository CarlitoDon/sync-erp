# Data Model: Rental Business

**Feature**: 043-rental-business
**Date**: 2026-01-08
**Status**: Phase 1 - Data Model Design

## Overview

This document defines the database schema for the rental business feature, including 11 new entities, relationships, indexes, and validation rules. All entities are multi-tenant (scoped by `companyId`).

---

## Entity Definitions

### 1. RentalItem

**Purpose**: Rental item type (e.g., "Single Bed", "Queen Mattress")

**Fields**:

```prisma
model RentalItem {
  id                 String   @id @default(uuid())
  companyId          String   // Multi-tenant isolation

  // Item details
  name               String   // e.g., "Single Bed"
  description        String?
  category           String   // e.g., "Mattress", "Furniture"

  // Pricing tiers
  dailyRate          Decimal  @db.Decimal(15, 2)
  weeklyRate         Decimal  @db.Decimal(15, 2)
  monthlyRate        Decimal  @db.Decimal(15, 2)

  // Deposit policy
  depositPolicyType  DepositPolicyType  // PERCENTAGE | PER_UNIT | HYBRID
  depositPercentage  Decimal?  @db.Decimal(5, 2)  // e.g., 50.00 = 50%
  depositPerUnit     Decimal?  @db.Decimal(15, 2)  // e.g., 100000.00 IDR

  // Metadata
  isActive           Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  // Relations
  company            Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  units              RentalItemUnit[]

  @@index([companyId, isActive])
  @@index([companyId, category])
}

enum DepositPolicyType {
  PERCENTAGE  // e.g., 50% of order total
  PER_UNIT    // e.g., 100,000 per mattress
  HYBRID      // max(percentage, perUnit × qty)
}
```

**Validation Rules**:

- `dailyRate > 0`
- `weeklyRate < 7 × dailyRate` (economic incentive)
- `monthlyRate < 30 × dailyRate`
- If `depositPolicyType = PERCENTAGE`, `depositPercentage` required (1-100)
- If `depositPolicyType = PER_UNIT`, `depositPerUnit` required (> 0)
- If `depositPolicyType = HYBRID`, both required

---

### 2. RentalItemUnit

**Purpose**: Individual physical unit of a rental item

**Fields**:

```prisma
model RentalItemUnit {
  id                 String      @id @default(uuid())
  rentalItemId       String
  companyId          String      // Denormalized for tenant isolation

  // Unit identification
  unitCode           String      // e.g., "SB-001", "SB-002" (unique per company)

  // Current state
  condition          UnitCondition  // NEW | GOOD | FAIR | NEEDS_REPAIR
  status             UnitStatus     // State machine (7 states)

  // Aging / usage metrics
  totalRentalDays    Int         @default(0)
  totalRentalCount   Int         @default(0)
  lastDeepCleaningAt DateTime?

  // Retirement tracking
  retiredAt          DateTime?
  retirementReason   String?
  flaggedForRetirement Boolean  @default(false)

  // Metadata
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  // Relations
  rentalItem         RentalItem  @relation(fields: [rentalItemId], references: [id], onDelete: Cascade)
  company            Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  assignments        RentalOrderUnitAssignment[]
  conditionLogs      ItemConditionLog[]
  cleaningLogs       CleaningLog[]

  @@unique([companyId, unitCode])
  @@index([rentalItemId, status])  // For availability queries
  @@index([companyId, status])
}

enum UnitCondition {
  NEW
  GOOD
  FAIR
  NEEDS_REPAIR
}

enum UnitStatus {
  AVAILABLE     // Ready to rent
  RESERVED      // Locked for confirmed order
  RENTED        // Released to customer
  RETURNED      // Awaiting inspection
  CLEANING      // Mandatory sanitization
  MAINTENANCE   // Repair/servicing
  RETIRED       // Permanently removed
}
```

**Validation Rules**:

- `unitCode` format: `[A-Z]{2,4}-\d{3,5}` (e.g., SB-001, QUEEN-00123)
- `totalRentalDays >= 0`, `totalRentalCount >= 0`
- If `status = RETIRED`, `retiredAt` and `retirementReason` required
- `lastDeepCleaningAt <= now()`

**State Transitions** (enforced in Service layer):

```
Available → Reserved | Retired
Reserved → Available | Rented | Retired
Rented → Returned | Retired
Returned → Cleaning | Retired
Cleaning → Available | Maintenance | Retired
Maintenance → Available | Retired
Retired → (terminal)
```

---

### 3. RentalOrder

**Purpose**: Customer rental agreement

**Fields**:

```prisma
model RentalOrder {
  id                 String      @id @default(uuid())
  companyId          String
  partnerId          String      // Customer (existing Partner entity)

  // Order details
  orderNumber        String      // Auto-generated: RNT-2026-001
  rentalStartDate    DateTime    // Pickup date
  rentalEndDate      DateTime    // Due date
  dueDateTime        DateTime    // Specific return time (for grace period)

  // Status
  status             OrderStatus

  // Financial
  subtotal           Decimal     @db.Decimal(15, 2)  // Sum of item charges
  depositAmount      Decimal     @db.Decimal(15, 2)
  totalAmount        Decimal     @db.Decimal(15, 2)  // subtotal (deposit separate)

  // Policy snapshot (versioning)
  policySnapshot     Json        // RentalPolicy at time of creation

  // Metadata
  notes              String?
  confirmedAt        DateTime?
  activatedAt        DateTime?   // When items released
  completedAt        DateTime?   // When return finalized
  cancelledAt        DateTime?
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt
  createdBy          String

  // Relations
  company            Company        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  partner            Partner        @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  items              RentalOrderItem[]
  unitAssignments    RentalOrderUnitAssignment[]
  deposit            RentalDeposit?
  return             RentalReturn?

  @@unique([companyId, orderNumber])
  @@index([companyId, status])
  @@index([companyId, partnerId])
  @@index([dueDateTime])  // For overdue detection
}

enum OrderStatus {
  DRAFT       // Being created
  CONFIRMED   // Deposit collected, units reserved
  ACTIVE      // Items released to customer
  COMPLETED   // Items returned, settled
  CANCELLED   // Order cancelled before release
}

// Line items for order
model RentalOrderItem {
  id                 String      @id @default(uuid())
  rentalOrderId      String
  rentalItemId       String

  quantity           Int
  unitPrice          Decimal     @db.Decimal(15, 2)  // Selected tier (daily/weekly/monthly)
  pricingTier        PricingTier
  subtotal           Decimal     @db.Decimal(15, 2)  // quantity × unitPrice

  rentalOrder        RentalOrder @relation(fields: [rentalOrderId], references: [id], onDelete: Cascade)
  rentalItem         RentalItem  @relation(fields: [rentalItemId], references: [id], onDelete: Cascade)

  @@index([rentalOrderId])
}

enum PricingTier {
  DAILY
  WEEKLY
  MONTHLY
  CUSTOM
}
```

**Validation Rules**:

- `orderNumber` format: `RNT-{YYYY}-{seq}` (auto-generated)
- `rentalEndDate > rentalStartDate`
- `dueDateTime >= rentalEndDate` (can be same day or later for grace)
- `subtotal = sum(items.subtotal)`
- `depositAmount <= totalAmount`
- If `status = CONFIRMED`, `confirmedAt` required
- If `status = ACTIVE`, `activatedAt` required and `unitAssignments.length > 0`
- `policySnapshot` must be valid RentalPolicy JSON

---

### 4. RentalOrderUnitAssignment

**Purpose**: Lock specific units to orders (prevents swaps)

**Fields**:

```prisma
model RentalOrderUnitAssignment {
  id                 String           @id @default(uuid())
  rentalOrderId      String
  rentalItemUnitId   String

  // Assignment metadata
  lockedAt           DateTime         @default(now())
  lockedBy           String           // User who confirmed order

  // Override tracking (if unit swapped)
  overriddenAt       DateTime?
  overriddenBy       String?
  overrideReason     String?

  // Relations
  rentalOrder        RentalOrder      @relation(fields: [rentalOrderId], references: [id], onDelete: Cascade)
  rentalItemUnit     RentalItemUnit   @relation(fields: [rentalItemUnitId], references: [id], onDelete: Cascade)

  @@unique([rentalOrderId, rentalItemUnitId])  // One unit can't be assigned twice to same order
  @@index([rentalItemUnitId, rentalOrderId])
}
```

**Validation Rules**:

- Cannot create assignment if `rentalItemUnit.status != AVAILABLE` (unless override)
- If override, `overrideReason` required (min 10 chars)
- `overriddenAt` and `overriddenBy` must be set together

---

### 5. RentalDeposit

**Purpose**: Security deposit (liability tracking)

**Fields**:

```prisma
model RentalDeposit {
  id                 String      @id @default(uuid())
  rentalOrderId      String      @unique
  companyId          String

  // Deposit details
  amount             Decimal     @db.Decimal(15, 2)
  policyType         DepositPolicyType

  // Status tracking
  status             DepositStatus
  collectedAt        DateTime?
  refundedAt         DateTime?
  forfeitedAt        DateTime?

  // Payment tracking
  paymentMethod      String?     // e.g., "Cash", "Transfer", "Card"
  paymentReference   String?     // e.g., transaction ID

  // Relations
  rentalOrder        RentalOrder @relation(fields: [rentalOrderId], references: [id], onDelete: Cascade)
  company            Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  allocations        RentalDepositAllocation[]  // Optional (NULL if percentage-based)

  @@index([companyId, status])
}

enum DepositStatus {
  PENDING     // Awaiting collection
  COLLECTED   // Deposit received
  REFUNDED    // Returned to customer
  FORFEITED   // Kept due to damage/loss
  PARTIAL_REFUND  // Part refunded, part forfeited
}
```

**Validation Rules**:

- `amount > 0`
- If `status = COLLECTED`, `collectedAt` required
- If `status = REFUNDED`, `refundedAt` required
- If `status = FORFEITED`, `forfeitedAt` required

---

### 6. RentalDepositAllocation

**Purpose**: Per-unit deposit coverage (for deterministic settlement)

**Fields**:

```prisma
model RentalDepositAllocation {
  id                 String      @id @default(uuid())
  depositId          String
  unitId             String      // RentalItemUnit.id

  // Allocation amounts
  maxCoveredAmount   Decimal     @db.Decimal(15, 2)  // Max this unit can claim
  usedAmount         Decimal     @db.Decimal(15, 2)  @default(0)  // Amount used for damages

  // Relations
  deposit            RentalDeposit    @relation(fields: [depositId], references: [id], onDelete: Cascade)
  unit               RentalItemUnit   @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@unique([depositId, unitId])
  @@index([depositId])
}
```

**Validation Rules**:

- `maxCoveredAmount >= usedAmount`
- `usedAmount >= 0`
- Sum of all `usedAmount` for deposit <= `deposit.amount`

---

### 7. RentalReturn

**Purpose**: Return record with settlement calculation

**Fields**:

```prisma
model RentalReturn {
  id                 String      @id @default(uuid())
  rentalOrderId      String      @unique
  companyId          String

  // Return details
  actualReturnDate   DateTime    // When customer returned items

  // Charges breakdown
  baseRentalFee      Decimal     @db.Decimal(15, 2)
  lateFee            Decimal     @db.Decimal(15, 2)  @default(0)
  damageCharges      Decimal     @db.Decimal(15, 2)  @default(0)
  cleaningFees       Decimal     @db.Decimal(15, 2)  @default(0)
  otherCharges       Decimal     @db.Decimal(15, 2)  @default(0)

  // Settlement
  totalCharges       Decimal     @db.Decimal(15, 2)  // Sum of above
  depositApplied     Decimal     @db.Decimal(15, 2)
  balanceDue         Decimal     @db.Decimal(15, 2)  // If positive: charge customer
  balanceRefund      Decimal     @db.Decimal(15, 2)  // If positive: refund customer

  // Status
  status             ReturnStatus
  settledAt          DateTime?   // When finalized (immutable after)
  settledBy          String?

  // Metadata
  notes              String?
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt
  createdBy          String

  // Relations
  rentalOrder        RentalOrder @relation(fields: [rentalOrderId], references: [id], onDelete: Cascade)
  company            Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId, status])
}

enum ReturnStatus {
  DRAFT      // Being calculated
  SETTLED    // Finalized (immutable)
}
```

**Validation Rules**:

- `totalCharges = baseRentalFee + lateFee + damageCharges + cleaningFees + otherCharges`
- `balanceDue = max(0, totalCharges - depositApplied)`
- `balanceRefund = max(0, depositApplied - totalCharges)`
- `balanceDue` and `balanceRefund` are mutually exclusive (one must be 0)
- If `status = SETTLED`, NO updates allowed (immutable)
- If `status = SETTLED`, `settledAt` and `settledBy` required

---

### 8. ItemConditionLog

**Purpose**: Before/after condition tracking with photos

**Fields**:

```prisma
model ItemConditionLog {
  id                 String      @id @default(uuid())
  rentalItemUnitId   String
  rentalOrderId      String?     // NULL if maintenance/general inspection

  // Condition assessment
  recordedAt         DateTime    @default(now())
  conditionType      ConditionType  // RELEASE | RETURN | INSPECTION | CLEANING
  condition          UnitCondition
  damageSeverity     DamageSeverity?  // NULL if no damage

  // Photo evidence (URLs to Supabase Storage)
  beforePhotos       String[]    // JSON array of URLs (if RELEASE)
  afterPhotos        String[]    // JSON array of URLs (if RETURN)

  // Assessment details
  notes              String?
  assessedBy         String      // User ID

  // Relations
  rentalItemUnit     RentalItemUnit @relation(fields: [rentalItemUnitId], references: [id], onDelete: Cascade)
  rentalOrder        RentalOrder?    @relation(fields: [rentalOrderId], references: [id], onDelete: Cascade)

  @@index([rentalItemUnitId, recordedAt])
  @@index([rentalOrderId])
}

enum ConditionType {
  RELEASE      // When releasing to customer
  RETURN       // When customer returns
  INSPECTION   // Periodic inspection
  CLEANING     // During cleaning process
}

enum DamageSeverity {
  MINOR       // Cosmetic, no functional impact
  MAJOR       // Functional impact, still usable
  UNUSABLE    // Not safe/suitable for re-rental
}
```

**Validation Rules**:

- If `conditionType = RELEASE`, `beforePhotos` required (min 1 photo)
- If `conditionType = RETURN` and `damage Severity != NULL`, `afterPhotos` required
- Photo URLs must match format: `https://storage.supabase.co/...`
- If `damageSeverity = UNUSABLE`, `notes` required

---

### 9. CleaningLog

**Purpose**: Cleaning/sanitization tracking

**Fields**:

```prisma
model CleaningLog {
  id                 String      @id @default(uuid())
  rentalItemUnitId   String

  // Cleaning details
  cleanedAt          DateTime
  cleanedBy          String      // User ID
  cleaningType       CleaningType

  // Actions performed
  notes              String      // e.g., "Washed, sun-dried, disinfected"

  // Relations
  rentalItemUnit     RentalItemUnit @relation(fields: [rentalItemUnitId], references: [id], onDelete: Cascade)

  @@index([rentalItemUnitId, cleanedAt])
}

enum CleaningType {
  STANDARD      // After each return
  DEEP          // Periodic deep cleaning
  EMERGENCY     // Spills, stains, odor
}
```

**Validation Rules**:

- `notes` required (min 10 chars)
- `cleanedAt <= now()`

---

### 10. CustomerRentalRisk

**Purpose**: Customer risk profiling (extends Partner)

**Fields**:

```prisma
model CustomerRentalRisk {
  id                 String      @id @default(uuid())
  partnerId          String      @unique  // One-to-one with Partner
  companyId          String

  // Risk assessment
  riskLevel          RiskLevel

  // Tracking
  notes              String?     // History of issues
  flaggedAt          DateTime?
  flaggedBy          String?
  lastReviewedAt     DateTime?

  // Statistics (denormalized for performance)
  totalRentals       Int         @default(0)
  lateReturns        Int         @default(0)
  damageIncidents    Int         @default(0)
  depositForfeits    Int         @default(0)

  // Relations
  partner            Partner     @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  company            Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId, riskLevel])
}

enum RiskLevel {
  NORMAL        // Standard customer
  WATCHLIST     // Minor issues (1-2 late returns)
  BLACKLISTED   // Severe violations (major damage, non-payment)
}
```

**Validation Rules**:

- If `riskLevel = WATCHLIST | BLACKLISTED`, `notes` required
- If `riskLevel != NORMAL`, `flaggedAt` and `flaggedBy` required
- `totalRentals >= lateReturns + damageIncidents`

---

### 11. RentalPolicy

**Purpose**: Versioned policy configuration

**Fields**:

```prisma
model RentalPolicy {
  id                 String      @id @default(uuid())
  companyId          String

  // Version tracking
  effectiveFrom      DateTime    @default(now())
  replacedAt         DateTime?   // When new version created
  isActive           Boolean     @default(true)  // Only one active per company

  // Policy parameters
  graceHours         Int         // e.g., 6 hours
  defaultCleaningFee Decimal     @db.Decimal(15, 2)
  lateFeeFormula     String      // e.g., "daily_rate * days_late"

  // Deposit defaults
  defaultDepositPolicyType      DepositPolicyType
  defaultDepositPercentage      Decimal?  @db.Decimal(5, 2)
  defaultDepositPerUnit         Decimal?  @db.Decimal(15, 2)

  // Metadata
  createdAt          DateTime    @default(now())
  createdBy          String

  // Relations
  company            Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([companyId, isActive])  // Only one active policy per company
  @@index([companyId, effectiveFrom])
}
```

**Validation Rules**:

- `graceHours >= 0` and `<= 72` (max 3 days)
- `defaultCleaningFee >= 0`
- Only one `isActive = true` per `companyId`
- `lateFeeFormula` must be valid expression (validated in Service)

---

## Relationships Summary

```
Company 1───N RentalItem
RentalItem 1───N RentalItemUnit
RentalItem 1───N RentalOrderItem

Company 1───N RentalOrder
Partner 1───N RentalOrder
RentalOrder 1───N RentalOrderItem
RentalOrder 1───N RentalOrderUnitAssignment
RentalOrder 1───1? RentalDeposit
RentalOrder 1───1? RentalReturn

RentalOrderUnitAssignment N───1 RentalItemUnit

RentalDeposit 1───N RentalDepositAllocation
RentalDepositAllocation N───1 RentalItemUnit

RentalItemUnit 1───N ItemConditionLog
RentalItemUnit 1───N CleaningLog

Partner 1───1? CustomerRentalRisk
Company 1───N RentalPolicy
```

---

## Indexes Strategy

**Query Patterns**:

1. **Availability Check**: `WHERE companyId = X AND status = AVAILABLE` → Index on `(companyId, status)`
2. **Overdue Detection**: `WHERE dueDateTime < NOW() AND status = ACTIVE` → Index on `dueDateTime`
3. **Customer Orders**: `WHERE companyId = X AND partnerId = Y` → Index on `(companyId, partnerId)`
4. **Unit History**: `WHERE rentalItemUnitId = X ORDER BY recordedAt DESC` → Index on `(rentalItemUnitId, recordedAt)`

**Index Coverage**: All foreign keys auto-indexed, additional composite indexes for common queries.

---

## Data Migration Notes

1. **Seed Data**:
   - Create default `RentalPolicy` for each company
   - Sample `RentalItem` with 2-3 units for demo

2. **Existing Data**:
   - Extend `Partner` with optional `CustomerRentalRisk` (created on-demand)
   - No changes to existing entities

3. **Rollback Plan**:
   - Drop all 11 tables (no foreign keys to existing entities except Company/Partner)
   - Remove rental routes from tRPC router

---

## Next Steps

1. ✅ Data model defined
2. **NEXT**: Generate `contracts/api.md` (tRPC procedures)
3. **THEN**: Generate `quickstart.md`
4. **FINALLY**: Update agent context

**Phase 1 Progress**: 33% complete
