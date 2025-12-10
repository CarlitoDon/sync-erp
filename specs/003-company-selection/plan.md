# Implementation Plan: Company Selection Screen

**Branch**: `003-company-selection` | **Date**: 2025-12-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/003-company-selection/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a "Company Selection" screen (`/select-company`) that intercepts the user flow immediately after login. This screen allows users to select an active company context, create a new company, or join an existing company via invite code. It acts as a gatekeeper to protected routes, ensuring `currentCompany` is always valid within the dashboard.

## Technical Context

**Language/Version**: TypeScript 5.x (Frontend & Backend)
**Primary Dependencies**: React Router v6 (Routing), React Context API (State), Express (API), Prisma (DB)
**Storage**: PostgreSQL (via Prisma)
**Testing**: Vitest (Unit/Integration), Playwright (E2E - optional)
**Target Platform**: Web Browser
**Project Type**: Monorepo (Turborepo) - Web App & API
**Performance Goals**: < 100ms redirect latency, immediate context switch
**Constraints**: Must strictly enforce `companyId` isolation once inside dashboard.
**Scale/Scope**: Core auth flow, touches AuthContext, CompanyContext, and Routing.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Boundaries**: Frontend fetches company list via API; no direct DB access.
- [x] **II. Dependencies**: `apps/web` -> `packages/shared` <- `apps/api`.
- [x] **III. Contracts**: API response types defined in `packages/shared`.
- [x] **IV. Layered Backend**: Logic in `authService` / `companyService`, not routes.
- [x] **V. Multi-Tenant**: All company selections effectively set the tenant scope.

## Project Structure

### Documentation (this feature)

```text
specs/003-company-selection/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
apps/
├── web/
│   ├── src/
│   │   ├── components/
│   │   │   └── ProtectedRoute.tsx  # Modify to enforce company context
│   │   ├── contexts/
│   │   │   └── CompanyContext.tsx  # Update for persistence
│   │   ├── pages/
│   │   │   └── CompanySelectionPage.tsx # NEW
│   │   └── services/
│   │       └── companyService.ts   # NEW: join/create methods
│   └── src/App.tsx                 # Route updates
│
└── api/
    ├── src/
    │   ├── routes/
    │   │   └── company.ts          # NEW: join endpoint
    │   └── services/
    │       └── CompanyService.ts   # NEW: join logic
    └── src/index.ts

packages/
├── database/
│   └── prisma/schema.prisma        # Add Invite Codes? (or use simple logic)
│
└── shared/
    └── src/
        ├── types/
        │   └── company.ts          # DTOs
        └── validators/
            └── company.ts          # Zod schemas
```

**Structure Decision**: Standard monorepo structure. New page in `apps/web`, new service methods in `apps/api`, shared types in `packages/shared`.
