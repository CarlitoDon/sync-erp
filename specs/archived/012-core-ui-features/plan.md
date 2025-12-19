# Implementation Plan: Core UI Features

**Branch**: `012-core-ui-features` | **Date**: 2025-12-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-core-ui-features/spec.md`

## Summary

Implement missing UI for Inventory Operations (Receiving, Adjustments), Payment History (Invoice/Bill details), and Team Management (Invite, Assign). Backend endpoints already exist; this is a pure frontend implementation task.

## Technical Context

**Language/Version**: TypeScript 5.4
**Primary Dependencies**: React 18.2, Vite 5.1, TailwindCSS 3.4, TanStack Query v5
**Storage**: N/A (Frontend only)
**Testing**: Vitest, React Testing Library
**Target Platform**: Web (Desktop/Mobile responsive)
**Project Type**: Web Application
**Performance Goals**: Instant UI mutations (optimistic where possible), <100ms interaction latency
**Constraints**: Must match existing UI patterns (Shadcn/UI), use existing `api` client.
**Scale/Scope**: ~3 new modals, 2 new tables, 1 new page (Team).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Boundaries**: Logic in `apps/web/src/features` only.
- [x] **II. Dependencies**: Uni-directional (Web -> API).
- [x] **III. Contracts**: Will define/use shared types for payloads.
- [x] **VI. Feature-First**: Logic distributed to `inventory`, `finance`, `company` features.

## Project Structure

### Documentation (this feature)

```text
specs/012-core-ui-features/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── features/
│   │   ├── inventory/
│   │   │   ├── components/
│   │   │   │   ├── GoodsReceiptModal.tsx
│   │   │   │   └── StockAdjustmentModal.tsx
│   │   │   ├── services/
│   │   │   │   └── inventoryService.ts
│   │   │   └── types/
│   │   ├── finance/
│   │   │   ├── components/
│   │   │   │   └── PaymentHistoryList.tsx
│   │   │   └── services/
│   │   │       └── paymentService.ts
│   │   └── company/
│   │       ├── components/
│   │       │   ├── UserList.tsx
│   │       │   ├── InviteUserModal.tsx
│   │       │   └── AssignCompanyModal.tsx
│   │       ├── pages/
│   │       │   └── TeamManagement.tsx
│   │       └── services/
│   │           └── userService.ts
```

**Structure Decision**:

- **Inventory**: New components for specific actions, placed in `features/inventory/components`. Service `inventoryService.ts` to be created.
- **Finance**: `PaymentHistoryList` component in `features/finance/components` to be used by both Invoice and Bill pages. `paymentService.ts` needs `getPaymentsByInvoice`.
- **Company**: New "Team" sub-feature logic. A new page `TeamManagement` will be the entry point. Service `userService.ts` (or `teamService.ts`) for user actions.

## Compexity Tracking

N/A - Fully compliant.
