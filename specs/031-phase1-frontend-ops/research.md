# Research: Phase 1 Frontend Operational UI

**Feature**: 031-phase1-frontend-ops  
**Date**: 2025-12-17

## Summary

This feature builds on existing frontend patterns. No external research needed - all technologies and patterns are already established in the codebase.

---

## Existing Patterns (Reuse)

### 1. List/Detail Pattern

**Decision**: Reuse existing Invoice List and PO List patterns  
**Rationale**: Consistent UX across modules  
**Location**: `features/finance/components/InvoiceList.tsx`, `features/procurement/components/POList.tsx`

### 2. Modal Pattern

**Decision**: Use `useConfirm()` hook for confirmation modals  
**Rationale**: Constitution V mandates using hook, not `window.confirm()`  
**Location**: `hooks/useConfirm.ts`

### 3. Form Submission Pattern

**Decision**: Use `apiAction()` helper for all mutations  
**Rationale**: Provides toast feedback, error handling, loading state  
**Location**: `hooks/apiAction.ts` or `services/apiAction.ts`

### 4. Date Field Pattern

**Decision**: Use existing DatePicker component or create simple input type="date"  
**Rationale**: businessDate is required for Guardrails G5 compliance  
**Alternative Considered**: Complex date library (e.g., date-fns) - rejected for simplicity

### 5. Loading Button Pattern

**Decision**: Add `isLoading` prop to Button component to prevent double-click  
**Rationale**: FR-019 requires disabled state during in-flight requests  
**Alternative Considered**: Separate LoadingButton component - rejected for simplicity

---

## New Patterns (To Implement)

### 1. Admin Feature

**Decision**: Create new `features/admin/` module  
**Rationale**: Separation of concerns - admin observability is distinct from business operations  
**Structure**:

```text
features/admin/
├── components/SagaFailureList.tsx
├── components/JournalOrphanList.tsx
├── pages/Observability.tsx
└── services/admin.service.ts
```

### 2. KPI Dashboard Cards

**Decision**: Extend existing Dashboard with KPI cards component  
**Rationale**: Dashboard already exists, just needs KPI data visualization  
**Data Source**: New `/api/dashboard/kpis` endpoint aggregating Invoice, Bill, Stock data

---

## Technology Decisions

| Decision          | Choice                          | Rationale                   |
| ----------------- | ------------------------------- | --------------------------- |
| Date picker       | Native `<input type="date">`    | Simple, no dependencies     |
| KPI visualization | Plain stat cards                | No charts per Phase 1 scope |
| Table component   | Existing Table or list          | Avoid new dependencies      |
| State management  | React useState + useCompanyData | Existing pattern            |
| Error handling    | Axios interceptor               | Constitution mandated       |

---

## Dependencies Confirmed

All dependencies already in `package.json`:

- React 18 ✓
- React Router 7 ✓
- Axios ✓
- Sonner (toasts) ✓
- @sync-erp/shared ✓

No new dependencies required.

---

## Unknowns Resolved

| Unknown                   | Resolution                           |
| ------------------------- | ------------------------------------ |
| businessDate UI component | Use native date input                |
| Admin route protection    | Add ADMIN role check in route guard  |
| KPI data aggregation      | Backend provides pre-aggregated data |
| Double-click prevention   | Button `isLoading` prop              |
