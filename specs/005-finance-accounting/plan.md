# Implementation Plan: Complete Finance Module

**Branch**: `005-finance-accounting` | **Date**: 2025-12-10 | **Spec**: [spec.md](file:///c:/Offline/Coding/sync-erp/specs/005-finance-accounting/spec.md)
**Input**: Feature specification from `/specs/005-finance-accounting/spec.md`

## Summary

Implement complete finance module including manual journal entries, Accounts Payable/Receivable management, and basic financial reporting (P&L, Balance Sheet). Key automation feature: auto-generation of journal entries upon invoice/bill posting and payment recording to ensure double-entry book balancing without manual effort.

## Technical Context

**Language/Version**: TypeScript 5.x (Node 20+)
**Primary Dependencies**: React 18 (Frontend), Express 4 (Backend), Prisma 5 (ORM)
**Storage**: PostgreSQL 16
**Testing**: Vitest (Unit), Playwright (E2E if needed)
**Target Platform**: Web Browser (Desktop focus for finance users)
**Project Type**: Web Application (Monorepo)
**Performance Goals**: Reports generation < 3s, Journal posting < 500ms
**Constraints**: Multi-tenant isolation (companyId), Double-entry integrity (debit=credit)
**Scale/Scope**: 5 new pages, 3 new services, ~10 new endpoints

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Boundaries**: Frontend strictly avoids direct DB/Logic imports.
- [x] **II. Dependencies**: Dependencies are uni-directional (Apps -> Packages).
- [x] **III. Contracts**: Shared types defined in `packages/shared/src/types`.
- [x] **IV. Layered Backend**: Logic strictly in Services (FinanceService, JournalService).
- [x] **V. Multi-Tenant**: All queries scoped by `companyId`.

## Project Structure

### Documentation (this feature)

```text
specs/005-finance-accounting/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code

```text
apps/web/src/
├── pages/
│   ├── Finance.tsx             # Existing (Overview/Reports)
│   ├── JournalEntries.tsx      # NEW: Manual Entry List/Form
│   ├── AccountsPayable.tsx     # NEW: AP Management
│   └── AccountsReceivable.tsx  # NEW: AR Management
├── services/
│   ├── financeService.ts       # Existing + Reports
│   └── journalService.ts       # NEW: Journal Entry API client
└── components/
    └── FinancialReport.tsx     # NEW: Reusable report viewer

apps/api/src/
├── routes/
│   ├── finance.ts              # Existing + Reports routes
│   └── journals.ts             # NEW: Journal Management routes
└── services/
    ├── financeService.ts       # Existing + Reports logic
    └── journalService.ts       # NEW: Journal logic + Auto-posting
```

**Structure Decision**: Standard layered architecture adhering to project conventions. New pages for distinct functional areas (AP, AR, Journals). New service `journalService` to encapsulate complex double-entry logic and auto-posting rules to keep `financeService` focused on reporting/read-only aggregations.
