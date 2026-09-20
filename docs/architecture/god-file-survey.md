<!-- Rescued from .agents/explorer_survey_god_files/survey_god_files.md — run tw-20260920-maintfix -->
# Comprehensive Survey Report: Target God Files & Verification Baseline

**Project**: Sync ERP Architectural Hardening (Phase B: R5 God Files & R6 Test Verification)  
**Date**: 2026-09-19  
**Explorer Agent**: God Files & Test Verification Survey Explorer  
**Status**: Completed (Read-Only Analysis)

---

## 1. Executive Summary

This report establishes the architectural baseline and decomposition blueprints for the monolithic "God Files" (>900 LOC / >600 LOC) and maps the complete test verification tooling across the Sync ERP monorepo.

### Target Files Summary & Measurements

| Target File | Stated LOC | Actual LOC | Primary Responsibility | Proposed Decomposition Plan | Resulting Max File LOC |
|---|---|---|---|---|---|
| `apps/api/src/modules/rental/rental-external-order.service.ts` | ~1650 | **1,663** | Public storefront order management, partner resolution, item/bundle auto-creation, webhook notifications | Split into 5 cohesive modules + Facade coordinator | **~450 LOC** (Item Resolver) |
| `packages/shared/src/validators/rental.ts` | ~935 | **1,001** | All rental Zod schemas, types, DTOs, response contracts | Split into 8 domain lifecycle sub-files under `validators/rental/` + barrel facade | **~230 LOC** (Admin & Reports) |
| `apps/api/src/modules/accounting/services/journal.service.ts` | ~928 | **613** | Facade coordinator delegating to domain journal services (Sales, Procurement, Rental, Inventory, Core) | Streamline delegation signatures, extract types to `journal.types.ts` | **~280 LOC** (Facade) |
| *Discovered God File*: `apps/api/src/modules/accounting/services/journal-rental.service.ts` | N/A | **720** | Double-entry rental journal posting (DP, settlement, extension, late fees) + account resolution | Extract account resolution logic to `journal-account-resolver.service.ts` | **~500 LOC** (Rental Journal) |

### Verification Baseline Summary

| Check / Suite | Command | Config File | Status | Duration | Metrics |
|---|---|---|---|---|---|
| **Monorepo Typecheck** | `npm run typecheck` (`tsc -b`) | Root `tsconfig.json` (5 project refs) | **PASS** | ~35s | 0 errors across all workspaces |
| **Monorepo Linter** | `npm run lint` (`turbo run lint`) | `turbo.json`, `.eslintrc.*` | **PASS** | ~3.1s | 10 tasks successful, 0 errors, 2 console warnings (`email.service.ts`) |
| **API Unit Tests** | `npm run test:unit` (`apps/api`) | `apps/api/vitest.config.ts` | **PASS** | 4.74s | **42 test files passed, 373 tests passed** |
| **Web Unit Tests** | `npm test` (`apps/web`) | `apps/web/vite.config.ts` | **PASS** | 8.47s | **28 test files passed, 202 tests passed** |
| **Shared Unit Tests** | `npx vitest run` (`packages/shared`) | `packages/shared/tsconfig.test.json` | **PASS** | 0.24s | **5 test files passed, 21 tests passed** |
| **API Integration Tests** | `npm run test:integration` (`apps/api`) | `apps/api/vitest.config.ts` | **PASS** | 16.77s | **53 test files passed, 1 skipped, 243 tests passed, 2 skipped** |

---

## 2. Monolithic Files Analysis & Decomposition Seams (R5)

### 2.1 `apps/api/src/modules/rental/rental-external-order.service.ts` (1,663 LOC)

#### Current State & Responsibilities
`RentalExternalOrderService` handles external orders originating from public web storefronts (e.g. Santi Living website, POS, and partner integrations). It combines:
1. Public token and order retrieval with tenant isolation (`getByToken`, `getById`, `getByOrderNumber`).
2. Order creation and orchestration (`createOrder`).
3. Order modifications, item replacement, and price recalculations (`updateOrder`).
4. Order cancellation and cleanup (`cancelOrder`, `deleteOrder`).
5. Payment claims and payment confirmation/rejection (`claimPayment`, `confirmPaymentByOrderNumber`, `rejectPaymentByOrderNumber`).
6. Partner lookup, phone normalization, and partner cloning for historical order isolation (`findOrCreateCustomer`, `resolvePartnerForOrderUpdate`, `updatePartnerFromInput`, `buildPartnerUpdateData`, `normalizePhone`).
7. Auto-creation and dynamic resolution of rental items and bundles (`buildOrderItems`, `resolveBundle`, `createBundleWithComponents`, `resolveRentalItem`, `findOrCreateRentalItem`, `findOrCreateComponentRentalItem`, label parsers, SKU generators).
8. Webhook/event notifications (`notifyRentalEvent`, `notifyPaymentEvent`).
9. Pricing and date calculations (`getDurationDays`, `resolveInvoiceDailyRate`, `resolveInvoiceLineTotal`, `resolveInvoiceUnitPrice`, `toMoney`).

#### Direct Consumers & Router Bindings
- `apps/api/src/routes/integration-v1.router.ts:16, 39`: REST public endpoints (`/orders`, `/orders/:id`, `/orders/token/:token`, `/orders/:id/cancel`).
- `apps/api/src/trpc/routers/public-rental/public-rental-order.router.ts:17, 23`: tRPC public rental order procedures (`create`, `update`, `getByToken`, `cancel`).
- `apps/api/src/trpc/routers/public-rental/public-rental-payment.router.ts:18, 20`: tRPC public rental payment procedures (`claimPayment`, `confirmPayment`, `rejectPayment`).
- `apps/api/src/trpc/routers/integration-v1.router.ts:9, 25`: tRPC v1 integration endpoints.
- `apps/api/src/modules/rental/rental.service.ts:28, 55, 69`: exposed on main facade via `this.externalOrderService`.
- `apps/api/test/unit/rental/rental-public-token-ttl.test.ts:2, 88`: Unit tests for token expiration and revocation.

#### Decomposition Seams & Target Architecture
To guarantee that **no single file exceeds 600 LOC**, `RentalExternalOrderService` must be split into cohesive domain sub-services while preserving its public class interface and method signatures on the primary facade:

```
apps/api/src/modules/rental/
├── rental-external-order.service.ts          # Primary Facade Coordinator (~380 LOC)
├── sub-services/
│   ├── rental-external-partner.service.ts    # Partner resolution & cloning (~190 LOC)
│   ├── rental-external-item-resolver.ts      # Item & bundle auto-creation (~450 LOC)
│   ├── rental-external-notification.service.ts# Tenant webhook dispatch (~75 LOC)
│   ├── rental-external-order.utils.ts        # Pure calculation & policy helpers (~110 LOC)
│   └── rental-external-order.types.ts        # Interfaces & DTO types (~85 LOC)
```

#### Sub-Module Inventory & Allocations

1. **`rental-external-order.types.ts` (~85 LOC)**:
   - `OrderItemComponent`
   - `CreatePublicOrderInput`
   - `UpdatePublicOrderInput`
   - `ExternalOrderItemInput`
   - `ResolvedOrderItem`
   - `RateBearingRecord`

2. **`rental-external-order.utils.ts` (~110 LOC)**:
   - `publicTokenExpiry()`: 30-day token TTL.
   - `getDurationDays(startDate, endDate)`: validates end > start and computes integer days.
   - `buildCreatedBy(input)`: provenance formatting.
   - `buildPolicySnapshot(input)`: JSON snapshot builder.
   - `toMoney(value)`: Decimal.js rounding to 2 decimal places.
   - `buildOrderUpdateData(input, subtotal, totalAmount, partnerId)`: Prisma update dictionary builder.

3. **`rental-external-notification.service.ts` (~75 LOC)**:
   - `RentalExternalNotificationService`:
     - `notifyRentalEvent(companyId, event, payload)`: delegates to `webhookService.notifyTenant` with error containment.
     - `notifyPaymentEvent(companyId, event, payload)`: delegates to `webhookService.notifyTenant` with error containment.

4. **`rental-external-partner.service.ts` (~190 LOC)**:
   - `RentalExternalPartnerService`:
     - `findOrCreateCustomer(companyId, input)`: phone normalization, idempotency, updates.
     - `resolvePartnerForOrderUpdate(order, input)`: partner isolation check; clones partner record if linked orders > 1 to prevent mutating past order records.
     - `updatePartnerFromInput(partnerId, input)`.
     - `buildPartnerUpdateData(input)`.
     - `normalizePhone(value)`: Indonesian phone prefix normalization (0 -> 62).

5. **`rental-external-item-resolver.ts` (~450 LOC)**:
   - `RentalExternalItemResolverService`:
     - `buildOrderItems(params)`: maps item inputs to resolved rental items and bundles.
     - `resolveBundle(companyId, item, allowAutoCreate)`.
     - `createBundleWithComponents(companyId, item)`.
     - `resolveRentalItem(companyId, item, allowAutoCreate)`.
     - `findOrCreateRentalItem(companyId, item)`.
     - `findOrCreateComponentRentalItem(tx, companyId, label)`.
     - `resolveInvoiceDailyRate`, `resolveInvoiceLineTotal`, `resolveInvoiceUnitPrice`.
     - `parseComponentLabel`, `getComponentLabel`, `normalizeComponentItem`, `toExternalSku`, `capitalizeLabel`.

6. **`rental-external-order.service.ts` (~380 LOC - Facade Coordinator)**:
   - Instantiates sub-services in constructor:
     ```ts
     export class RentalExternalOrderService {
       private readonly partnerService = new RentalExternalPartnerService();
       private readonly itemResolver = new RentalExternalItemResolverService();
       private readonly notificationService = new RentalExternalNotificationService();
       private readonly documentNumberService = new DocumentNumberService();
       ...
     }
     ```
   - Re-exports all public types (`CreatePublicOrderInput`, `UpdatePublicOrderInput`, etc.) from `rental-external-order.types.ts`.
   - Exposes exact same public methods:
     - `findOrCreateCustomer(...)` -> delegates to `this.partnerService.findOrCreateCustomer`
     - `getByToken(...)`
     - `getById(...)`
     - `getByOrderNumber(...)`
     - `createOrder(...)`
     - `updateOrder(...)`
     - `cancelOrder(...)`
     - `claimPayment(...)`
     - `confirmPaymentByOrderNumber(...)`
     - `rejectPaymentByOrderNumber(...)`
     - `deleteOrder(...)`
   - **Zero breaking changes** for tRPC routers, REST routers, and unit test suites.

---

### 2.2 `packages/shared/src/validators/rental.ts` (1,001 LOC)

#### Current State & Structure
`packages/shared/src/validators/rental.ts` has grown into a 1,001 LOC schema file containing 40+ exported schemas and types representing every phase of the rental lifecycle.

#### Complete Catalog of Exported Symbols by Domain Phase

| Domain Lifecycle Phase | Exported Schemas | Exported Types / Enums / Constants | Line Range in Current File |
|---|---|---|---|
| **Phase 0: Common / Base / Enums** | `ApiRentalOrderStatusSchema`, `ApiRentalPaymentStatusSchema`, `ApiUnitStatusSchema`, `ApiUnitConditionSchema`, `RentalPaymentMethodSchema`, `RentalItemWithRelationsSchema`, `RentalOrderWithRelationsSchema`, `RentalItemSchema` (re-export), `RentalOrderSchema` (re-export), `RentalPaymentStatusSchema` (re-export) | `RentalOrderStatus`, `RentalPaymentStatus`, `OrderSource`, `UnitStatus`, `UnitCondition`, `DepositPolicyType`, `ReturnStatus`, `RentalPaymentMethod`, `RentalItemWithRelations`, `RentalOrderWithRelations` | Lines 1–173 |
| **Phase 1: Item & Inventory** | `CreateRentalItemSchema`, `UpdateRentalItemSchema`, `UpdateUnitStatusSchema`, `ConvertStockToUnitSchema` | `CreateRentalItemInput`, `UpdateRentalItemInput`, `UpdateUnitStatusInput`, `ConvertStockToUnitInput` | Lines 174–256, 410–452, 720–732 |
| **Phase 2: Booking / Creation** | `CreateRentalOrderSchema` | `CreateRentalOrderInput` | Lines 257–313, 733–735 |
| **Phase 3: Confirmation & Down Payment** | `UnitAssignmentInputSchema`, `ConfirmRentalOrderSchema`, `ManualConfirmAccountingTreatmentSchema`, `ManualConfirmRentalOrderSchema`, `HistoricalRentalSettlementSchema` | `UnitAssignmentInput`, `ConfirmRentalOrderInput`, `ManualConfirmAccountingTreatment`, `ManualConfirmRentalOrderInput`, `HistoricalRentalSettlementInput` | Lines 314–409, 736–744 |
| **Phase 4: Release & Delivery** | `UnitReleaseInputSchema`, `UnitReleaseSchema`, `ReleasePaymentSchema`, `ReleaseRentalOrderSchema`, `CancelRentalRefundPaymentSchema`, `CancelRentalOrderSchema` | `UnitReleaseInput`, `UnitRelease`, `ReleasePaymentInput`, `ReleaseRentalOrderInput`, `CancelRentalRefundPaymentInput`, `CancelRentalOrderInput` | Lines 453–512, 745–750 |
| **Phase 5: Extension** | `ExtendRentalOrderItemSchema`, `ExtendRentalOrderPaymentSchema`, `ExtendRentalOrderSchema` | `ExtendRentalOrderItemInput`, `ExtendRentalOrderPaymentInput`, `ExtendRentalOrderInput` | Lines 513–602, 755–757 |
| **Phase 6: Return & Settlement** | `UnitReturnSchema`, `ReturnDamagePaymentSchema`, `ProcessReturnSchema`, `FinalizeReturnSchema`, `CreateInvoiceFromReturnSchema` | `UnitReturnInput`, `ReturnDamagePaymentInput`, `ProcessReturnInput`, `FinalizeReturnInput`, `CreateInvoiceFromReturnInput` | Lines 603–679, 751–754, 758–760 |
| **Phase 7: Admin Tasks & Reports** | `UpdateRentalPolicySchema`, `UpdateCustomerRiskSchema`, `RentalReportQuerySchema`, `RentalAdminTaskTypeSchema`, `RentalTaskUrgencySchema`, `RentalAdminSuggestedActionSchema`, `RentalAdminTaskCategorySchema`, `RentalAdminTaskItemSchema`, `RentalAdminTaskQueueSummarySchema`, `RentalAdminTaskQueueResponseSchema`, `GetRentalAdminTasksInputSchema` | `UpdateRentalPolicyInput`, `UpdateCustomerRiskInput`, `RentalReportQueryInput`, `RentalItemResponse`, `RentalItemUnitResponse`, `RentalOrderResponse`, `RentalOrderItemResponse`, `RentalReturnResponse`, `RentalUtilizationReport`, `RentalRevenueReport`, `OverdueRentalResponse`, `RentalAdminTaskType`, `RentalTaskUrgency`, `RentalAdminSuggestedAction`, `RentalAdminTaskCategory`, `RentalAdminTaskItem`, `RentalAdminTaskQueueSummary`, `RentalAdminTaskQueueResponse`, `GetRentalAdminTasksInput` | Lines 680–715, 761–770, 775–887, 888–1002 |

#### Decomposition Plan for `packages/shared/src/validators/rental/`
Split into sub-files under `packages/shared/src/validators/rental/`, with the root `packages/shared/src/validators/rental.ts` serving as a 100% backward-compatible re-export barrel:

```
packages/shared/src/validators/
├── rental.ts                                   # Barrel re-export facade (~30 LOC)
└── rental/
    ├── index.ts                                # Internal sub-folder barrel (~30 LOC)
    ├── common.ts                               # Enums, statuses, relation schemas (~175 LOC)
    ├── item.ts                                 # RentalItem, unit status, convert stock (~120 LOC)
    ├── booking.ts                              # CreateRentalOrderSchema, items (~70 LOC)
    ├── confirmation.ts                         # Confirm, manual confirm, historical DP (~95 LOC)
    ├── release.ts                              # Release, release payment, cancellation (~80 LOC)
    ├── extension.ts                            # Extension schema, item extensions (~100 LOC)
    ├── return.ts                               # Unit return, damage payment, return invoice (~80 LOC)
    └── admin-and-reports.ts                    # Policy, risk, reports, admin task queue (~230 LOC)
```

#### Backward Compatibility Assurance
- `packages/shared/src/index.ts` exports `* from './validators/index'`.
- `packages/shared/src/validators/index.ts` has `export * from './rental.js'`.
- `packages/shared/src/types/rental.ts:60` imports `RentalOrderStatus from '../validators/rental'`.
- By keeping `packages/shared/src/validators/rental.ts` as a barrel that does `export * from './rental/index.js'`, all import styles across `@sync-erp/shared`, `@sync-erp/shared/validators/rental`, and relative imports remain completely intact.
- Every single sub-file is between 30 and 230 LOC, safely below the 600 LOC threshold.

---

### 2.3 `apps/api/src/modules/accounting/services/journal.service.ts` (613 LOC) & `journal-rental.service.ts` (720 LOC)

#### Current State & Architecture
`apps/api/src/modules/accounting/services/journal.service.ts` was previously decomposed into domain-specific sub-services:
- `journal-core.service.ts` (247 LOC)
- `journal-inventory.service.ts` (49 LOC)
- `journal-procurement.service.ts` (494 LOC)
- `journal-rental.service.ts` (**720 LOC** - exceeds 600 LOC)
- `journal-sales.service.ts` (484 LOC)
- `journal.service.ts` (**613 LOC** - exceeds 600 LOC)

#### Analysis of `journal.service.ts` (613 LOC)
`JournalService` acts as an IoC Facade holding sub-service instances:
- `this.core = new JournalCoreService(repository, accountService);`
- `this.sales = new JournalSalesService(this.core);`
- `this.procurement = new JournalProcurementService(this.core);`
- `this.rental = new JournalRentalService(this.core);`
- `this.inventory = new JournalInventoryService(this.core);`

Why does `journal.service.ts` still have 613 LOC despite delegating?
It defines 28 forwarding methods, with large inline parameter types spread across multiple lines. For example:
- `reverse`, `create`, `getById`, `list`, `getAccountBalance`, `resolveAndCreate` (Core)
- `postInvoice`, `postInvoiceReversal`, `postCreditNote`, `postPaymentReceived`, `postPaymentReceivedReversal`, `postShipment`, `postShipmentReversal`, `postSalesReturn`, `postCustomerDeposit`, `postSettleCustomerDeposit` (Sales)
- `postDebitNote`, `postGoodsReceipt`, `postGoodsReceiptReversal`, `postBill`, `postBillReversal`, `postPaymentMadeReversal`, `postPaymentMade`, `postPurchaseReturn`, `postUpfrontPayment`, `postSettlePrepaid` (Procurement)
- `postAdjustment` (Inventory)
- `postRentalDownPayment`, `postRentalReleaseSettlement`, `postRentalExtension`, `postRentalDamageFee`, `postRentalLateFee`, `postRentalCancellationRefund`, `postRentalDeposit`, `postRentalReturn` (Rental)

#### Analysis of Discovered God File: `journal-rental.service.ts` (720 LOC)
During the survey, `journal-rental.service.ts` was measured at **720 LOC**, violating the 600 LOC architectural rule.
Its contents breakdown:
- Lines 21–98 (78 LOC): 6 Parameter Interfaces (`PostRentalDownPaymentParams`, `PostRentalReleaseSettlementParams`, `PostRentalExtensionParams`, `PostRentalDamageFeeParams`, `PostRentalLateFeeParams`, `PostRentalCancellationRefundParams`).
- Lines 106–548 (442 LOC): Balanced double-entry methods (DP 2200, release settlement 4200/2200, extensions, damage fee, late fee, cancellation refund).
- Lines 550–590 (40 LOC): Legacy pseudo-deposit `postRentalReturn` (marked for deprecation per R3).
- Lines 592–721 (**130 LOC**): Account code resolution logic (`resolveCashBankAccountCode`, `resolvePaymentContraAccountCode`, `isValidPaymentContraAccount`).

#### Decomposition Plan for Accounting Services (<600 LOC Target)

1. **Extract Account Resolution from `journal-rental.service.ts`**:
   - Create `apps/api/src/modules/accounting/services/journal-account-resolver.service.ts` (~130 LOC) containing:
     - `resolveCashBankAccountCode(companyId, paymentAccountId, paymentMethod, tx)`
     - `resolvePaymentContraAccountCode(companyId, method, tx)`
     - `isValidPaymentContraAccount(method, accountName)`
   - `JournalRentalService` delegates to `JournalAccountResolverService`.
   - Result: `journal-rental.service.ts` drops from **720 LOC to ~500 LOC** (well under 600 LOC).

2. **Streamline `journal.service.ts` Facade Coordinator**:
   - Extract parameter types and interfaces into `journal.types.ts` (~70 LOC).
   - Condense delegation signatures in `journal.service.ts`.
   - Mark legacy `postRentalReturn` as `@deprecated` per R3.
   - Result: `journal.service.ts` drops from **613 LOC to ~280 LOC** (well under 600 LOC).
   - Preserves 100% backward compatibility for the 45+ files importing `JournalService`.

---

## 3. Verification Baseline & Test Suite Mapping (R6)

### 3.1 Verification Tooling Configuration

#### `package.json` & Turborepo Pipelines
- Root `turbo.json`:
  - `build`: depends on `^build`, `^db:generate`, `db:generate`.
  - `lint`: depends on `^build`, `db:generate`, `@sync-erp/eslint-plugin#build`.
  - `test`: depends on `build`.
  - `test:integration`: depends on `build`, `cache: false`.
  - `test:all`: depends on `build`, `cache: false`.
- Workspaces:
  - `apps/api` (`@sync-erp/api`): Vitest runner (`vitest run --config vitest.config.ts`), coverage via `@vitest/coverage-v8`.
  - `apps/web` (`@sync-erp/web`): Vitest runner (`vitest run`), testing library + JSDOM.
  - `apps/mcp` (`@sync-erp/mcp`): Vitest runner (`vitest run --config vitest.config.ts test/release-health.test.ts`).
  - `apps/bot` (`@sync-erp/bot`): TypeScript check (`tsc --noEmit`), ESLint.
  - `packages/shared` (`@sync-erp/shared`): tsup build, ESLint, Vitest tests in `test/`.
  - `packages/database` (`@sync-erp/database`): Prisma 7.1.0 client + `zod-prisma-types` code generation.

#### Vitest Configuration (`apps/api/vitest.config.ts`)
- Environment: Node.js
- Timeout: 60,000ms
- Setup file: `./test/setup.ts` (handles mock DB, Prisma mocking, environment configuration)
- Test Inclusion:
  - `test/unit/**/*.test.ts`
  - `test/invariants/**/*.test.ts`
  - `test/integration/**/*.test.ts`
  - `test/e2e/**/*.test.ts`
- Coverage Thresholds: Lines 80%, Branches 79%, Functions 80%, Statements 80%.

---

### 3.2 Empirical Verification Baseline Results

All verification commands were executed and recorded on 2026-09-19:

```bash
# 1. Monorepo Typecheck
$ npm run typecheck
> sync-erp@0.0.1 typecheck
> tsc -b
Exit code: 0 (PASSED)

# 2. Monorepo Linter
$ npm run lint
> turbo run lint
Tasks: 10 successful, 10 total
Exit code: 0 (PASSED - 0 errors, 2 console warnings in email.service.ts)

# 3. API Unit Tests
$ npm run test:unit --workspace=@sync-erp/api
Test Files: 42 passed (42)
Tests:      373 passed (373)
Duration:   4.74s
Exit code:  0 (PASSED)

# 4. Web Unit Tests
$ npm test --workspace=@sync-erp/web
Test Files: 28 passed (28)
Tests:      202 passed (202)
Duration:   8.47s
Exit code:  0 (PASSED)

# 5. Shared Package Unit Tests
$ npx vitest run (in packages/shared)
Test Files: 5 passed (5)
Tests:      21 passed (21)
Duration:   0.24s
Exit code:  0 (PASSED)

# 6. API Integration Tests
$ npm run test:integration --workspace=@sync-erp/api
Test Files: 53 passed | 1 skipped (54)
Tests:      243 passed | 2 skipped (245)
Duration:   16.77s
Exit code:  0 (PASSED)
```

*Note on skipped tests*: `apps/api/test/integration/company-role-atomicity.test.ts` skips 2 tests when run outside a disposable local PostgreSQL container (`isDisposableLocalDatabase ? describe : describe.skip`). All other 53 integration files passed 100%.

---

### 3.3 Domain Test Suite Mapping Matrix

The monorepo features extensive automated testing across all business flows. The test inventory for affected domains is mapped below:

#### 1. Rental Domain (Unit, Integration & E2E)
- `apps/api/test/unit/rental/rental-admin-task-routes.test.ts` (Admin task routes, REST vs tRPC)
- `apps/api/test/unit/rental/rental-admin-task.service.test.ts` (Task queue generator, urgency rules)
- `apps/api/test/unit/rental/rental-flow-lifecycle.e2e.test.ts` (Full rental lifecycle unit simulation)
- `apps/api/test/unit/rental/rental-order-fulfillment.service.test.ts` (Release, assignment checks)
- `apps/api/test/unit/rental/rental-order-lifecycle.service.test.ts` (Status transitions, booking rules)
- `apps/api/test/unit/rental/rental-order-payment.service.test.ts` (Payment verify, Down Payment)
- `apps/api/test/unit/rental/rental-public-token-ttl.test.ts` (Public order token expiry, 30-day TTL)
- `apps/api/test/unit/rental/rental-return.service.test.ts` (Returns, damage, settlements)
- `apps/api/test/unit/rental/webhook-outbox.processor.test.ts` (Tenant webhook delivery)
- `apps/api/test/unit/rental-bundle-containment.test.ts` (Bundle item isolation)
- `apps/api/test/integration/rental/public-rental-contract.test.ts` (External storefront contract tests)
- `apps/api/test/integration/rental/public-rental-router.test.ts` (Public router procedures)
- `apps/api/test/integration/rental/rental-lifecycle-service.test.ts` (Database-level lifecycle tests)
- `apps/api/test/integration/rental/rental-order-fulfillment-service.test.ts` (Integration fulfillment & delivery)
- `apps/api/test/integration/rental/rental-order-payment-service.test.ts` (Integration payments)
- `apps/api/test/integration/rental/webhook-outbox.service.test.ts` (Outbox queuing)
- `apps/api/test/integration/rental-business-logic.test.ts` (Business logic matrices)
- `apps/api/test/e2e/core-rental-order-creation.test.ts` (tRPC end-to-end caller verification)
- `apps/api/test/e2e/external-rental-storefront-live-order-flow.test.ts` (Live storefront flow with proxy bot)
- `apps/web/test/features/rental/RentalAvailabilityTimeline.test.tsx` (Frontend timeline visualizer)
- `apps/web/test/features/rental/RentalReturnCard.test.tsx` (Frontend return processing card)
- `apps/web/test/features/rental/RentalTasksPage.test.tsx` (Frontend admin task queue dashboard)
- `apps/web/test/features/rental/schedulerTimeline.test.ts` (Timeline scheduling algorithm)

#### 2. Accounting & Journal Domain
- `apps/api/test/unit/accounting/journal-rental.service.test.ts` (574 LOC: Unit tests for rental double-entry DP 2200, release 4200, extension, damage, late fee, fallback account resolution)
- `apps/api/test/invariants/accounting.test.ts` (Accounting system balance invariants: Debits == Credits)
- `apps/api/test/invariants/finance.test.ts` (Finance ledger invariants)
- `apps/api/test/integration/accrual.test.ts` (GRNI accruals)
- `apps/api/test/integration/cash-bank.test.ts` (Cash & bank transaction posting)
- `apps/api/test/integration/dp-linking.test.ts` (Down payment linkage & balance deductions)
- `apps/api/test/integration/expenses-flow.test.ts` (Expense double-entry journals)
- `apps/api/test/integration/finance-automation.test.ts` (Automated journal resolution)
- `apps/api/test/integration/payment-linking.test.ts` (Invoice & bill payment allocations)
- `apps/api/test/e2e/finance-full-cycle.test.ts` (General ledger & trial balance E2E)
- `apps/api/test/e2e/finance-tax-cycle.test.ts` (VAT Input/Output tax cycles)
- `apps/api/test/e2e/cash-upfront-e2e.test.ts` (Upfront cash sales accounting)
- `apps/api/test/e2e/upfront-payment-p2p.test.ts` (Prepaid procurement accounting)

#### 3. External Orders & Storefront Integration
- `apps/api/test/unit/rental/rental-public-token-ttl.test.ts` (Token verification & lifecycle security)
- `apps/api/test/integration/rental/public-rental-contract.test.ts` (Contract verification against DTOs)
- `apps/api/test/integration/rental/public-rental-router.test.ts` (Input validation & response schemas)
- `apps/api/test/e2e/external-rental-storefront-live-order-flow.test.ts` (Order placement, token claim, webhook)
- `apps/api/test/unit/rental/rental-admin-task-routes.test.ts` (Integration v1 HTTP routes)
- *Key Finding*: `apps/api/src/integrations/santi-living/` lacks direct unit tests; integration safety currently relies on the external storefront E2E suite (`external-rental-storefront-live-order-flow.test.ts`).

#### 4. Shared Validators & Domain Types
- `packages/shared/test/validators/company.test.ts` (Company shape validator tests)
- `packages/shared/test/validators/inventory.test.ts` (Inventory validator tests)
- `packages/shared/test/constants/billing.test.ts` (Billing constants)
- `packages/shared/test/domain/BusinessDate.test.ts` (Business date value object)
- `packages/shared/test/domain/Money.test.ts` (Money value object arithmetic)
- `apps/api/test/integration/po-zod-check.test.ts` (Zod boundary validation check)

#### 5. Sales & Inventory Domain
- `apps/api/test/integration/3-way-matching.test.ts` (PO, GRN, Bill matching)
- `apps/api/test/integration/3way-matching-tax.test.ts` (Matching with tax)
- `apps/api/test/integration/close-po.test.ts` & `close-so.test.ts` (Order closing)
- `apps/api/test/integration/customer-deposit.test.ts` (Customer deposit register & deduction)
- `apps/api/test/integration/grn-double-create.test.ts` (Duplicate receipt fencing)
- `apps/api/test/integration/o2c-3way-matching.test.ts` (Order to cash matching)
- `apps/api/test/integration/o2c-dp-deduction.test.ts` (DP deduction from final invoice)
- `apps/api/test/integration/o2c-full-cycle.test.ts` (SO -> Shipment -> Invoice -> Payment)
- `apps/api/test/integration/o2c-tempo-dp-shipped.test.ts` & `o2c-tempo-dp.test.ts` (Credit terms with DP)
- `apps/api/test/integration/p2p-edge-cases.test.ts` & `p2p-full-cycle.test.ts` (Procure to pay lifecycle)
- `apps/api/test/integration/purchase-return.test.ts` (Vendor return & debit notes)
- `apps/api/test/unit/inventory.policy.test.ts`, `invoice.policy.test.ts`, `purchase-order.policy.test.ts`

---

## 4. Synthesis & Implementation Guidance for Phase B Implementers

### Non-Negotiable Boundaries
1. **File Size Limit**: No file in the three target modules (`rental-external-order.service.ts`, `validators/rental.ts`, `journal.service.ts`) or their sub-modules may exceed **600 lines of code**.
2. **Backward Compatibility**:
   - `new RentalExternalOrderService()` must remain callable with identical public methods.
   - All imports from `@sync-erp/shared` and `@sync-erp/shared/validators/rental` must resolve identical types and schemas.
   - `JournalService` facade must remain fully operational across all 45+ consumer files.
3. **Strict Typing (Oracle System Rules)**:
   - Zero `any` or `as any`.
   - Zod validation at all external boundaries.
   - Proper domain interfaces for all params and return types.
4. **Verification Safety Net**:
   - `npm run typecheck`, `npm run lint`, and `npm test` must run and pass cleanly after decomposition.

---
*Report compiled and verified by the God Files and Test Verification Survey Explorer.*
