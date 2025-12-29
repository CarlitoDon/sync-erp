# Data Model: Frontend Code Quality & Performance Improvements

**Feature**: 039-frontend-improvements  
**Date**: December 29, 2025

---

## Overview

This is a **frontend-only** feature with no database changes. The data model describes React component interfaces and TypeScript types.

---

## Component Interfaces

### 1. ErrorBoundary

```typescript
// apps/web/src/components/ErrorBoundary.tsx

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode; // Custom fallback UI (optional)
  onError?: (error: Error, errorInfo: ErrorInfo) => void; // Error callback
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
```

**Behavior:**
- Wraps child components
- Catches render-time errors
- Displays fallback UI when error occurs
- Provides "Reload" recovery option

---

### 2. PromptModal

```typescript
// apps/web/src/components/ui/PromptModal.tsx

interface PromptOptions {
  title?: string;           // Modal title (default: "Enter Value")
  message: string;          // Instruction text
  placeholder?: string;     // Input placeholder
  defaultValue?: string;    // Pre-filled value
  confirmText?: string;     // Submit button text (default: "Submit")
  cancelText?: string;      // Cancel button text (default: "Cancel")
  required?: boolean;       // Require non-empty input (default: false)
  multiline?: boolean;      // Use textarea instead of input (default: false)
  maxLength?: number;       // Maximum character length
}

interface PromptContextType {
  prompt: (options: PromptOptions) => Promise<string | null>;
}

interface PromptModalState extends PromptOptions {
  isOpen: boolean;
  inputValue: string;
  resolve: ((value: string | null) => void) | null;
}
```

**Return Values:**
- `string` - User submitted with text
- `null` - User cancelled or pressed Escape

---

### 3. Lazy Loading Types

```typescript
// apps/web/src/app/AppRouter.tsx

// React.lazy return type (built-in)
type LazyComponent = React.LazyExoticComponent<React.ComponentType<{}>>;

// Suspense fallback
interface SuspenseProps {
  fallback: ReactNode;
  children: ReactNode;
}
```

**Example:**
```typescript
const PurchaseOrders: LazyComponent = lazy(() => 
  import('@/features/procurement/pages/PurchaseOrders')
);
```

---

### 4. QueryClient Configuration

```typescript
// apps/web/src/lib/trpcProvider.tsx

interface QueryClientOptions {
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: boolean;  // false
      retry: number;                   // 1
      staleTime: number;               // 30_000 (30 seconds)
      gcTime: number;                  // 300_000 (5 minutes)
    };
  };
}
```

---

## State Diagrams

### ErrorBoundary State Machine

```
┌─────────────┐     error thrown      ┌─────────────┐
│   NORMAL    │ ─────────────────────>│    ERROR    │
│ hasError=F  │                       │ hasError=T  │
└─────────────┘                       └─────────────┘
       ^                                     │
       │         user clicks reload          │
       └─────────────────────────────────────┘
```

### PromptModal State Machine

```
┌─────────────┐     prompt() called     ┌─────────────┐
│   CLOSED    │ ───────────────────────>│    OPEN     │
│  isOpen=F   │                         │  isOpen=T   │
└─────────────┘                         └─────────────┘
       ^                                       │
       │  ┌─────────────────┬─────────────────┤
       │  │ Submit (valid)  │ Cancel/Escape   │
       │  v                 v                 │
       │ resolve(value)   resolve(null)       │
       └──────────────────────────────────────┘
```

---

## File Structure

```
apps/web/src/
├── components/
│   ├── ErrorBoundary.tsx      # NEW - Global error boundary
│   └── ui/
│       ├── PromptModal.tsx    # NEW - Promise-based prompt
│       └── index.ts           # MODIFY - Export usePrompt
├── app/
│   ├── AppRouter.tsx          # MODIFY - Lazy loading
│   └── AppProviders.tsx       # MODIFY - Add PromptProvider
└── lib/
    └── trpcProvider.tsx       # MODIFY - Add staleTime
```

---

## Component Relationships

```
AppProviders
├── TRPCProvider (with staleTime config)
├── ConfirmProvider (existing)
├── PromptProvider (NEW)
└── ErrorBoundary (NEW)
    └── RouterProvider
        └── AppRouter
            └── Routes (with Suspense for lazy components)
```

---

## No Database Changes

This feature does not require any Prisma schema modifications.
