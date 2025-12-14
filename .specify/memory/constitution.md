<!--
SYNC IMPACT REPORT
Version: 1.5.0 -> 1.6.0 (Minor - Added Service Pattern Principle)
Modified Principles:
- None
Added Sections:
- IX. Callback-Safe Service Patterns (New principle for frontend services)
Removed Sections:
- None
Templates requiring updates:
- plan-template.md (⚠ pending - may add service pattern check)
- spec-template.md (✅ no changes needed)
- tasks-template.md (✅ no changes needed)
Follow-up TODOs:
- Refactor existing services to follow standalone function pattern
-->

# Sync ERP Constitution

## Core Principles

### I. Monorepo Architecture & Boundaries

- **Strict Separation**: `apps/web` (Frontend) MUST ONLY interact with `apps/api` (Backend) via HTTP/REST.
- **Backend Sovereignty**: `apps/api` is the ONLY entity allowed to import `packages/database` (Prisma).
- **Repository Pattern**: Within `apps/api`, ONLY **Repositories** (`src/repositories`) are allowed to import `packages/database`. Controllers and Services MUST NOT access the database directly.
- **Shared Isolation**: `packages/` MUST NOT import from `apps/`.
- **Database Centralization**: Prisma schema acts as the single source of truth in `packages/database`.

### II. Uni-Directional Dependencies

- **Flow**: `apps/` → `packages/shared` → `packages/database`.
- **No Cycles**: Circular dependencies are strictly forbidden.
- **Workspace Link**: Use workspace protocol (e.g., `workspace:*`) for internal dependencies.

### III. Types as Shared Contracts

- **End-to-End Safety**: Types generated from Prisma (`packages/database`) flow to Shared Types (`packages/shared`), which are consumed by Frontend and Backend.
- **DTOs**: Data Transfer Objects must be defined in `packages/shared/types` using Zod for runtime validation.

### IV. Layered Backend Architecture (Strict Controller-Service-Repository)

- **Controllers (`apps/api/src/controllers`)**: Handle HTTP requests, validation, and response formatting. Call Services. NEVER access DB.
- **Services (`apps/api/src/services`)**: Contain business logic. Call Repositories. NEVER access DB directly.
- **Repositories (`apps/api/src/repositories`)**: Encapsulate data access. Import `packages/database`. Expose domain objects, not raw Prisma types where possible.
- **Database (`packages/database`)**: Exposes singleton `PrismaClient`. No logic.

### V. Multi-Tenant (Multiple Company) by Design

- **Isolation**: ALL queries must be scoped by `CompanyID`.
- **Context**: Apps must enforce active company context from request headers/tokens.

### VI. Feature-Based & DRY Frontend Architecture

- **Feature Sovereignty**: Business logic (components, hooks, services, types) MUST reside in `src/features/[domain]/`, NOT in global folders.
- **Global Scope**:
  - `src/components/ui/`: Strictly for generic, reuseable UI atoms (e.g., Button, Modal) with NO business logic.
  - `src/hooks/`, `src/services/`, `src/utils/`: Strictly for app-wide shared logic (e.g., `useAuth`, `api.ts`).
- **DRY Patterns**:
  - **Component Abstraction**: Extract repeated UI patterns to `components/ui` or `features/[domain]/components`.
  - **No Copy-Paste**: Forbidden for styling, error handling, API patterns.

### VII. Systematic Refactoring Protocol

- **Search Before Edit**: ALWAYS grep/search for ALL instances before making pattern changes:
  ```bash
  grep -r "pattern" apps/web/src --include="*.tsx"
  ```
- **Update All At Once**: When changing a pattern, update ALL occurrences in a single commit.
- **Verify After Refactor**: Search again after changes to confirm zero remaining instances.
- **Incremental Commits**: Commit per feature/change, not per session. Enables easier rollback.

### VIII. Global UI Patterns

- **Error Handling**: API errors MUST be handled globally via Axios interceptor, not per-page try-catch.
- **Success Feedback**: Use centralized `apiAction()` helper for success toasts, not direct `toast()` imports.
- **Confirmation Dialogs**: Use custom `<ConfirmModal>` with `useConfirm()` hook. NEVER use native `window.confirm()`.
- **Loading States**: Use consistent loading patterns via hooks (e.g., `useCompanyData` returns `loading` state).
- **No Native Browser UI**: Avoid `alert()`, `confirm()`, `prompt()`. Always use custom styled components.

### IX. Callback-Safe Service Patterns

- **No `this` in Services**: Frontend service objects MUST NOT use `this` to call internal methods. When service methods are passed as callbacks to hooks (e.g., `useCompanyData`), `this` context is lost.
- **Standalone Functions**: Service internal methods MUST be standalone functions, not object methods:

  ```typescript
  // ✅ CORRECT: Standalone functions
  export const myService = { getMetrics };

  async function getMetrics() {
    const data = await fetchHelper(); // Direct call, no 'this'
    return data;
  }

  async function fetchHelper() {
    /* ... */
  }

  // ❌ WRONG: Object methods with 'this'
  export const myService = {
    async getMetrics() {
      return await this.helper(); // 'this' will be undefined!
    },
    async helper() {
      /* ... */
    },
  };
  ```

- **Rationale**: React hooks like `useCompanyData(service.getMetrics, null)` extract the method reference, losing the object context. Using standalone functions avoids this class of runtime errors entirely.

## Reference Architecture

The project MUST follow this directory structure:

```text
sync-erp/
├── apps/
│   ├── web/                    # Vite + React Frontend
│   │   ├── src/
│   │   │   ├── app/            # Global setup (App.tsx, routes, providers)
│   │   │   ├── components/
│   │   │   │   ├── ui/         # Generic UI atoms (logic-free)
│   │   │   │   └── layout/     # Structural components (Sidebar, Header)
│   │   │   ├── features/       # Business Domains
│   │   │   │   └── [domain]/   # e.g., auth, finance
│   │   │   │       ├── components/
│   │   │   │       ├── hooks/
│   │   │   │       ├── services/
│   │   │   │       └── types/
│   │   │   ├── hooks/          # Global utility hooks
│   │   │   ├── services/       # Global API clients
│   │   │   └── utils/          # Global helpers
│   └── api/                    # Express + TypeScript Backend
├── packages/
│   ├── database/               # Prisma Client & Schema
│   │   ├── prisma/schema.prisma
│   │   └── src/index.ts        # Exports singleton PrismaClient
│   ├── shared/                 # Types, Utils, Zod Validators
│   ├── ui/                     # Shared React Components
│   └── tsconfig/               # Shared TS Configurations
├── turbo.json                  # Build Orchestration
└── package.json                # Workspaces Definition
```

## Development Standards

### Tooling & Configuration

- **Package Manager**: `npm` (required for workspace efficiency).
- **Build System**: `turbo` (required for task orchestration).
- **TypeScript**: Use `tsconfig` inheritance (`extends: "@my-org/tsconfig/base.json"`).
- **Bundler**: Vite for Frontend, `tsc`/`tsx` for Backend.
- **Type Simplicity**: Avoid over-engineered generics. If TypeScript inference fails, simplify the types.

### Configuration Rules

- **Environment**: `.env` files live in `apps/*/`. Secrets defined THERE, not in packages.
- **Aliases**: Use paths like `@my-org/shared` in `tsconfig` to avoid relative hell.

## Governance

This Constitution supersedes all other stylistic or architectural preferences.

- **Amendments**: Changes to this document require a Pull Request and consensus from the team.
- **Compliance**: Code reviews must explicitly verify compliance with these principles.

**Version**: 1.6.0 | **Ratified**: 2025-12-08 | **Last Amended**: 2025-12-13
