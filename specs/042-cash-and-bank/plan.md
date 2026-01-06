# Implementation Plan: Cash and Bank

**Branch**: `042-cash-and-bank` | **Date**: 2026-01-06 | **Spec**: [specs/042-cash-and-bank/spec.md](spec.md)
**Input**: Feature specification from `specs/042-cash-and-bank/spec.md`

## Summary

Implement a new **Cash & Bank** module to manage operational money movements. This includes defining Cash/Bank accounts (linked to Chart of Accounts), and recording Spend Money, Receive Money, and Transfer transactions. Each transaction will automatically generate a corresponding Journal Entry to update the General Ledger. The feature will be isolated in a new `cash-bank` module while leveraging the existing `accounting` module for journal posting.

## Technical Context

**Language/Version**: TypeScript / Node.js 18+
**Primary Dependencies**: Express, Prisma, Decimal.js, Zod
**Storage**: PostgreSQL
**Testing**: Integration Tests (Business Flow)
**Target Platform**: Linux server / Docker
**Project Type**: Monorepo (Web + API)
**Performance Goals**: <200ms API response
**Scale/Scope**: ~3 new entities, ~5 API endpoints

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Dependency**: Frontend ↔ Backend via HTTP only? Apps → Packages?
- [x] **I. Multi-Tenant**: ALL data isolated by `companyId`?
- [x] **II. Type System**: Shared types in `packages/shared`? Types use `z.infer`?
- [x] **III. Backend Layers**: Service checks `Policy` before Action? (Service → Policy → Repository)
- [x] **III-A. Dumb Layers**: Controller only calls service? Repository has no business logic?
- [x] **IV. Frontend**: Logic in `src/features`? UI is State Projection?
- [x] **V. Callback-Safe**: Services export standalone functions?
- [x] **VI. Build Verification**: `npx tsc --noEmit` and `npm run build` will pass?
- [x] **VII. Parity**: N/A (New module)
- [x] **VIII. Performance**: No N+1 Client loops? Lists use Backend `include` for relations?
- [x] **IX. Apple-Standard**: Derived from `BusinessShape`? No technical questions to user?
- [x] **X. Data Flow**: Frontend → API → Controller → Service → Rules/Policy → Repository → DB?
- [x] **XI. Human Interface**: Clear Navigation? Simplified Workflows?
- [x] **XIII. Engineering**: Zero-Lag UI? Optimistic Updates?
- [x] **XV. Test Contracts**: Mocks satisfy all Policy/Service layer expectations?
- [x] **XVI. Financial Precision**: `Decimal` for money? `Number()` in test assertions?
- [x] **XVII. Integration State**: Sequential flows in single `it()` block?
- [x] **XVIII. Schema for Raw SQL**: `$executeRaw` column names match Prisma schema? (if used)
- [x] **XIX. Seed Completeness**: All expected accounts/configs in seed files?
- [x] **XXI. Anti-Bloat**: Reuse existing methods? No redundant method creation?

## Project Structure

### Documentation (this feature)

```text
specs/042-cash-and-bank/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
apps/
├── web/
│   ├── src/
│   │   ├── features/
│   │   │   └── cash-bank/  # New Feature Domain
│   │   │       ├── components/
│   │   │       ├── hooks/
│   │   │       ├── services/
│   │   │       └── types/
│
└── api/
    ├── src/
    │   ├── modules/
    │       └── cash-bank/  # New Module
    │           ├── cash-bank.controller.ts
    │           ├── cash-bank.service.ts
    │           ├── cash-bank.policy.ts
    │           └── cash-bank.repository.ts
    │
    │       └── accounting/ # Existing (for Account/Journal reused)

packages/
├── database/
│   ├── prisma/schema.prisma # Schema Updates (CashTransaction, etc)
│
└── shared/
    ├── src/
    │   ├── validators/     # Zod schemas
    │   │   └── cash-bank.schema.ts
```

## Complexity Tracking

| Complexity | Area   | Description                                                                               |
| :--------- | :----- | :---------------------------------------------------------------------------------------- |
| Moderate   | Schema | Need to define `CashTransaction` that handles 3 types (Spend, Receive, Transfer) cleanly. |
| Low        | Logic  | Journal posting logic needs to be precise but is standard Accounting.                     |
