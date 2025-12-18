---
trigger: always_on
---

<!--
MEMORY SYNC REPORT
Version: 1.1.0 -> 1.2.0 (Minor - Business Flow Enforcement)
Added Sections:
- API-Based Seeding Pattern
- Business Flow Prerequisites
- Service Layer Purity
- Chart of Accounts Completeness
Modified Sections:
- None
Removed Sections:
- None
Last Updated: 2025-12-18
-->

# Project Memory

**Version**: 1.2.0 | **Last Updated**: 2025-12-18

## Overview

| Property     | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| Project      | Sync ERP                                                      |
| Type         | Multi-Tenant Enterprise Resource Planning                     |
| Stack        | Vite + React (Frontend), Express + TS (Backend), Prisma (ORM) |
| Constitution | v1.9.0 (see `.agent/rules/constitution.md`)                   |

---

## Key Decisions Log

> Decisions that affect future development. Add new entries at top.

### [2025-12-18] API-Based Seeding for Finance Data

**Decision**: Do NOT seed transactions (PO, SO, Invoice, Bill, Payment) directly to DB. Use `./scripts/seed-via-api.sh` instead.
**Rationale**: Direct DB inserts bypass business logic (Sagas, Journal entries, Balance updates, Inventory movements). API seeding ensures all side effects execute correctly.
**Reference**: Feature 032 Implementation

### [2025-12-18] Business Flow Prerequisites (FR-001, FR-002)

**Decision**: Documents MUST validate prerequisites before creation:
- **Bill**: PO status must be CONFIRMED+ AND GRN must exist
- **Invoice**: SO status must be CONFIRMED+
- **Invoice Post**: Sufficient stock required

**Implementation**: Use Policy layer for validation (e.g., `BillPolicy.ensureOrderReadyForBill`, `BillPolicy.ensureGoodsReceived`, `InvoicePolicy.ensureOrderReadyForInvoice`).
**Reference**: `specs/032-business-flow-enforcement/spec.md`

### [2025-12-18] Service Layer Purity - No Prisma Access

**Decision**: Service layer MUST NOT import or use `prisma` directly. All DB access goes through Repository layer.
**Rationale**: Maintains clean separation: Controller → Service → Policy → Repository. Easier testing and consistent data access patterns.
**Reference**: BillService refactor

### [2025-12-18] Chart of Accounts Completeness

**Decision**: Before implementing features that create journal entries, verify ALL required accounts exist in seed.
**Rationale**: GRN failed with "Account code 2105 not found". Account 2105 (Accrued Liability) was missing from seed but required for GRN journal entries.
**Reference**: `packages/database/prisma/seed.ts`

### [2025-12-18] Stock Validation in InventoryPolicy

**Decision**: Stock validation is business logic, belongs in `InventoryPolicy.ensureSufficientStock()`, NOT in Repository.
**Rationale**: Repository = data access only. Policy = business rules. Service calls Policy for validation, then Repository for data.
**Reference**: `apps/api/src/modules/inventory/inventory.policy.ts`

### [2025-12-16] Saga Integration Test Standard

**Decision**: Integration tests for Saga-driven flows MUST mock the Saga orchestrator, NOT the underlying repositories.
**Rationale**: Simulating repository calls duplicates the Saga's internal logic and creates brittle tests. We test Sagas in isolation (unit/infras) and trust them in flows.
**Reference**: Phase 2 Saga Implementation

### [2025-12-16] Vitest 4.x Mock Hoisting

**Decision**: Use `function() { return mockInstance }` pattern for `vi.mock()` factory functions.
**Rationale**: Vitest 4.x is strict about hoisting. Accessing outer-scope variables directly in factory fails.
**Reference**: Test Infrastructure Failure Analysis

### [2025-12-16] Phase 0 Gate Review - Approved with Risks

**Decision**: Phase 0 is CLOSED. Corrective Actions (Policy Hard Stop, Config-Driven) are verified.
**Latent Risks (Watchlist for Phase 1)**:

1. **BusinessShape Flatness**: Adding new shapes is expensive. Use shape as "profile", not "persona".
2. **SystemConfig Scope**: Currently global/implicit. Avoid using as "dumping ground for booleans".
3. **Transaction Boundary**: Implicit ownership is currently safe but needs explicit definition for complex flows (Purchase -> Stock -> Journal).
4. **Middleware Power**: Auth middleware loads Context, Shape, and Config. Risk of becoming a "God Object". Keep it strictly for Identity + Context.
5. **Frontend Bypass**: UI must not replicate policy logic optimistically. Backend is authoritative.
   **Reference**: `docs/apple-like-development/PHASE_0_REVIEW.md`

### [2025-12-16] Case A1 Prevention - Complete Integration Check

**Decision**: When creating new files (especially Policy, Rules, Services), ALWAYS verify they are actually imported and used somewhere. Never create "orphan" files.
**Rationale**: Case A1 discovered where `sales.policy.ts` and `procurement.policy.ts` were created with tests but never imported in any service. Files exist but provide no value until integrated.
**Reference**: Implementation Completeness

### [2025-12-15] UI Consistency via Shared Components

**Decision**: Same UI actions MUST use shared components. Extract common UI (e.g., RecordPaymentModal) to `components/shared/`.
**Rationale**: Case A1 exposed duplicate payment forms across 4 files evolving independently. Shared components ensure "change once, update everywhere" and Steve Jobs-level consistency.
**Reference**: See `docs/LEARNINGS.md` for full Design System Manifesto.

### [2025-12-15] Backend-First Data Linking (Avoid N+1)

**Decision**: Use backend DB joins (`include`) for related data (e.g., Invoices on Order) instead of client-side loops.
**Rationale**: Eliminates "N+1" fetch performance issues and prevents 404 errors on missing optional relations.
**Reference**: Performance Best Practice

### [2025-12-15] Module Parity

**Decision**: Implement related modules (Sales/Procurement, Finance AP/AR) as implementation pairs (Symmetry).
**Rationale**: Reduces cognitive load and ensures consistent UX/DX. If feature exists in Module A, it should exist in Mirror Module B.
**Reference**: UI/UX Consistency

### [2025-12-15] DRY Principle

**Decision**: Apply DRY (Don't Repeat Yourself) - extract common logic into shared utilities/hooks.
**Rationale**: Reduces code duplication, improves maintainability, centralizes bug fixes.
**Reference**: N/A (general best practice)

### [2025-12-15] Schema-First Development

**Decision**: All new API fields MUST be added to Zod schema first.
**Rationale**: Zod strips unknown fields silently. taxRate bug was caused by this.
**Reference**: Constitution Principle IX

### [2025-12-08] Callback-Safe Services

**Decision**: Frontend services use standalone functions, not `this`.
**Rationale**: `useCompanyData` hook extracts method reference, losing `this` context.
**Reference**: Constitution Principle VII

---

## Known Issues & Workarounds

> Persistent issues that need workarounds. Mark RESOLVED when fixed.

| Issue                                                | Status   | Workaround                                                                                                           |
| ---------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| Old orders have subtotal-only `totalAmount`          | KNOWN    | Only new orders include tax                                                                                          |
| IDE lint may be stale                                | KNOWN    | Use `npx tsc --noEmit` as source of truth                                                                            |
| **Dev server always running during development**     | NOTE     | User runs `Dev: Start All` and `TypeScript: Watch` in separate terminals. Do NOT try to start dev server yourself.  |
| **Case A1: Orphan files created but not integrated** | KNOWN    | After creating any new file, grep for imports to verify it's actually used. Check `grep -r "import.*filename" apps/` |
| **Account 2105 was missing from seed**               | RESOLVED | Added to `packages/database/prisma/seed.ts` - always verify accounts exist before creating journal entries          |

---

## Frequently Used Patterns

### API Action (Success Toast + Error Handling)

```typescript
const result = await apiAction(
  () => myService.create(data),
  'Item created!'
);
if (result) {
  /* success */
}
```

### Data Fetching with Company Context

```typescript
const { data, loading, refresh } = useCompanyData(
  () => myService.list(),
  initialValue
);
```

### Confirmation Dialog

```typescript
const confirm = useConfirm();
const proceed = await confirm.show({
  title: 'Delete Item?',
  message: 'This action cannot be undone.',
  danger: true,
});
if (proceed) {
  /* delete */
}
```

### Case A1 Prevention Check

```bash
# After creating any new file, verify it's imported somewhere
grep -r "import.*filename" apps/
# If no results, the file is orphaned and needs integration
```

### Vitest 4.x Saga Mocking

```typescript
vi.mock('../services/InvoicePostingSaga', () => ({
  InvoicePostingSaga: function () {
    return mockInvoicePostingSaga;
  },
}));
```

### Business Flow Prerequisite Pattern

```typescript
// In Service layer, validate prerequisites via Policy before creating document
async createFromPurchaseOrder(companyId: string, data: CreateBillInput) {
  const order = await this.repository.findOrder(data.orderId, companyId, OrderType.PURCHASE);
  if (!order) throw new DomainError('PO not found', 404);
  
  // Policy validations
  BillPolicy.ensureOrderReadyForBill(order);  // Check PO status
  const grnCount = await this.inventoryRepository.countByOrderReference(companyId, data.orderId, 'IN');
  BillPolicy.ensureGoodsReceived(grnCount);   // Check GRN exists
  
  // Proceed with creation...
}
```

---

## Update Guidelines

1. **Version Bump**: MAJOR.MINOR.PATCH following semver
   - MAJOR: Structure changes, section removals
   - MINOR: New sections, significant entries
   - PATCH: Entry updates, typo fixes

2. **Adding Decisions**: Add at TOP of Key Decisions Log with date

3. **Sync Report**: Update HTML comment at top when modifying

4. **Constitution Sync**: Memory complements constitution, does not duplicate it
