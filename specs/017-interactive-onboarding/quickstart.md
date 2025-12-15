# Quick Start: Interactive Getting Started Guide

**Feature**: 017-interactive-onboarding  
**Time Estimate**: 2-3 hours

## TL;DR

Replace static "Getting Started" checklist on Dashboard with an interactive component:

1. Each step is clickable (navigates to page)
2. Progress is data-driven (from existing API)
3. Shows progress bar "X of Y completed"

## Implementation Order

### Step 1: Add Types (5 min)

Update `apps/web/src/features/dashboard/types.ts`:

```typescript
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetPath: string;
  isCompleted: boolean;
  icon: string;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  isAllComplete: boolean;
}
```

### Step 2: Create Progress Hook (30 min)

Create `apps/web/src/features/dashboard/hooks/useOnboardingProgress.ts`:

```typescript
// Define ONBOARDING_STEPS array with all 6 steps
// Return progress object based on metrics
// Track: products, suppliers, customers, orders, accounts
```

### Step 3: Create OnboardingGuide Component (45 min)

Create `apps/web/src/features/dashboard/components/OnboardingGuide.tsx`:

```typescript
// Clickable steps with Link to targetPath
// Progress bar showing X/Y completed
// Expandable step details (optional P3)
// Dismiss button when complete
```

### Step 4: Update Dashboard (15 min)

Replace the static "Getting Started" section in `Dashboard.tsx`:

```tsx
// Before: inline <ul> with static items
// After: <OnboardingGuide metrics={metrics} />
```

### Step 5: Test (30 min)

1. Run `npm run dev`
2. Check empty company shows all pending
3. Click steps, verify navigation
4. Add data, verify status updates
5. Check mobile responsive

## Key Files

| File                             | Action | Lines Est. |
| -------------------------------- | ------ | ---------- |
| `types.ts`                       | MODIFY | +15        |
| `hooks/useOnboardingProgress.ts` | NEW    | ~60        |
| `components/OnboardingGuide.tsx` | NEW    | ~100       |
| `pages/Dashboard.tsx`            | MODIFY | -30, +10   |

## Dependencies

- react-router-dom (Link) - already installed
- Existing services: partnerService, financeService

## Testing Commands

```bash
# Build check
cd apps/web && npm run build

# Type check
cd apps/web && npx tsc --noEmit
```
