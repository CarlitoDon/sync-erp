# Implementation Plan: Frontend Code Quality & Performance Improvements (Phase 2)

**Branch**: `040-frontend-improvements-p2` | **Date**: December 29, 2025 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/040-frontend-improvements-p2/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Frontend-only refactoring to reduce code duplication (Partner pages ~95%, Order forms ~40%), create consistent UI components (NoCompanySelected, unified PageHeader, shared Input), and add React memoization for performance. No backend or Prisma schema changes required.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18.x  
**Primary Dependencies**: React, React Router, tRPC React Query, Tailwind CSS 4, Vite  
**Storage**: N/A (frontend-only)  
**Testing**: Manual verification, optional component tests  
**Target Platform**: Web browsers (Chrome, Firefox, Safari, Edge)
**Project Type**: web (Vite + React)  
**Performance Goals**: Reduce re-renders via React.memo, smooth 60fps scrolling  
**Constraints**: No new npm dependencies, maintain existing UX patterns  
**Scale/Scope**: 6 user stories, ~20 files modified, 4 new components/hooks

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [N/A] **I. Dependency**: Frontend ↔ Backend via HTTP only? Apps → Packages? _(Frontend-only, no API changes)_
- [N/A] **I. Multi-Tenant**: ALL data isolated by `companyId`? _(No data access changes)_
- [N/A] **II. Type System**: Shared types in `packages/shared`? Types use `z.infer`? _(Using existing types)_
- [N/A] **III. Backend Layers**: Service checks `Policy` before Action? _(No backend changes)_
- [N/A] **III-A. Dumb Layers**: Controller only calls service? Repository has no business logic? _(No backend changes)_
- [x] **IV. Frontend**: Logic in `src/features`? UI is State Projection? _(Shared components in components/, feature-specific in features/)_
- [x] **V. Callback-Safe**: Services export standalone functions? _(Hooks use useCallback for handlers)_
- [x] **VI. Build Verification**: `npx tsc --noEmit` and `npm run build` will pass? _(Required before merge)_
- [x] **VII. Parity**: If Feature A exists in Sales, does it exist in Procurement? _(PartnerListPage serves both)_
- [N/A] **VIII. Performance**: No N+1 Client loops? Lists use Backend `include` for relations? _(No data fetching changes)_
- [N/A] **IX. Apple-Standard**: Derived from `BusinessShape`? No technical questions to user? _(No business logic changes)_
- [N/A] **X. Data Flow**: Frontend → API → Controller → Service → Rules/Policy → Repository → DB? _(No flow changes)_
- [x] **XI. Human Interface**: Clear Navigation? Simplified Workflows? _(NoCompanySelected provides clear guidance)_
- [x] **XIII. Engineering**: Zero-Lag UI? Optimistic Updates? _(Memoization improves performance)_
- [N/A] **XV. Test Contracts**: Mocks satisfy all Policy/Service layer expectations? _(No backend tests)_
- [N/A] **XVI. Financial Precision**: `Decimal` for money? `Number()` in test assertions? _(Using existing calculation logic)_
- [N/A] **XVII. Integration State**: Sequential flows in single `it()` block? _(No integration tests)_
- [N/A] **XVIII. Schema for Raw SQL**: `$executeRaw` column names match Prisma schema? _(No SQL)_
- [N/A] **XIX. Seed Completeness**: All expected accounts/configs in seed files? _(No seed changes)_
- [x] **XXI. Anti-Bloat**: Reuse existing methods? No redundant method creation? _(Consolidating duplicate code)_

## Project Structure

### Documentation (this feature)

```text
specs/040-frontend-improvements-p2/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (TypeScript interfaces only)
├── quickstart.md        # Phase 1 output
├── contracts/           # N/A (no API changes)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
apps/web/src/
├── components/
│   ├── ui/
│   │   ├── no-company-selected.tsx  # NEW: US3
│   │   ├── input.tsx                # ENHANCE: US4
│   │   └── index.ts                 # EXPORT
│   ├── layout/
│   │   └── PageHeader.tsx           # CONSOLIDATE: US5
│   └── forms/
│       └── OrderItemEditor.tsx      # NEW: US2
├── features/
│   ├── common/
│   │   └── components/
│   │       └── PartnerListPage.tsx  # NEW: US1
│   ├── procurement/pages/
│   │   ├── Suppliers.tsx            # SIMPLIFY: US1
│   │   └── PurchaseOrders.tsx       # USE HOOK: US2
│   └── sales/pages/
│       ├── Customers.tsx            # SIMPLIFY: US1
│       └── SalesOrders.tsx          # USE HOOK: US2
└── hooks/
    └── useOrderForm.ts              # NEW: US2
```

**Structure Decision**: All shared components go in `components/`, domain-specific shared logic in `features/common/`, and hooks in `hooks/`. This follows existing patterns from spec 039.

## Complexity Tracking

| User Story | Complexity | Risk | Effort |
|------------|------------|------|--------|
| US1: PartnerListPage | Medium | Low | 4h |
| US2: useOrderForm | Medium | Low | 4h |
| US3: NoCompanySelected | Low | Very Low | 1h |
| US4: Input Consistency | Low | Very Low | 2h |
| US5: PageHeader Consolidation | Low | Low | 2h |
| US6: Memoization | Medium | Low | 3h |
| **Total** | - | - | **16h** |

## Governance Update (Constitution v3.3.0)

> No violations - all changes are frontend-only refactoring that follow existing patterns.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| None | - | - |
