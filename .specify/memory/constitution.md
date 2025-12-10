<!--
SYNC IMPACT REPORT
Version: 1.2.1 -> 1.3.0 (Minor - Added Frontend Architecture Principles)
Modified Principles:
- None
Added Sections:
- VI. DRY Frontend Patterns (new principle for component abstraction)
- VII. Systematic Refactoring Protocol (new principle for consistent changes)
- VIII. Global UI Patterns (new principle for toasts, modals, loading states)
Removed Sections:
- None
Templates requiring updates:
- spec-template.md (✅ updated - added Constitution Compliance section)
- tasks-template.md (✅ updated - added UI Components & Patterns phase)
Follow-up TODOs:
- None
-->

# Sync ERP Constitution

## Core Principles

### I. Monorepo Architecture & Boundaries

- **Strict Separation**: `apps/web` (Frontend) MUST ONLY interact with `apps/api` (Backend) via HTTP/REST.
- **Backend Sovereignty**: `apps/api` is the ONLY entity allowed to import `packages/database` (Prisma).
- **Shared Isolation**: `packages/` MUST NOT import from `apps/`.
- **Database Centralization**: Prisma schema acts as the single source of truth in `packages/database`.

### II. Uni-Directional Dependencies

- **Flow**: `apps/` → `packages/shared` → `packages/database`.
- **No Cycles**: Circular dependencies are strictly forbidden.
- **Workspace Link**: Use workspace protocol (e.g., `workspace:*`) for internal dependencies.

### III. Types as Shared Contracts

- **End-to-End Safety**: Types generated from Prisma (`packages/database`) flow to Shared Types (`packages/shared`), which are consumed by Frontend and Backend.
- **DTOs**: Data Transfer Objects must be defined in `packages/shared/types` using Zod for runtime validation.

### IV. Layered Backend Architecture

- **Routes (`apps/api/src/routes`)**: Entry point. Validation only. Calls Services.
- **Services (`apps/api/src/services`)**: Business logic. Imports `packages/database`.
- **Database (`packages/database`)**: Exposes singleton `PrismaClient`. No logic.

### V. Multi-Tenant (Multiple Company) by Design

- **Isolation**: ALL queries must be scoped by `CompanyID`.
- **Context**: Apps must enforce active company context from request headers/tokens.

### VI. DRY Frontend Patterns

- **Component Abstraction**: When similar UI patterns appear in 2+ places, extract to a reusable component (e.g., `ActionButton`, `DataTable`).
- **Hook Abstraction**: When similar logic appears in 2+ places, extract to a custom hook (e.g., `useApiAction`, `useCompanyData`).
- **No Copy-Paste**: Duplicate code is a signal to create abstraction. Copy-paste is FORBIDDEN for:
  - Button styling patterns
  - Error handling try-catch blocks
  - API call patterns
  - Form validation logic

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

## Reference Architecture

The project MUST follow this directory structure:

```text
sync-erp/
├── apps/
│   ├── web/                    # Vite + React Frontend
│   │   ├── src/
│   │   │   ├── components/     # Reusable UI components
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── contexts/       # React contexts (Auth, Company, etc.)
│   │   │   ├── services/       # API service layer
│   │   │   └── pages/          # Page components
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

**Version**: 1.3.0 | **Ratified**: 2025-12-08 | **Last Amended**: 2025-12-10
