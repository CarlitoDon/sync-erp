## Summary

Fixes the CI/CD pipeline for Sync ERP Hostinger deployment. The primary issue was that `PrismaClientInitializationError` occurred because:

1. The query engine binary (`node_modules/.prisma/client/*.engine.node`) was never included in the deployment artifact
2. `npm install --omit=dev --ignore-scripts` on Hostinger doesn't generate Prisma engine binaries correctly
3. PM2 restart was hardcoded to `sync-erp-api-staging` for ALL environments (including production)
4. Health check had no backoff and would fail fast

## Changes

### `.github/workflows/ci-cd.yml`
- **Include Prisma engine binary in artifact** - `node_modules/.prisma/client/` (query engine `.engine.node` binary), `@prisma/client`, and `@prisma/adapter-pg` JS wrappers are now packaged in the build artifact
- **Remote binary injection** - After `npm install` on Hostinger, the pre-compiled `.prisma/client/`, `@prisma/*`, and `@sync-erp/database` are injected from the GHA-built tarball
- **PM2 restart per environment** - Now resolves `sync-erp-api` (production/main) vs `sync-erp-api-staging` (staging/dev) dynamically
- **Health check with backoff** - Multi-endpoint verification (`/health`, `/mcp/health`), 8 retries with progressive delays (5s-30s), distinct curl error handling
- **Environment secrets** - `DATABASE_URL` and `JWT_SECRET` from GitHub Secrets, never in git history

### `packages/database/prisma/schema.prisma`
- Removed invalid `linux-musl-openssl-1.1.x` binary target (not supported by Prisma 7.1.0 - Prisma rejected generation)

## Validation
- [x] YAML validates
- [x] Two commits on `fix/ci-cd-hostinger-prisma`
- [x] All pipeline issues documented
