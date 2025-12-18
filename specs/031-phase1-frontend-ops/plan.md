# Implementation Plan: Phase 1 Frontend Operational UI & Observability

**Branch**: `031-phase1-frontend-ops` | **Date**: 2025-12-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/031-phase1-frontend-ops/spec.md`

## Summary

This plan delivers the **minimum viable frontend** for Phase 1 daily operations:

- Dashboard with read-only KPIs
- Invoice List + Detail + Payment Modal (with businessDate)
- PO List + Receive Goods Screen (with businessDate)
- UI Guardrails (disabled buttons, confirmation modals, loading states)
- Admin Observability (saga failures, journal orphans)

**Philosophy**: No magic, no auto-anything. Backend owns reality. Make irreversible actions uncomfortable.

---

## Technical Context

**Language/Version**: TypeScript 5.x (React 18 + Vite 7)  
**Primary Dependencies**: React Router 7, Axios, TanStack Query (optional), Sonner (toasts), @sync-erp/shared  
**Storage**: N/A (frontend is stateless projection)  
**Testing**: Vitest + React Testing Library  
**Target Platform**: Modern browsers (Chrome, Firefox, Safari, Edge)  
**Project Type**: Monorepo web app (`apps/web`)  
**Performance Goals**: Page load < 2s, interactions < 200ms perceived  
**Constraints**: No auto-refresh, no drag-drop, no batch operations  
**Scale/Scope**: 6 screens, 3 modals, 1 admin view

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Architecture**: Frontend ↔ Backend via HTTP only? Dependencies uni-directional?
  - All data fetched via Axios to `/api/*` endpoints
- [x] **II. Contracts**: Shared types in `packages/shared`? Validators exported?
  - Using existing Zod schemas for Invoice, Payment, PO, GRN
- [x] **III. Backend Layers**: Service checks `Policy` before Action?
  - Backend APIs already saga-protected with Policy checks
- [x] **IV. Multi-Tenant**: ALL data isolated by `companyId`?
  - `X-Company-Id` header set via Axios interceptor
- [x] **V. Frontend**: UI is State Projection? No complex conditionals?
  - FR-017 explicitly prohibits frontend status calculation
- [x] **VIII. Verification**: `npx tsc --noEmit` and `npm run build` will pass?
  - Standard verification before merge
- [x] **IX. Schema-First**: New API fields added to Zod schema FIRST?
  - businessDate already in PaymentInput, GRNInput schemas
- [x] **X. Parity**: If Feature A exists in Sales, does it exist in Procurement?
  - Invoice List ↔ PO List, Payment Modal ↔ Receive Goods (symmetric)
- [x] **XI. Performance**: No N+1 Client loops? Lists use Backend `include`?
  - Lists fetch from backend with eager loading
- [x] **XII. Apple-Standard**: Logic derives from `BusinessShape`?
  - Pending Shape banner shown when applicable
- [x] **XIII. Data Flow**: Frontend pure reflection? No local business state?
  - All status/balance from backend, FR-017 enforced
- [x] **XIV-XVII. Human Experience**: Clear Navigation? Simplified Workflows?
  - Dashboard entry point, linear flows, pixel-perfect checklist in spec

**Result**: All Constitution checks PASS ✓

---

## Project Structure

### Documentation (this feature)

```text
specs/031-phase1-frontend-ops/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-contracts.md
├── checklists/          # Validation checklists
│   ├── requirements.md
│   └── apple-compliance.md
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
apps/web/src/
├── features/
│   ├── dashboard/           # [MODIFY] Add KPI cards
│   │   ├── components/
│   │   │   ├── DashboardKPIs.tsx         # [NEW]
│   │   │   └── StatCard.tsx              # [EXISTS]
│   │   ├── pages/Dashboard.tsx           # [MODIFY]
│   │   └── services/dashboard.service.ts # [MODIFY]
│   │
│   ├── finance/
│   │   ├── components/
│   │   │   ├── InvoiceList.tsx           # [EXISTS]
│   │   │   ├── InvoiceDetail.tsx         # [MODIFY] Add PaymentModal trigger
│   │   │   └── PaymentModal.tsx          # [NEW] with businessDate
│   │   ├── pages/
│   │   │   ├── Invoices.tsx              # [EXISTS]
│   │   │   └── InvoiceDetailPage.tsx     # [MODIFY]
│   │   └── services/invoice.service.ts   # [EXISTS]
│   │
│   ├── procurement/
│   │   ├── components/
│   │   │   ├── POList.tsx                # [EXISTS]
│   │   │   └── ReceiveGoodsModal.tsx     # [NEW] with businessDate
│   │   ├── pages/
│   │   │   ├── PurchaseOrders.tsx        # [EXISTS]
│   │   │   └── PODetailPage.tsx          # [MODIFY]
│   │   └── services/po.service.ts        # [EXISTS]
│   │
│   └── admin/                            # [NEW] Admin feature
│       ├── components/
│       │   ├── SagaFailureList.tsx       # [NEW]
│       │   └── JournalOrphanList.tsx     # [NEW]
│       ├── pages/
│       │   └── Observability.tsx         # [NEW]
│       └── services/admin.service.ts     # [NEW]
│
├── components/
│   ├── ui/
│   │   ├── Button.tsx                    # [MODIFY] Add loading prop
│   │   ├── ConfirmModal.tsx              # [EXISTS]
│   │   └── DatePicker.tsx                # [EXISTS or NEW]
│   └── shared/
│       └── PendingShapeBanner.tsx        # [EXISTS]
│
└── hooks/
    ├── useConfirm.ts                     # [EXISTS]
    └── useLoadingButton.ts               # [NEW] Prevent double-click

apps/api/src/
├── routes/
│   └── admin.routes.ts                   # [NEW] Admin endpoints
│
└── modules/
    └── admin/                            # [NEW] Admin module
        ├── controller.ts
        ├── service.ts
        └── repository.ts
```

**Structure Decision**: Follows existing feature-based structure. New `admin` feature for observability. Reuses existing shared components.

---

## Complexity Tracking

> No Constitution violations. No complexity justification needed.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| N/A       | -          | -                                    |

---

## Implementation Phases

### Phase 0: Research (Complete)

No external research needed - this feature uses existing patterns:

- Invoice/PO lists already exist
- Payment recording pattern established
- Confirmation modal pattern via `useConfirm()` hook
- Loading state pattern via `apiAction()` helper

### Phase 1: Design & Contracts

See:

- `data-model.md` - Entity relationships
- `contracts/api-contracts.md` - API endpoints
- `quickstart.md` - Development setup

### Phase 2: Tasks

Generated via `/speckit-tasks` command after plan approval.
