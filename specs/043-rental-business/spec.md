# Feature Specification: Rental Business Support

**Feature Branch**: `043-rental-business`
**Created**: 2026-01-08
**Status**: Draft
**Input**: User description: "erp ini untuk support bisnis persewaan"

## User Scenarios & Testing

### User Story 1 - Manage Rental Items (Priority: P1)

As a Rental Business Owner, I want to manage my rental inventory (beds, equipment, etc.) with rental-specific attributes (daily/weekly/monthly rates, maintenance schedules, condition tracking) so that I can accurately price rentals and track item availability.

**Why this priority**: Core requirement for rental business. Without rentable item management, the business cannot operate.

**Integration Scenario**: Create rental item → Set rental rates → Verify item appears in rental catalog → Verify availability tracking works.

**Acceptance Scenarios**:

1. **Given** I am on the Rental Items screen, **When** I create a new item "Single Bed" with daily rate 15,000, weekly rate 90,000, monthly rate 300,000, **Then** the item is available for rental orders.
2. **Given** a rental item, **When** I set quantity to 10 units, **Then** the system tracks availability for each unit independently.
3. **Given** a rental item, **When** I mark it for maintenance, **Then** it becomes unavailable for new rentals until maintenance is cleared.
4. **Given** a rental item, **When** I view its history, **Then** I see all past rentals, returns, and condition reports.

---

### User Story 2 - Create Rental Order (Priority: P1)

As a Rental Staff, I want to create a rental order specifying customer, items, rental period (start/end dates), and pricing so that I can formalize the rental agreement and track expected returns.

**Why this priority**: Primary transaction type for rental business. Must support flexible date ranges and automatic pricing calculation.

**Integration Scenario**: Create rental order → Select items → Set rental period → System calculates total based on rates → Confirm order → Items marked as rented.

**Acceptance Scenarios**:

1. **Given** I am creating a rental order, **When** I select "Single Bed" (qty 2) for 7 days, **Then** the system calculates total as 2 × 90,000 = 180,000 (weekly rate is cheaper than 7 × daily).
2. **Given** a rental order, **When** I set dates from Jan 10 to Jan 17 (7 days), **Then** the system automatically selects the most economical pricing tier (weekly vs 7×daily).
3. **Given** 10 units of an item and 8 are already rented, **When** I try to rent 3 more, **Then** the system prevents the order (insufficient availability).
4. **Given** a confirmed rental order, **When** I generate the rental agreement, **Then** it includes item list, dates, pricing breakdown, deposit amount, and terms.

---

### User Story 3 - Collect Rental Deposit (Priority: P1)

As a Rental Staff, I want to collect a security deposit when confirming a rental order so that I have financial protection against damage or late returns.

**Why this priority**: Standard practice in rental businesses to mitigate risk.

**Integration Scenario**: Confirm rental order → Collect deposit → Record deposit in ledger → Link deposit to rental order.

**Acceptance Scenarios**:

1. **Given** a rental order total of 180,000, **When** I set deposit policy to 50% and collect deposit, **Then** the system records 90,000 as Customer Deposit (Liability).
2. **Given** a rental order with deposit collected, **When** I view the order, **Then** I see deposit status, amount, and payment method.
3. **Given** multiple rental orders for the same customer, **When** I view customer account, **Then** I see total deposits held for all active rentals.

---

### User Story 4 - Process Item Return (Priority: P1)

As a Rental Staff, I want to mark items as returned, check condition, calculate final charges (rental fee + late fees - deposit), and process the settlement so that the rental cycle is completed and items become available again.

**Why this priority**: Critical for completing the rental lifecycle and releasing inventory.

**Integration Scenario**: Mark return → Check condition → Calculate charges → Apply deposit → Process payment/refund → Update item availability.

**Acceptance Scenarios**:

1. **Given** a rental order due Jan 17, **When** customer returns items on Jan 17 in good condition, **Then** the system charges full rental fee 180,000, refunds deposit 90,000, and marks items available.
2. **Given** a rental order due Jan 17, **When** customer returns on Jan 20 (3 days late), **Then** the system adds late fee (3 days × daily rate), deducts from deposit, and processes balance.
3. **Given** returned items, **When** I inspect and find damage, **Then** I can record damage charges, deduct from deposit, and send item for repair.
4. **Given** a completed return, **When** I generate the return receipt, **Then** it shows rental period, charges breakdown (base fee + late fee + damage), deposit applied, and balance due/refund.

---

### User Story 5 - Handle Late Returns (Priority: P2)

As a Rental Business Owner, I want the system to automatically calculate late fees based on my policy (e.g., daily rate × days overdue) and notify staff of overdue rentals so that I can enforce return policies and manage inventory availability.

**Why this priority**: Important for revenue protection and inventory management, but system can function without automation initially.

**Acceptance Scenarios**:

1. **Given** a rental due Jan 17, **When** current date becomes Jan 18 and items not returned, **Then** the system marks rental as "Overdue" and calculates accruing late fees.
2. **Given** an overdue rental, **When** staff views the dashboard, **Then** they see a list of overdue rentals with days overdue and estimated penalties.
3. **Given** a late return, **When** processing settlement, **Then** late fees are automatically added to the final charges.

---

### User Story 6 - Track Item Condition (Priority: P2)

As a Rental Staff, I want to record item condition before and after each rental (e.g., "Good", "Minor Scratches", "Needs Repair") with optional photos/notes so that I can document wear and determine damage charges.

**Why this priority**: Important for dispute resolution and insurance, but rental can operate with basic condition tracking.

**Acceptance Scenarios**:

1. **Given** a rental order, **When** I release items to customer, **Then** I record condition as "Good" with optional photo.
2. **Given** a return, **When** I inspect items, **Then** I can update condition to "Damaged" and record repair cost estimate.
3. **Given** an item with condition history, **When** I view the item, **Then** I see condition changes over time and associated rental orders.

---

### User Story 7 - Manage Individual Units (Priority: P1)

As a Rental Staff, I want to track each physical mattress as a separate unit with its own code, condition, and history so that I can assign specific units to customers, track wear patterns, and retire heavily-used units.

**Why this priority**: Mattresses are NOT homogeneous - each has different wear, odor, and damage history. Critical for fair deposit settlements and quality control.

**Integration Scenario**: Create rental item "Single Bed" → Add units SB-001, SB-002 → Assign SB-001 to customer → Track condition → Return → Auto-trigger cleaning → Make available again.

**Acceptance Scenarios**:

1. **Given** I created rental item "Single Bed", **When** I add 10 units with codes SB-001 to SB-010, **Then** availability = 10 and each unit has status "Available".
2. **Given** a rental order, **When** I release items, **Then** system assigns specific units (SB-001, SB-002) and records their release condition with photos.
3. **Given** unit SB-001 returned dirty, **When** I mark for cleaning, **Then** status changes to "Cleaning" and unit unavailable until cleaned.
4. **Given** unit SB-005 has major damage, **When** I retire it, **Then** status = "Retired" and total capacity reduced by 1.

---

### How Rental Fits Into Existing Business Shapes

**Decision**: Rental functionality is **available to all businessShape types** (TRADING, SERVICE, HYBRID) as an optional module.

**Rationale**:

- **TRADING companies** may rent out physical goods (furniture, equipment, vehicles) alongside selling products
- **SERVICE companies** may rent tools/equipment needed for service delivery (e.g., construction equipment rental)
- **HYBRID companies** naturally need both capabilities

**Implementation**:

- Rental module is **NOT gated** by businessShape (unlike Inventory which requires TRADING/HYBRID)
- Companies enable rental by creating their first rental item
- Sidebar menu "Rental" appears when at least one rental item exists in the system

### Sidebar Navigation Structure

**Rental Menu** (appears in main sidebar when rental items exist):

```
📦 Rental
  ├── 📋 Rental Orders (list of all rental transactions)
  ├── 🎯 Rental Items (catalog of rentable inventory)
  ├── ↩️  Returns (process item returns and settlements)
  ├── ⚠️  Overdue (dashboard of late returns)
  └── 📊 Rental Reports (utilization, revenue analytics)
```

**Menu Item Details**:

| Menu Item      | Route             | Icon | Description                                        |
| -------------- | ----------------- | ---- | -------------------------------------------------- |
| Rental Orders  | `/rental/orders`  | 📋   | List/create rental orders, view status             |
| Rental Items   | `/rental/items`   | 🎯   | Manage rental catalog with pricing tiers           |
| Returns        | `/rental/returns` | ↩️   | Record returns, inspect condition, settle payments |
| Overdue        | `/rental/overdue` | ⚠️   | Dashboard of overdue rentals with late fees        |
| Rental Reports | `/rental/reports` | 📊   | Utilization and revenue analytics                  |

**Permissions**:

- New permission module: `RENTAL`
- Actions: `VIEW`, `CREATE`, `UPDATE`, `DELETE`, `PROCESS_RETURN`
- Default roles: Finance Manager gets all permissions, Staff gets VIEW/CREATE/PROCESS_RETURN only

---

### Functional Requirements

#### Rental Item Management

- **FR-001**: System MUST allow creating rental items with attributes: name, description, category, daily rate, weekly rate, monthly rate, deposit policy.
  - Deposit policy options: **PERCENTAGE** (e.g., 50%), **PER_UNIT** (e.g., 100,000 per mattress), **HYBRID** (max of both)
  - Rationale: Per-unit deposit protects against single high-damage item
- **FR-002**: System MUST track availability at **unit level** (RentalItemUnit), not aggregated item level.
  - Each unit has unique `unitCode` (e.g., SB-001, SB-002)
  - Availability = units with status Available (excluding Rented, Cleaning, Maintenance, Retired)
  - Rationale: Mattresses are NOT homogeneous - condition/wear varies per unit
- **FR-003**: System MUST support status transitions for units with complete lifecycle:
  - **Available**: Ready to rent
  - **Reserved**: Locked for confirmed order awaiting pickup (prevents double-booking)
  - **Rented**: Released to customer (order Active)
  - **Returned**: Awaiting inspection
  - **Cleaning**: Post-return sanitization (auto-triggered, mandatory for mattresses)
  - **Maintenance**: Repair/deep servicing (with reason, expected return date)
  - **Retired**: Permanently removed from circulation
  - Rationale: Reserved status prevents race conditions between order confirmation and pickup
- **FR-004**: System MUST allow defining custom pricing tiers (e.g., 1-3 days = daily rate, 4-7 days = weekly rate, 8-30 days = monthly rate).
- **FR-004A**: System MUST track usage and aging metrics per unit:
  - `totalRentalDays`: Cumulative days rented
  - `totalRentalCount`: Number of times rented
  - `lastDeepCleaningAt`: Last major cleaning/sanitization
  - Rationale: Inform retirement decisions, calculate ROI, answer customer questions about unit age

#### Rental Orders

- **FR-005**: System MUST allow creating rental orders with: customer, rental start date, rental end date, list of items with quantities.
- **FR-006**: System MUST automatically calculate rental fees based on rental period and apply the most economical pricing tier (e.g., weekly rate cheaper than 7 × daily).
- **FR-007**: System MUST prevent rental orders if requested quantity exceeds available inventory for any date range in the rental period.
- **FR-008**: System MUST support rental order statuses: Draft, Confirmed, Active (items released), Completed (items returned), Cancelled.
  - Status transitions MUST trigger unit status changes:
    - Confirmed → units Reserved
    - Active → units Rented
    - Cancelled → units back to Available (from Reserved)
- **FR-008A**: System MUST support a grace period for order pickup (e.g., 24 hours after `rentalStartDate`) before auto-cancelling the order and releasing reserved units.
- **FR-008B**: System MUST provide an audit log for all rental order status changes, including who made the change and when.
- **FR-009**: System MUST generate a rental agreement document showing items, dates, pricing, deposit, terms and conditions.

#### Deposits & Payments

- **FR-012**: System MUST support partial deposit collection (e.g., 50% upfront, 50% on delivery).
- **FR-012A**: System MUST allocate deposit coverage per unit for deterministic settlement:
  - Create **RentalDepositAllocation** mapping: `unitId`, `maxCoveredAmount`, `usedAmount`
  - Settlement logic MUST be deterministic (no manual "feeling")
  - Rationale: Clarify which unit's damage uses which portion of deposit when multiple units in one order

#### Item Pickup & Release

- **FR-013**: System MUST assign specific units to rental order upon confirmation (status: Reserved).
  - Assignment creates **RentalOrderUnitAssignment** with `unitId`, `lockedAt`, `lockedBy`
  - Once locked, unit CANNOT be changed without explicit override (requires reason + audit log)
  - Rationale: Prevents unit swaps, ensures photo/condition consistency, protects deposit disputes
- **FR-014**: System MUST allow marking rental order as "Active" (items released to customer) with release date/time and **mandatory** unit condition notes with photos.
  - Photos MUST show `unitCode` label/QR visible as anti-fraud measure
  - Rationale: Prevents "this is not my mattress" disputes
- **FR-015**: System MUST update item availability count when items are released (Reserved → Rented).

#### Returns & Settlement

- **FR-016A**: System MUST allow marking items as returned with actual return date/time.
- **FR-016B**: System MUST support damage severity classification:
  - **MINOR**: Cosmetic, does not affect functionality
  - **MAJOR**: Functional impact but still usable
  - **UNUSABLE**: Unit not safe/suitable for re-rental
  - UNUSABLE damage MUST auto-trigger Retired status
  - Rationale: Distinguish "kempes tapi belum hancur" from total loss
- **FR-017A**: System MUST calculate final charges with multiple charge types:
  - Base rental fee
  - Late fees (if overdue, after grace period)
  - Damage charges (for broken/lost items)
  - **Cleaning fees** (for odor/stains requiring extra cleaning, separate from damage)
  - Subtract: deposit already collected (considering per-unit coverage if applicable)
- **FR-017B**: System MUST provide a return processing screen where staff can:
  - View item condition at release (recorded when items left warehouse)
  - Input current condition on return (Good, Minor Wear, Damaged, Lost)
  - Add photos and notes documenting any damage
  - Compare before/after condition side-by-side
  - Calculate damage charges based on condition assessment

- **FR-018**: System MUST release items back to available inventory upon return (unless marked for maintenance).
- **FR-019**: System MUST generate return receipt showing charges breakdown and balance due or refund amount.
- **FR-019A**: System MUST enforce settlement finality:
  - RentalReturn status: Draft, Settled
  - Once Settled, changes PROHIBITED (only reversal via adjustment entry)
  - Rationale: Prevent post-payment edits, maintain audit integrity

#### Late Fees

- **FR-020**: System MUST calculate late fees with **grace period** support:
  - Policy parameters: `graceHours` (e.g., 6 hours), `dailyRate`
  - If late < graceHours: no charge
  - If late >= graceHours: charge full day(s)
  - Rationale: Mattresses often returned few hours late (night returns) - grace period prevents disputes
- **FR-021**: System MUST flag rentals as "Overdue" when current date > return date and items not returned.
- **FR-022**: System MUST display overdue rentals list with days overdue and accrued late fees.

#### Damage & Loss

- **FR-023**: System MUST allow recording **two types of charges** at return:
  - **DAMAGE_CHARGE**: Broken frame, torn fabric, lost items (deducted from deposit)
  - **CLEANING_FEE**: Odor, stains, wetness requiring extra cleaning (flat fee or case-by-case)
  - Rationale: Cleaning fee is fairer than labeling minor issues as "damage"
- **FR-024**: System MUST support marking items as "Lost" and charging replacement cost.

#### Customer Risk Management

- **FR-025**: System MUST allow flagging customers with rental risk level:
  - **Normal**: Standard deposit and terms
  - **Watchlist**: History of minor issues (late returns, cleanliness problems)
  - **Blacklisted**: Severe violations (major damage, non-payment, repeated abuse)
- **FR-026**: System MUST display risk warning when creating order for Watchlist/Blacklisted customers.
- **FR-027**: System MUST allow staff to override and require 100% deposit for high-risk customers.
- **FR-028**: System MUST record notes on customer risk profile (date, reason, staff who flagged).

#### Reporting & Analytics

- **FR-029**: System MUST provide rental utilization report showing % of time each item was rented in a period.
- **FR-030**: System MUST provide revenue report by rental item category and time period.
- **FR-031**: System MUST display calendar view of item availability for easy scheduling.

#### Policy Versioning

- **FR-032**: System MUST support versioned rental policies to prevent retroactive changes:
  - **RentalPolicy** entity: `effectiveFrom`, `graceHours`, `defaultCleaningFee`, `lateFeeFormula`, `depositPolicy`
  - Each rental order MUST snapshot the policy in effect at order creation
  - Policy changes MUST NOT affect existing orders
  - Rationale: Legal/audit requirement - customers locked in at policy effective when they ordered

### Non-Functional Requirements

- **NFR-001**: Rental fee calculations MUST be precise using `Decimal.js` for all financial math.
- **NFR-002**: System MUST check availability in real-time (not rely on cached counts that could go stale).
- **NFR-003**: Rental order creation and return processing MUST complete in under 2 seconds for typical orders (5 items or fewer).

### Key Entities

- **RentalItem**: Rentable inventory item type (e.g., "Single Bed") with pricing tiers (daily, weekly, monthly) and deposit policy.
- **RentalItemUnit**: **Individual physical unit** of a rental item with unique tracking.
  - `unitCode`: Unique identifier (e.g., SB-001, SB-002)
  - `condition`: Current condition (New, Good, Fair, Needs Repair)
  - `status`: Operational status (Available, Reserved, Rented, Returned, Cleaning, Maintenance, Retired)
  - `totalRentalDays`, `totalRentalCount`, `lastDeepCleaningAt`: Aging/usage metrics
  - **Rationale**: Mattresses are NOT homogeneous - each unit has different wear/odor/damage history
- **RentalOrder**: Customer rental agreement with date range, items, pricing, policy snapshot.
- **RentalOrderUnitAssignment**: Lock specific units to orders.
  - `unitId`, `lockedAt`, `lockedBy`: Prevent unit swaps after assignment
  - Requires reason + audit log for override
- **RentalDeposit**: Security deposit linked to rental order with flexible policy (percentage or per-unit).
- **RentalDepositAllocation**: Deposit coverage mapping per unit.
  - `unitId`, `maxCoveredAmount`, `usedAmount`: Deterministic settlement logic
- **RentalReturn**: Return record with actual return date, condition assessment, final charges.
  - Status: Draft, Settled (immutable once settled)
- **ItemConditionLog**: History of condition changes for each **rental unit** (not item type).
  - `beforePhotos[]`: **MANDATORY** photos when releasing unit to customer (must show unitCode)
  - `afterPhotos[]`: **MANDATORY** photos when customer returns (if damaged, must show unitCode)
  - `damageSeverity`: MINOR, MAJOR, UNUSABLE
  - `cleaningStatus`: Track cleaning workflow (Returned → Cleaning → Available)
- **CleaningLog**: Record of cleaning/sanitization after each return.
  - `cleanedBy`: Staff who performed cleaning
  - `cleanedAt`: Timestamp
  - `notes`: Cleaning actions taken (washed, sun-dried, disinfected)
- **CustomerRentalRisk**: Track problematic customers.
  - `riskLevel`: Normal, Watchlist, Blacklisted
  - `notes`: History of late returns, damage, disputes
- **RentalPolicy**: Versioned policy configuration.
  - `effectiveFrom`, `graceHours`, `defaultCleaningFee`, `lateFeeFormula`, `depositPolicy`
  - Snapshotted per order to prevent retroactive changes

## Success Criteria

### Measurable Outcomes

- **SC-001**: Staff can create a rental order (3 items, 7-day period) in under 2 minutes.
- **SC-002**: System accurately prevents double-booking (attempted rental of unavailable items) 100% of the time.
- **SC-003**: Late fees are calculated correctly for 100% of overdue returns (daily rate × days late).
- **SC-004**: Rental revenue and deposits balance to General Ledger with zero discrepancy.
- **SC-005**: Item availability counts match physical inventory counts after all returns are processed.
- **SC-006**: Users can view item availability for any future date range in under 1 second.

## Assumptions

1. **Single Location**: MVP supports single warehouse/location. Multi-location rental tracking is out of scope.
2. **Same Currency**: All rental rates are in the company's base currency (IDR for Indonesia).
3. **Manual Delivery**: Delivery/pickup logistics are tracked externally. System records release/return timestamps only.
4. **Fixed Pricing**: Pricing tiers are fixed per rental period. Dynamic pricing (seasonal, demand-based) is out of scope.
5. **Simple Condition Tracking**: Condition is recorded as text + optional notes. Image upload is optional (can use external storage).
6. **Calendar Days**: Rental periods are calculated in calendar days, not business days.

## Edge Cases

1. **Partial Returns**: Customer returns only some items from an order → System should allow partial return recording and keep order "Active" until all items returned.
2. **Early Returns**: Customer returns before end date → System should not refund the difference (rental period is binding) unless explicitly configured.
3. **Rental Extensions**: Customer requests extension while items are rented → Staff can create a new rental order for extended period or modify end date if items available.
4. **Item Swaps**: Customer returns damaged item and requests replacement → Process return with damage charge, create new mini-rental for replacement.
5. **Lost Items**: Item never returned → Mark as "Lost", charge replacement cost, remove from available inventory permanently (or mark for re-purchase).

## Out of Scope (Future Enhancements)

- **Reservation System**: Booking items for future dates without immediate pickup.
- **Delivery/Pickup Scheduling**: Coordinating delivery addresses and times.
- **Maintenance Schedules**: Automated preventive maintenance triggers based on usage.
- **Dynamic Pricing**: Seasonal rates, surge pricing during peak demand.
- **Rental Packages**: Bundled pricing for item sets (e.g., "Party Package" = tables + chairs).
- **Multi-Location**: Renting items from different warehouses/branches.
- **Recurring Rentals**: Auto-renewing rental contracts for long-term customers.

## Constitution & Architecture Compliance

### Backend Architecture (Apps/API) - Principles I, II, III, XXI

- [ ] **4-Layer Architecture**: Logic strictly follows Router → Service → Policy → Repository.
- [ ] **Schema-First**: All new fields defined in `packages/shared` Zod schemas first.
- [ ] **Multi-Tenant**: All DB queries scoped by `companyId`.
- [ ] **Service Purity**: Service layer DOES NOT import `prisma` (uses Repository only).
- [ ] **Policy & Rules**: Business constraints in Policy, pure logic in `rules/`.
- [ ] **Repository Purity**: No business logic in Repository (Data access only).
- [ ] **Anti-Bloat**: No redundant business logic methods added; existing ones updated (XXI).

### Frontend Architecture (Apps/Web) - Principles IV, XI

- [ ] **Feature Isolation**: Logic in `src/features/rental` (not global).
- [ ] **No Business Logic**: Components do not calculate state (render `backendState` only).
- [ ] **API Patterns**: Using `apiAction()` helper (never direct toast/try-catch).
- [ ] **User Safety**: Using `useConfirm()` hook (never `window.confirm`).
- [ ] **State Projection**: UI reflects exact backend state without optimistic guessing.

### Testing & Quality - Principles XV, XVII

- [ ] **Integration Tests**: Full rental flow (create order → release → return → settle) in single `it()` block.
- [ ] **Mock Compliance**: Mocks satisfy all Policy/Service contract expectations.
- [ ] **Financial Precision**: All rental fee calculations use `Decimal` aware checks.
- [ ] **Zero-Lag**: No interaction freezes the main thread.
