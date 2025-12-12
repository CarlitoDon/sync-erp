# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Refactor the `apps/web` frontend from a Type-Based Architecture to a Feature-Based Architecture. Group business logic into `src/features/[domain]` (auth, finance, sales, etc.) and restrict `src/components` to generic UI atoms. Migrate routing to a centralized model and ensure all import paths and tests are updated.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: React 18, Vite 7, Tailwind 4, Vitest 4
**Storage**: LocalStorage (for auth tokens), Server State (TanStack Query / axios)
**Testing**: Vitest (Unit/Integration) - NEEDS RESEARCH: Confirm test file locations and current coverage.
**Target Platform**: Web (Vite SPA)
**Project Type**: Web Application (Monorepo `apps/web`)
**Performance Goals**: No regression in load time. Improved code navigability.
**Constraints**: Zero regression in existing functionality.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Boundaries**: Frontend strictly consumes API, no DB access.
- [x] **II. Dependencies**: Internal imports only via `@sync-erp/shared`.
- [x] **III. Contracts**: Using shared types.
- [x] **IV. Layered Backend**: N/A (Frontend Refactor).
- [x] **IV. Repository Pattern**: N/A (Frontend Refactor).
- [x] **V. Multi-Tenant**: N/A (Structure update only).
- [x] **VI. Feature-First**: **PRIMARY GOAL**. This plan implements this principle.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
apps/web/src/
├── app/            # App.tsx, routes.tsx (new central), providers
├── components/
│   ├── ui/         # ActionButton, ConfirmModal
│   └── layout/     # Sidebar*, Layout, MobileMenuButton, CompanySwitcher
├── features/
│   ├── auth/       # Login, Register, authService, ProtectedRoute
│   ├── finance/    # Finance, FinancialReport, JournalEntries, AccountsPayable, Invoices, Services...
│   ├── sales/      # SalesOrders, Customers, salesOrderService
│   ├── procurement/# PurchaseOrders, Suppliers, purchaseOrderService
│   ├── inventory/  # Inventory, Products, productService
│   ├── company/    # Companies, CreateCompany, Selection, companyService
│   ├── partners/   # partnerService
│   ├── shared/     # Cross-cutting logic
│   └── dashboard/  # Dashboard
├── hooks/          # Global hooks
├── services/       # global api.ts
└── utils/          # Global utils
```

**Structure Decision**: Adopting Feature-Based Architecture to co-locate Logic, Views, and Services by Domain. Routing is Centralized in `src/app/routes.tsx`. Shared logic uses `src/features/shared`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |
