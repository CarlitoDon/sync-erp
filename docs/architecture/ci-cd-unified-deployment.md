# Unified Deployment CI/CD (Hostinger + Vercel)

## Problem
Multiple disjointed GitHub Actions files (`ci.yml`, `ci-cd.yml`, `deploy-*.yml`) existed simultaneously, causing CI runner waste, duplicate deployments, and architectural confusion (e.g. attempting to mix Vercel Git Integration with explicit Hooks).

## Decision
We enforce a unified **`ci-cd.yml`** as the sole pipeline for operations, deleting the legacy workflows. 

## Mechanism
1. **Frontend (Vercel)**: Deployed using fully controlled **Vercel CLI commands via Actions**. Vercel's native Git auto-integrations should be disabled/ignored at Vercel's side for this repo to prevent duplicate deployment runs.
2. **Backend (Hostinger API)**: Generated and built inside GitHub Actions runners to bypass environment limitations typically seen on Shared Hostings. Packaged as a tarball, then extracted remotely through an `ssh` inline script. The script retains the `@sync-erp/database` module (which embeds the compiled Prisma engine from Github Actions) and safely injects it *after* running remote `npm install`.

## Code Coverage / Components
- `.github/workflows/ci-cd.yml`: Holds logic for Turborepo caching, Hostinger SSH + Prisma bundling, and Vercel CLI execution.
- `docs/ci-cd.md`: Reflects 100% CLI mode.

## Gap Analysis (Resolved)
- Prisma binary matching Hostinger OS: Previously failed occasionally due to `node_modules` overrides. Fixed by enforcing a strict extract-post-install sequence in the `.github/workflows/ci-cd.yml`.
- Vercel deployments: Dropped deploy hooks rate-limit failures by switching natively to prebuilt configurations via token.
