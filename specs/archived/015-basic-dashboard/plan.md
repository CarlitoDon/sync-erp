# Implementation Plan: Basic Dashboard

**Branch**: `15-basic-dashboard` | **Date**: 2025-12-13 | **Spec**: [spec.md](./spec.md)

## Summary

Implement functional dashboard with real data from existing APIs. The current Dashboard.tsx displays hardcoded "0" values. This plan wires the dashboard to existing backend endpoints (invoices, bills, orders, products) to show actual business metrics.

**Approach**: Frontend-only changes using existing API endpoints. No backend modifications needed.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18  
**Primary Dependencies**: React, Axios, Tailwind CSS  
**Storage**: N/A (read from existing APIs)  
**Testing**: Vitest + React Testing Library (existing setup)  
**Target Platform**: Web (Vite + React)  
**Project Type**: Monorepo (apps/web)  
**Performance Goals**: Dashboard loads < 2 seconds  
**Constraints**: Must use existing API endpoints  
**Scale/Scope**: Single dashboard page with 5 metric cards

## Constitution Check

_GATE: ✅ All checks pass_

- [x] **I. Boundaries**: Frontend only calls API via HTTP (uses `api.ts` service)
- [x] **II. Dependencies**: Uses existing `packages/shared` types
- [x] **III. Contracts**: Types from shared, validators where applicable
- [x] **IV. Layered Backend**: N/A (no backend changes)
- [x] **IV. Repository Pattern**: N/A (no backend changes)
- [x] **V. Multi-Tenant**: All API calls automatically scoped by companyId via request context
- [x] **VI. Feature-First**: Dashboard logic in `src/features/dashboard/` (already exists)

## Proposed Changes

### Frontend (`apps/web`)

#### [MODIFY] [Dashboard.tsx](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/dashboard/pages/Dashboard.tsx)

**Current state**: Shows hardcoded "0" values for all metrics

**Proposed changes**:

1. Import `useCompanyData` hook for data fetching pattern
2. Fetch real counts from existing API endpoints:
   - `GET /api/invoices?status=POSTED` → count for receivables
   - `GET /api/bills?status=POSTED` → count for payables
   - `GET /api/sales-orders` → pending orders count
   - `GET /api/products` → products count
3. Calculate aggregate values:
   - Total Receivables = sum of POSTED invoice balances
   - Total Payables = sum of POSTED bill balances
4. Display loading skeleton while fetching
5. Handle empty state gracefully

---

#### [NEW] [dashboardService.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/dashboard/services/dashboardService.ts)

Create service to aggregate dashboard metrics:

```typescript
export const dashboardService = {
  async getMetrics(): Promise<DashboardMetrics> {
    // Parallel fetch from existing endpoints
    const [invoices, bills, orders, products] = await Promise.all([
      api.get('/invoices?status=POSTED'),
      api.get('/bills?status=POSTED'),
      api.get('/sales-orders'),
      api.get('/products'),
    ]);

    return {
      totalReceivables: sum(invoices.balance),
      totalPayables: sum(bills.balance),
      pendingOrders: orders.filter(pending).length,
      productsCount: products.length,
      unpaidInvoices: invoices.length,
      unpaidBills: bills.length,
    };
  },
};
```

---

#### [NEW] [types.ts](file:///Users/wecik/Documents/Offline/sync-erp/apps/web/src/features/dashboard/types.ts)

```typescript
export interface DashboardMetrics {
  totalReceivables: number;
  totalPayables: number;
  pendingOrders: number;
  productsCount: number;
  unpaidInvoices: number;
  unpaidBills: number;
}
```

## Project Structure

```text
apps/web/src/features/dashboard/
├── pages/
│   └── Dashboard.tsx    # [MODIFY] Wire real data
├── services/
│   └── dashboardService.ts  # [NEW] Aggregate metrics
└── types.ts             # [NEW] DashboardMetrics interface
```

## Verification Plan

### Automated Tests

**Command**: `cd apps/web && npm test -- --run`

Existing test file: `apps/web/test/features/dashboard/Dashboard.test.tsx`

New tests to add:

- Dashboard renders loading state initially
- Dashboard displays metrics after fetch
- Dashboard handles API error gracefully

### Manual Verification

1. Login dengan akun yang memiliki data (invoices, bills, orders)
2. Buka halaman dashboard (route: `/`)
3. Verifikasi:
   - [ ] Loading state muncul sebentar
   - [ ] Metric cards menampilkan angka dari database (bukan "0")
   - [ ] Total Receivables = sum of POSTED invoice balances
   - [ ] Total Payables = sum of POSTED bill balances
   - [ ] Jumlah orders sesuai dengan data di halaman Orders
4. Test empty state: login dengan company baru tanpa data

### Browser Test

Gunakan browser subagent untuk:

1. Login → buka dashboard
2. Screenshot dashboard dengan data
3. Verify angka tidak 0 (jika ada data)
