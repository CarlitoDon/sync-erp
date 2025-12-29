# Quickstart: Frontend Code Quality & Performance Improvements

**Feature**: 039-frontend-improvements  
**Branch**: `039-frontend-improvements`

---

## Prerequisites

```bash
# Ensure you're on the correct branch
git checkout 039-frontend-improvements

# Install dependencies (if needed)
npm install

# Start development servers
npm run dev
```

---

## Quick Verification Steps

### 1. ErrorBoundary
```tsx
// Test in any page by temporarily adding:
throw new Error('Test error boundary');

// Expected: See friendly error page, not blank screen
```

### 2. usePrompt Hook
```tsx
import { usePrompt } from '@/components/ui';

const prompt = usePrompt();
const reason = await prompt({ 
  message: 'Why are you canceling?',
  required: true 
});
// Expected: Modal appears, returns string or null
```

### 3. Lazy Loading
```bash
# Build and analyze bundle
npm run build

# Check network tab in browser DevTools
# Feature chunks should load on navigation, not initial load
```

### 4. staleTime
```tsx
// Navigate away from a list page and return within 30s
// Expected: No loading spinner, cached data shown immediately
```

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/components/ErrorBoundary.tsx` | Create error boundary component |
| `apps/web/src/components/ui/PromptModal.tsx` | Create prompt modal + provider + hook |
| `apps/web/src/components/ui/index.ts` | Export `usePrompt` |
| `apps/web/src/app/AppProviders.tsx` | Add `PromptProvider`, wrap with `ErrorBoundary` |
| `apps/web/src/app/AppRouter.tsx` | Add `lazy()` imports, `Suspense` wrappers |
| `apps/web/src/lib/trpcProvider.tsx` | Add `staleTime: 30_000` |

---

## Testing

```bash
# Run frontend tests (when added)
npm run test --workspace=@sync-erp/web

# Manual testing checklist:
# [ ] Trigger error in a component - see error boundary
# [ ] Call usePrompt - see styled modal
# [ ] Press Escape in prompt modal - closes, returns null
# [ ] Navigate to feature page - see chunk load in network tab
# [ ] Navigate away and back within 30s - no refetch spinner
```

---

## Common Issues

### Lazy Loading: "Module not found"
- Ensure page component has `export default`
- Check import path is correct (case-sensitive on Linux)

### ErrorBoundary: Not catching errors
- Only catches render-time errors
- Event handlers need their own try-catch
- Async errors (promises) not caught

### usePrompt: Focus not trapped
- Ensure modal is actually rendered (check `isOpen` state)
- Check for z-index conflicts with other modals

---

## Constitution Compliance

- [x] **IV. Frontend**: Logic in `components/`, UI renders state
- [x] **IV. User Safety**: `usePrompt()` replaces `window.prompt()`
- [x] **XIII. Zero-Lag**: Lazy loading prevents initial load freeze
