# sync-erp Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-10

## Active Technologies
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
- 008-api-test-coverage: Added TypeScript 5.3.3, Node.js 18+ + Vitest 1.2.0, @vitest/coverage-v8
- 007-finance-tax-returns: Added TypeScript 5.3+ (Node.js 18+) + Express, Prisma, React 18, Vite
- 006-finance-integration: Added TypeScript 5.3 (Node.js) + Prisma (ORM), Express (API)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
