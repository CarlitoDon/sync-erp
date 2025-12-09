<!--
SYNC IMPACT REPORT
Version: 1.2.0 -> 1.2.1 (Patch - Tooling Adjustment)
Modified Principles:
- Tooling Standards: Switched from `pnpm` to `npm` workspaces.
Added Sections:
- None
Templates requiring updates:
- tasks-template.md (✅ updated to use npm)
-->

# Sync ERP Constitution

## Core Principles

### I. Monorepo Architecture & Boundaries

-   **Strict Separation**: `apps/web` (Frontend) MUST ONLY interact with `apps/api` (Backend) via HTTP/REST.
-   **Backend Sovereignty**: `apps/api` is the ONLY entity allowed to import `packages/database` (Prisma).
-   **Shared Isolation**: `packages/` MUST NOT import from `apps/`.
-   **Database Centralization**: Prisma schema acts as the single source of truth in `packages/database`.

### II. Uni-Directional Dependencies

-   **Flow**: `apps/` → `packages/shared` → `packages/database`.
-   **No Cycles**: Circular dependencies are strictly forbidden.
-   **Workspace Link**: Use workspace protocol (e.g., `workspace:*`) for internal dependencies.

### III. Types as Shared Contracts

-   **End-to-End Safety**: Types generated from Prisma (`packages/database`) flow to Shared Types (`packages/shared`), which are consumed by Frontend and Backend.
-   **DTOs**: Data Transfer Objects must be defined in `packages/shared/types` using Zod for runtime validation.

### IV. Layered Backend Architecture

-   **Routes (`apps/api/src/routes`)**: Entry point. Validation only. Calls Services.
-   **Services (`apps/api/src/services`)**: Business logic. Imports `packages/database`.
-   **Database (`packages/database`)**: Exposes singleton `PrismaClient`. No logic.

### V. Multi-Tenant (Multiple Company) by Design

-   **Isolation**: ALL queries must be scoped by `CompanyID`.
-   **Context**: Apps must enforce active company context from request headers/tokens.

## Reference Architecture

The project MUST follow this directory structure:

```text
sync-erp/
├── apps/
│   ├── web/                    # Vite + React Frontend
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

-   **Package Manager**: `npm` (required for workspace efficiency).
-   **Build System**: `turbo` (required for task orchestration).
-   **TypeScript**: Use `tsconfig` inheritance (`extends: "@my-org/tsconfig/base.json"`).
-   **Bundler**: Vite for Frontend, `tsc`/`tsx` for Backend.

### Configuration Rules

-   **Environment**: `.env` files live in `apps/*/`. Secrets defined THERE, not in packages.
-   **Aliases**: Use paths like `@my-org/shared` in `tsconfig` to avoid relative hell.

## Governance

This Constitution supersedes all other stylistic or architectural preferences.

-   **Amendments**: Changes to this document require a Pull Request and consensus from the team.
-   **Compliance**: Code reviews must explicitly verify compliance with these principles.

**Version**: 1.2.1 | **Ratified**: 2025-12-08 | **Last Amended**: 2025-12-08
