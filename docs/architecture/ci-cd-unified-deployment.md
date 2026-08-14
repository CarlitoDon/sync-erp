# Unified Deployment CI/CD (Hostinger + Vercel)

Current source review/update: 2026-08-14. Dated audit findings and run
references below are snapshots. The Hostinger trust contract has staging
activation evidence; this document does not assert production closure.

## Problem
Multiple disjointed GitHub Actions files (`ci.yml`, `ci-cd.yml`, `deploy-*.yml`) existed simultaneously, causing CI runner waste, duplicate deployments, and architectural confusion (e.g. attempting to mix Vercel Git Integration with explicit Hooks).

## Decision

`ci-cd.yml` is the canonical API/Web pipeline. Hostinger MCP deployment and the
staging API rollback drill remain separate workflows because they have distinct
triggers and safety boundaries; they share the same Hostinger SSH trust
contract. This is a unified deployment contract, not a claim that one workflow
file owns every operation.

## Mechanism
1. **Frontend (Vercel)**: Deployed using fully controlled **Vercel CLI commands via Actions**. Vercel's native Git auto-integrations should be disabled/ignored at Vercel's side for this repo to prevent duplicate deployment runs.
2. **Backend (Hostinger API)**: Generated and built inside GitHub Actions runners to bypass environment limitations typically seen on Shared Hostings. `npm run build:api` produces `apps/api/dist`; on a push, CI copies that output, `apps/api/package.pro.json`, and the required Prisma files into `deploy/api-mcp/`, runs `npm install --prefix deploy/api-mcp --omit=dev`, and overlays the compiled `@sync-erp/database` package before uploading `api-mcp-build`. The release tarball is validated against the expected release SHA, then transferred and activated remotely through an `ssh` inline script. Hostinger receives the runner-built production dependency tree; it is not the place where the workspace dependency tree is installed.
3. **Standalone MCP (Hostinger)**: `apps/mcp/dist` is built on the runner, copied into `deploy/mcp/`, and paired with a production-only dependency tree created under `deploy/mcp/node_modules/` before transfer.

## Triggers and gates

- `.github/workflows/ci-cd.yml` runs on pull requests to `main`/`dev`, pushes to
  `main`/`dev`, and manual dispatch. `changes`, `ci-api`, and `ci-web` run on
  those events; `deploy_api` runs only for `push`, needs `changes` plus
  `ci-api`, and does not consume the `api` change-filter output, while
  `deploy_web` runs only for `push`, needs `changes` plus `ci-web`, and requires
  the `web` output to be `true`. Manual dispatch has no deployment-environment
  input and does not run API/Web deploy jobs.
- `.github/workflows/deploy-mcp-hostinger.yml` runs for path-filtered pushes to
  `main`/`dev` and manual dispatch with a required `environment` choice of
  `staging` or `production` (default `staging`). Its source maps `main` to
  production and does not restrict a manually selected production environment
  to a particular ref.
- `.github/workflows/staging-api-rollback-drill.yml` is manual-only, pins its
  environment to `staging`, and accepts only `dev` or `codex/*` refs.
- `.github/workflows/e2e-playwright.yml` runs on `push`, pull request, and
  manual dispatch; it is separate from the CI/CD deploy job dependencies.

## Hostinger SSH trust contract

The API deployment (`.github/workflows/ci-cd.yml`), MCP deployment
(`.github/workflows/deploy-mcp-hostinger.yml`), and staging rollback drill
(`.github/workflows/staging-api-rollback-drill.yml`) use the same code-level
contract merged through PR #84:

1. The active workflows require `HOSTINGER_SSH_KNOWN_HOSTS` containing reviewed
   OpenSSH `known_hosts` content. The helper fails closed when the input is
   missing or invalid. Metadata-only evidence confirms provider/OOB comparison,
   secret-manager update, and live staging use without disclosing the value.
2. `scripts/hostinger-ssh-pinning.sh` validates the supplied target and exact
   SSH host/port pin, rejects malformed input, and writes a restricted
   temporary file under the runner temporary directory.
3. SSH and SCP use `StrictHostKeyChecking=yes`, the generated
   `UserKnownHostsFile`, and `GlobalKnownHostsFile=none`. The workflows check
   the supplied host key before transfer or remote mutation and fail closed on
   a mismatch. They explicitly negotiate `ssh-ed25519` because the endpoint
   otherwise offers a host certificate ahead of the reviewed raw host key.
4. The helper contract is exercised by CI; live API, MCP, and rollback runs
   prove that the strict contract is usable against the reviewed endpoint.

For a provider-approved change, follow the [Hostinger SSH host-key rotation
runbook](../runbooks/hostinger-ssh-key-rotation.md). Future provider/OOB
verification, secret updates, and live validation must be recorded separately
for every identity change.

## Evidence boundary

[PR #84](https://github.com/CarlitoDon/sync-erp/pull/84) merged the trust
contract. API [run #31758446770](https://github.com/CarlitoDon/sync-erp/actions/runs/31758446770)
and MCP [run #31758446761](https://github.com/CarlitoDon/sync-erp/actions/runs/31758446761)
prove strict live staging use. [PR #85](https://github.com/CarlitoDon/sync-erp/pull/85)
repaired atomic current-symlink replacement; API
[run #31760295823](https://github.com/CarlitoDon/sync-erp/actions/runs/31760295823)
and rollback [run #31761990061](https://github.com/CarlitoDon/sync-erp/actions/runs/31761990061)
prove exact release `9e77f4c1…`, no active-release drift, and restored external
health. These runs do not assert production application deployment or rollback.

## Code Coverage / Components
- `.github/workflows/ci-cd.yml`: Holds the runner build/package path for
  `apps/api/dist` -> `deploy/api-mcp/`, Hostinger SSH handling, and Vercel CLI
  execution.
- `docs/ci-cd.md`: Reflects 100% CLI mode.

## Gap Analysis (staging activation; production readiness separate)
- Prisma/runtime dependency placement: The current workflow builds the
  production dependency tree under `deploy/api-mcp/` on the runner and overlays
  the compiled database package before transfer; the remote path does not run a
  workspace install. This documents the code path, not a live deployment proof.
- Vercel deployments: Dropped deploy hooks rate-limit failures by switching natively to prebuilt configurations via token.
- Hostinger SSH host identity: The permissive path was replaced in PR #84 by a fail-closed reviewed-pin helper and strict SSH/SCP options. Provider/OOB comparison, secret update metadata, API/MCP live use, and staging rollback are evidenced above. Production deployment governance and production rollback remain open separately.
