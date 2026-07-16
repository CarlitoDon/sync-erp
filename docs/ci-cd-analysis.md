# Analysis: Sync ERP CI/CD Issues

## Issues Found
1. **Deployment Lock Contention**: `deploy-api-` concurrency group with `cancel-in-progress: false` might cause queue buildup if multiple pushes happen.
2. **Hostinger SSH Fragility**: Relying on raw `ssh` commands in bash with `eval $(ssh-agent)` is prone to environmental drift or agent timeout.
3. **Prisma Binary Inconsistency**: `npm install --omit=dev` wipes `node_modules/@sync-erp/database`, requiring a re-extraction of the generated client. This is a known flakey pattern.
4. **Health Check Latency**: Hardcoded `sleep 10` loops are brittle.
5. **No Independent Verification**: Pipeline reports success immediately after restart command, not after health check.

## Proposed Fixes
1. **Pipeline Cleanup**: Simplify deployment steps using pre-compiled artifacts in a dedicated deployment job.
2. **Robust Verification**: Add a post-deployment verification job that queries a private health endpoint with retries and timeout.
3. **Environment Sync**: Ensure `.env.production.local` and `.env.staging` (placeholders) are explicitly handled, preventing secret leaks.
