# Quick Start: Dashboard Implementation

## Files to Create/Modify

| Action | File                                                  | Purpose                   |
| ------ | ----------------------------------------------------- | ------------------------- |
| NEW    | `src/features/dashboard/services/dashboardService.ts` | Fetch & aggregate metrics |
| NEW    | `src/features/dashboard/types.ts`                     | TypeScript interfaces     |
| MODIFY | `src/features/dashboard/pages/Dashboard.tsx`          | Wire real data            |

## Implementation Order

1. Create `types.ts` (DashboardMetrics interface)
2. Create `dashboardService.ts` (API calls + aggregation)
3. Modify `Dashboard.tsx` (use service, display data)
4. Add loading/error states
5. Test manually

## Key Patterns

```typescript
// Use existing hook pattern
const { data, loading } = useCompanyData(
  dashboardService.getMetrics,
  null
);

// Use formatCurrency for money values
{
  formatCurrency(data.totalReceivables);
}
```

## Testing

```bash
# Run existing dashboard tests
cd apps/web && npm test -- --run

# Manual: Login → Dashboard shows real numbers
```
