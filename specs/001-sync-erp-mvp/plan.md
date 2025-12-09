# Implementation Plan: Sync ERP MVP

**Branch**: `001-sync-erp-mvp` | **Date**: 2025-12-08 | **Spec**: [specs/001-sync-erp-mvp/spec.md](spec.md)
**Input**: Feature specification from `/specs/001-sync-erp-mvp/spec.md`

## Summary

Implement the MVP modules (Sales, Finance, Purchasing, Inventory, Warehousing) with Multi-Company support using a Strict Monorepo Architecture (Vite Frontend + Express Backend + Shared Prisma Database).

## Technical Context

**Language/Version**: TypeScript 5.0+ (Strict Mode)
**Primary Dependencies**:

-   Backend: Node.js, Express, Prisma, Zod
-   Frontend: React, Vite, TailwindCSS
-   Tooling: npm (workspaces), turbo
    **Storage**: PostgreSQL (via `packages/database`)
    **Testing**: Vitest (Unit/Integration)
    **Target Platform**: Web (Responsive)
    **Project Type**: Monorepo (Apps + Packages)
    **Constraints**:
-   Strict Separation of Concerns (Frontend <-> API <-> DB)
-   Strict Multi-Tenancy (CompanyID scoping)
-   Uni-directional dependencies

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

-   [x] **I. Boundaries**: Does Frontend strictly avoid direct DB/Logic imports? (Yes, separate apps)
-   [x] **II. Dependencies**: Are dependencies uni-directional (Apps -> Packages)? (Yes, enforced by workspace)
-   [x] **III. Contracts**: Are shared types defined in `packages/shared`? (Yes)
-   [x] **IV. Layered Backend**: Is logic strictly in Services (not Routes)? (Yes, service layer pattern)
-   [x] **V. Multi-Tenant**: Is ALL data isolated by `companyId`? (Yes, mandatory in queries)

## Project Structure

### Documentation (this feature)

```text
specs/001-sync-erp-mvp/
├── plan.md              # This file
├── research.md          # N/A for MVP (Standard Stack)
├── tasks.md             # To be generated
└── contracts/           # API Definitions (Zod/TS)
```

### Source Code (repository root)

```text
apps/
├── web/                    # Frontend (Vite + React)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/       # API clients
│   └── vite.config.ts
│
└── api/                    # Backend (Express + TypeScript)
    ├── src/
    │   ├── routes/         # Entry points
    │   ├── services/       # Business logic
    │   └── middlewares/
    └── tsconfig.json

packages/
├── database/               # Prisma
│   ├── prisma/schema.prisma
│   └── src/index.ts
│
├── shared/                 # Types & Utils
│   ├── src/
│   │   ├── types/
│   │   └── validators/     # Zod schemas
│   └── package.json
│
└── ui/                     # Shared Components
    └── src/components/
```

**Structure Decision**: Adopts the **Constitution Reference Architecture** (v1.2.1) using `apps/api`, `apps/web`, and `packages/database`. This ensures strict backend sovereignty over the database and clear boundaries.

## Complexity Tracking

| Violation          | Why Needed                      | Simpler Alternative Rejected Because                   |
| ------------------ | ------------------------------- | ------------------------------------------------------ |
| Monorepo Structure | Enforced by Constitution v1.2.1 | Single-folder project violates separation of concerns. |
