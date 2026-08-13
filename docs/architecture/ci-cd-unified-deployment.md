# Unified Deployment CI/CD (Hostinger + Vercel)

Current source review/update: 2026-08-13. Dated audit findings and run
references below are snapshots; this document describes the checked-in design
and does not assert provider activation or production closure.

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
contract in the CICD-003 branch:

1. The active workflows declare `HOSTINGER_SSH_KNOWN_HOSTS` as a required
   design/input contract containing reviewed OpenSSH `known_hosts` content. The
   helper fails closed when the input is missing or invalid. This repository
   does not prove that the secret is configured, that its value is
   provider-approved, or that it was used in a live connection; until those
   provider/OOB and live-deployment gates exist, this reference remains
   design/required-input only.
2. `scripts/hostinger-ssh-pinning.sh` validates the supplied target and exact
   SSH host/port pin, rejects malformed input, and writes a restricted
   temporary file under the runner temporary directory.
3. SSH and SCP use `StrictHostKeyChecking=yes`, the generated
   `UserKnownHostsFile`, and `GlobalKnownHostsFile=none`. The workflows check
   the supplied host key before transfer or remote mutation and fail closed on
   a mismatch.
4. The helper contract is exercised by the CI test wired into the API quality
   job. This proves the repository behavior, not the current secret value or
   provider identity.

For a provider-approved change, follow the [Hostinger SSH host-key rotation
runbook](../runbooks/hostinger-ssh-key-rotation.md). Provider/OOB verification,
secret update, live SSH, deployment, rollback, and production closure must be
recorded separately.

## Evidence boundary

[PR #84](https://github.com/CarlitoDon/sync-erp/pull/84) is the code-remediation
review for this contract. The [CI/CD run #31693634711](https://github.com/CarlitoDon/sync-erp/actions/runs/31693634711)
and [Playwright E2E run #31693634657](https://github.com/CarlitoDon/sync-erp/actions/runs/31693634657)
passed for the pull request; the Hostinger deploy job was skipped. These are
repository/CI checks and do not assert production deployment or rollback.

## Code Coverage / Components
- `.github/workflows/ci-cd.yml`: Holds the runner build/package path for
  `apps/api/dist` -> `deploy/api-mcp/`, Hostinger SSH handling, and Vercel CLI
  execution.
- `docs/ci-cd.md`: Reflects 100% CLI mode.

## Gap Analysis (code-level remediation; operational closure pending)
- Prisma/runtime dependency placement: The current workflow builds the
  production dependency tree under `deploy/api-mcp/` on the runner and overlays
  the compiled database package before transfer; the remote path does not run a
  workspace install. This documents the code path, not a live deployment proof.
- Vercel deployments: Dropped deploy hooks rate-limit failures by switching natively to prebuilt configurations via token.
- Hostinger SSH host identity: The permissive `ssh-keyscan`/disabled-checking path is replaced in PR #84 by a fail-closed reviewed-pin helper and strict SSH/SCP options. The required-input reference is a code-level design contract only; the provider-approved pin, configured secret, live connection, deployment, and rollback are not proven by this documentation or the PR CI run.
