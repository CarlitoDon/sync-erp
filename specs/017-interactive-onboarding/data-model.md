# Data Model: Interactive Getting Started Guide

**Feature**: 017-interactive-onboarding  
**Type**: Frontend-only (no database changes)

## Overview

This feature does not require any new database entities. All data for determining onboarding completion status is derived from existing entities already exposed through the dashboard metrics API.

## Frontend Types

### OnboardingStep

Represents a single step in the onboarding checklist.

```typescript
interface OnboardingStep {
  id: string; // Unique identifier (e.g., 'add-products')
  title: string; // Display title (e.g., 'Add products')
  description: string; // Expanded description
  targetPath: string; // Navigation path (e.g., '/products')
  isCompleted: boolean; // Calculated from metrics
  icon?: string; // Optional emoji/icon
}
```

### OnboardingProgress

Aggregated progress state.

```typescript
interface OnboardingProgress {
  steps: OnboardingStep[]; // All onboarding steps
  completedCount: number; // Number of completed steps
  totalCount: number; // Total number of steps
  isAllComplete: boolean; // True if all steps done
  percentComplete: number; // 0-100 percentage
}
```

## Completion Criteria Mapping

| Step ID           | Title                     | Completion Condition                        | Data Source                    |
| ----------------- | ------------------------- | ------------------------------------------- | ------------------------------ |
| `create-company`  | Create your first company | Always true (user has selected a company)   | CompanyContext                 |
| `add-products`    | Add products and services | `productsCount > 0`                         | dashboardService.getMetrics()  |
| `setup-suppliers` | Set up suppliers          | Has ≥1 supplier partner                     | partnerService.listSuppliers() |
| `setup-customers` | Set up customers          | Has ≥1 customer partner                     | partnerService.listCustomers() |
| `create-order`    | Create your first order   | `pendingOrders > 0` OR has completed orders | dashboardService.getMetrics()  |
| `setup-accounts`  | Set up chart of accounts  | Has ≥1 account                              | financeService.listAccounts()  |

## Data Dependencies

### Existing Endpoints Used

1. **Dashboard Metrics** (already called)
   - `GET /invoices` → unpaidInvoices
   - `GET /products` → productsCount
   - `GET /sales-orders` → pendingOrders

2. **Additional Data Needed** (new fetches in hook)
   - `GET /partners/suppliers` → supplier count
   - `GET /partners/customers` → customer count
   - `GET /finance/accounts` → account count

## State Management

- No global state required
- Progress calculated on component mount via custom hook
- Refresh on company change (existing useCompanyData pattern)
- Dismiss state can be stored in localStorage per-company
