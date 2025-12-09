# Research & Technology Decisions: Sync ERP MVP

**Feature**: Sync ERP MVP (Sales, Finance, Purchasing, Inventory)
**Date**: 2025-12-08

## Technology Stack Decisions

### Backend Framework

-   **Decision**: Express.js + TypeScript
-   **Rationale**: Mandated by project Constitution ("Express + TypeScript Backend"). Proven stability and flexibility for layered architecture.
-   **Alternatives**: NestJS (Rejected: Over-engineering for current team context), Fastify (Rejected: Express ecosystem preference).

### Frontend Framework

-   **Decision**: Vite + React
-   **Rationale**: Mandated by project Constitution. High performance HMR and build times.
-   **Alternatives**: Create React App (Deprecated), Next.js (Rejected for purely frontend role in this monorepo structure).

### Database & ORM

-   **Decision**: PostgreSQL + Prisma
-   **Rationale**:
    -   Prisma provides type-safe database access (Constitution Principle III).
    -   PostgreSQL is the standard for relational ERP data.
-   **Location**: `packages/database` (Constitution Principle I).

### Package Management

-   **Decision**: npm Workspaces
-   **Rationale**: Explicit user request to switch from pnpm to npm.

## Architectural Patterns

### Multi-Tenancy

-   **Pattern**: Row-level isolation via `companyId` column.
-   **Implementation**: Middleware in `apps/api` extracts tenant context, Service layer applies `where: { companyId }` filter to ALL queries.
-   **Rationale**: "Multi-Tenant by Design" Constitution constraint.

### Layered Architecture

-   **Pattern**: Controller (Route) -> Service -> Data Access (Prisma).
-   **Constraint**: Routes cannot import Prisma directly.
-   **Rationale**: "Layered Backend Architecture" Constitution constraint.
