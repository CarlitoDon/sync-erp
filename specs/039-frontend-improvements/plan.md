# Implementation Plan: Frontend Code Quality & Performance Improvements

**Branch**: `039-frontend-improvements` | **Date**: December 29, 2025 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/039-frontend-improvements/spec.md`

## Summary

Improve frontend code quality and performance through:
1. **ErrorBoundary** - Graceful error handling to prevent blank screens
2. **usePrompt()** - Accessible replacement for `window.prompt()`
3. **Code Splitting** - Lazy load feature pages to reduce initial bundle
4. **Query Caching** - Configure `staleTime` to prevent unnecessary refetches
5. **Component Consistency** - Standardize on shared UI components

## Technical Context

**Language/Version**: TypeScript 5.x, React 18  
**Primary Dependencies**: React 18, React Router 6, tRPC React Query, Tailwind CSS 4, Vite  
**Storage**: N/A (frontend only)  
**Testing**: Component tests with Vitest + React Testing Library  
**Target Platform**: Web (Modern browsers - Chrome, Firefox, Safari, Edge)  
**Project Type**: Web frontend (Vite + React SPA)  
**Performance Goals**: Initial bundle <500KB, feature chunks <100KB each, no blank screens  
**Constraints**: WCAG 2.1 AA for modals, no browser-native dialogs  
**Scale/Scope**: 30+ pages across 6 feature domains

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [N/A] **I. Dependency**: Frontend ↔ Backend via HTTP only? Apps → Packages? _(Frontend-only feature)_
- [N/A] **I. Multi-Tenant**: ALL data isolated by `companyId`? _(No data changes)_
- [N/A] **II. Type System**: Shared types in `packages/shared`? Types use `z.infer`? _(No new API types)_
- [N/A] **III. Backend Layers**: Service checks `Policy` before Action? _(No backend changes)_
- [N/A] **III-A. Dumb Layers**: Controller only calls service? _(No backend changes)_
- [x] **IV. Frontend**: Logic in `src/features`? UI is State Projection? _(ErrorBoundary/PromptModal in components/)_
- [N/A] **V. Callback-Safe**: Services export standalone functions? _(No services affected)_
- [x] **VI. Build Verification**: `npx tsc --noEmit` and `npm run build` will pass? _(Yes)_
- [N/A] **VII. Parity**: If Feature A exists in Sales, does it exist in Procurement? _(Global components)_
- [x] **VIII. Performance**: No N+1 Client loops? Lists use Backend `include`? _(Lazy loading improves perf)_
- [N/A] **IX. Apple-Standard**: Derived from `BusinessShape`? _(No business logic)_
- [N/A] **X. Data Flow**: Frontend → API → ... → DB? _(No data flow changes)_
- [x] **XI. Human Interface**: Clear Navigation? Simplified Workflows? _(Better error UX)_
- [x] **XIII. Engineering**: Zero-Lag UI? Optimistic Updates? _(Lazy loading + staleTime)_
- [N/A] **XV. Test Contracts**: Mocks satisfy all Policy/Service layer expectations? _(Frontend tests only)_
- [N/A] **XVI. Financial Precision**: `Decimal` for money? _(No financial calculations)_
- [N/A] **XVII. Integration State**: Sequential flows in single `it()` block? _(No integration tests)_
- [N/A] **XVIII. Schema for Raw SQL**: `$executeRaw` column names match Prisma? _(No SQL)_
- [N/A] **XIX. Seed Completeness**: All expected accounts/configs in seed? _(No seed changes)_
- [x] **XXI. Anti-Bloat**: Reuse existing methods? No redundant method creation? _(Reuse useConfirm pattern)_

## Project Structure

### Documentation (this feature)

```text
specs/039-frontend-improvements/
├── plan.md              # This file
├── research.md          # Research decisions (complete)
├── data-model.md        # Component interfaces (complete)
├── quickstart.md        # Setup guide (complete)
├── contracts/           # API contracts (N/A - frontend only)
│   └── api-contracts.md
├── checklists/
│   └── requirements.md  # Validation checklist
└── tasks.md             # Task breakdown (next step)
```

### Source Code (files to modify)

```text
apps/web/src/
├── components/
│   ├── ErrorBoundary.tsx          # NEW - Global error boundary
│   └── ui/
│       ├── PromptModal.tsx        # NEW - Promise-based prompt modal
│       ├── ConfirmModal.tsx       # REFERENCE - Pattern to follow
│       └── index.ts               # MODIFY - Export usePrompt
├── app/
│   ├── AppRouter.tsx              # MODIFY - Add lazy loading + Suspense
│   └── AppProviders.tsx           # MODIFY - Add PromptProvider, ErrorBoundary
└── lib/
    └── trpcProvider.tsx           # MODIFY - Add staleTime config
```

## Implementation Phases

### Phase 1: Core Infrastructure (P1)
1. Create `ErrorBoundary` component
2. Create `PromptModal` + `usePrompt` hook
3. Integrate into `AppProviders`

### Phase 2: Performance (P2)
4. Add `staleTime` to tRPC QueryClient
5. Implement lazy loading in `AppRouter`

### Phase 3: Cleanup (P3)
6. Replace `window.prompt()` calls with `usePrompt()`
7. Replace inline spinners with `LoadingState`

## Governance Update

No Constitution violations. This feature:
- Follows existing patterns (replicates `useConfirm` for `usePrompt`)
- Improves compliance with Constitution IV (no `window.confirm/prompt`)
- Improves performance (Constitution XIII - Zero-Lag UI)
