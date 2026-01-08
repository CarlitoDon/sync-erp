# sync-erp Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-10

## Active Technologies
- TypeScript 5.0+ (Node.js 20 LTS) + Express (Backend), Vite + React (Frontend), Prisma (ORM), Zod (Validation), Decimal.js (Finance) (035-procure-to-pay-p2p)
- TypeScript 5.x, React 18.x + React, React Router, tRPC React Query, Tailwind CSS 4, Vite (040-frontend-improvements-p2)
- N/A (frontend-only) (040-frontend-improvements-p2)
- TypeScript / Node.js 18+ + Express, Prisma, Decimal.js, Zod (042-cash-and-bank)
- TypeScript / Node.js 18+ (Backend), TypeScript / React 18 (Frontend) (043-rental-business)
- PostgreSQL (via Prisma ORM) (043-rental-business)

- TypeScript 5.x (Node 20+) + Vitest, Prisma Clien (030-test-floor-phase1)
- PostgreSQL (Test DB) with Seeded Scenarios (030-test-floor-phase1)
- TypeScript 5.x (Node.js 18+) + Express, Prisma, React, Vitest, Zod (034-grn-fullstack)

- TypeScript 5.9, Node.js 20+ + Express, Prisma, Vitest (023-fix-idempotency-scope)
- TypeScript 5.x (Node.js) + Prisma ORM, Postgres (026-parallel-saga-safety)
- TypeScript 5.x (Node.js backend) + Express.js, Prisma (027-pending-shape-guard)
- TypeScript 5.x + Express, Zod, Prisma (028-domain-contract-stabilization)

- TypeScript 5.x, React 18, Node.js 20 + `react-router-dom`, `@sync-erp/shared`, `axios` (019-optimize-details)
- Postgres (Prisma ORM) (019-optimize-details)
- TypeScript 5.x (Node.js 20.x) + Express, Prisma ORM, Zod, Vitest (020-apple-backend-refactor)

- TypeScript 5.x + Express, Vitest, Prisma Client (010-test-refactor-3layer)
- PostgreSQL via Prisma (010-test-refactor-3layer)
- TypeScript 5.x + React 18, Vite 7, Tailwind 4, Vitest 4 (011-frontend-feature-refactor)
- LocalStorage (for auth tokens), Server State (TanStack Query / axios) (011-frontend-feature-refactor)
- TypeScript 5.4 + React 18.2, Vite 5.1, TailwindCSS 3.4, TanStack Query v5 (012-core-ui-features)
- N/A (Frontend only) (012-core-ui-features)
- TypeScript 5.x, Node.js 20+ + Express, Zod, @sync-erp/shared (013-backend-shared-validation)
- N/A (validation layer only) (013-backend-shared-validation)

- TypeScript 5.x (Frontend & Backend) + React Router v6 (Routing), React Context API (State), Express (API), Prisma (DB) (003-company-selection)
- PostgreSQL (via Prisma) (003-company-selection)
- TypeScript 5.x + React 18 + React Router v6, React Context API, Tailwind CSS (or vanilla CSS) (004-sidebar)
- localStorage (for sidebar state persistence) (004-sidebar)
- TypeScript 5.x (Node 20+) + React 18 (Frontend), Express 4 (Backend), Prisma 5 (ORM) (005-finance-accounting)
- PostgreSQL 16 (005-finance-accounting)
- TypeScript 5.3 (Node.js) + Prisma (ORM), Express (API) (006-finance-integration)
- TypeScript 5.3+ (Node.js 18+) + Express, Prisma, React 18, Vite (007-finance-tax-returns)
- TypeScript 5.3.3, Node.js 18+ + Vitest 1.2.0, @vitest/coverage-v8 (008-api-test-coverage)
- N/A (tooling configuration only) (008-api-test-coverage)
- TypeScript 5.x (React 18) + Vitest, @testing-library/react, @testing-library/jest-dom, jsdom (009-web-test-coverage)

- TypeScript 5.3+ + Express.js, React 18, Zod, @sync-erp/shared (002-user-auth)

## Project Structure

```text
src/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.3+: Follow standard conventions

## Recent Changes
- 043-rental-business: Added TypeScript / Node.js 18+ (Backend), TypeScript / React 18 (Frontend)
- 042-cash-and-bank: Added TypeScript / Node.js 18+ + Express, Prisma, Decimal.js, Zod
- 042-cash-and-bank: Added TypeScript / Node.js 18+ + Express, Prisma, Decimal.js, Zod



<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
