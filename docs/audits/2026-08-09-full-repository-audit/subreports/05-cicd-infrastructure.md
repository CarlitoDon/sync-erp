# CI/CD & Infrastructure Audit

Snapshot: 2026-08-09, repository 'CarlitoDon/sync-erp', local HEAD=70b7a21 ('fix/ci-use-npx'), working tree clean before this report was created and one commit ahead of 'origin/fix/ci-use-npx'. Audit is read-only; secret values are intentionally omitted.

## Scope & method

Inspected the current checkout and read-only GitHub state for:

- '.github/workflows/*', triggers, permissions, concurrency, artifacts, deploy jobs, health checks, migrations and rollback behavior.
- 'vercel.json', 'apps/web/vercel.json', 'apps/mcp/Dockerfile', package/lock metadata and deployment package construction.
- tracked environment files, secret-bearing references, Prisma/Supabase migrations and deployment scripts.
- 'git status/log/branch/remote', 'gh auth status', workflow runs/logs, PR #44, branch protection, rulesets, environments, repository secrets metadata and Actions security settings.

No Hostinger, Vercel or database write was performed. No product code, config, lockfile, branch, remote or generated artifact was changed.

## Current-state map

| Area | Observed design | Operational consequence |
|---|---|---|
| CI/CD | 'ci-cd.yml' runs on PRs to 'main'/'dev', pushes to 'main'/'dev', and manual dispatch. API/Web quality gates run on Node 20; API builds an 'api-mcp-build' artifact. | PR quality and push deployment are separate paths; deployment is not a required merge gate. |
| API Hostinger | Push/manual deployment selects 'main -> production' ('apps/api', port 3002) and otherwise staging ('apps/api-staging', port 3001). It transfers a runner-built tarball, updates the existing '.env', runs Prisma migration, replaces PM2, then checks external API/OAuth endpoints. | Dependencies are not installed remotely, which is good, but the target directory is replaced in place and has no previous-release rollback. |
| Web Vercel | 'deploy_web' deploys only on pushes where the web path filter is true. It runs 'vercel pull/build/deploy', aliases a custom domain, and curls '/'. | The check validates the HTML entrypoint only; two Vercel configs provide conflicting sources of truth. |
| MCP Hostinger | Separate workflow runs on 'main'/'dev' path-filtered pushes or manual dispatch. It builds a compiled tarball, stops PM2 before transfer/extraction, restarts it and requires local '/health' HTTP 200. | A transfer/extraction failure after the stop can leave MCP unavailable; manual dispatch can select production. |
| Database | 16 Prisma migration directories are packaged for production; four separate 'supabase/migrations/*.sql' files exist. CI uses 'prisma db push'; production uses 'prisma migrate deploy'. | Migration files are present, but CI does not exercise the production migration path or explicitly apply the Supabase/RLS authority. |
| Governance/live state | Repository is public. 'gh api' reports only 'check-source-branch' required on both 'main' and 'dev', zero required approvals, no rulesets, and no environment protection rules. Latest observed runs are 2026-07-27; the latest 'main' CI/CD push run failed in API deploy. | A merge can trigger a production push deploy without required quality/deploy checks or human approval. |

## Findings table

| ID | Severity | Confidence | Finding |
|---|---|---|---|
| F-01 | P0 | High | Production-looking credentials are committed in source/env/archive artifacts in a public repository; secret scanning and push protection are disabled. |
| F-02 | P1 | High | Branch/environment gates do not protect release safety: CI/CD/E2E are not required, approvals are zero, and production dispatch is possible. |
| F-03 | P1 | High | Current live API deployment fails because the standalone artifact is invoked as an npm workspace; the local one-line fix has not run remotely. |
| F-04 | P1 | High | Hostinger releases are in-place and non-atomic with no automatic rollback; MCP stops the service before transfer. |
| F-05 | P1 | High | The AI review workflow executes PR-controlled code with an external API secret and 'pull-requests: write'. |
| F-06 | P1 | High | The Playwright check is false-green: root has no 'test:e2e' script and the workflow suppresses failure. |
| F-07 | P1 | High | SSH host identity verification is explicitly disabled for both Hostinger deploy paths. |
| F-08 | P1 | High for the gap; Medium for live drift | Production migrations are not tested as migrations in CI; Prisma and Supabase provide competing migration authorities, including destructive SQL. |
| F-09 | P2 | High | Health checks accept HTTP 200 without asserting readiness/status; API/MCP can report disabled or healthy without DB/protocol validation. |
| F-10 | P1 | Medium | Vite explicitly defines a server secret into the browser bundle if that variable is present in the build environment. |
| F-11 | P2 | Medium | Vercel has conflicting root/nested configs and environment routing; installs are not consistently lockfile-reproducible and Node/npm versions drift. |
| F-12 | P2 | Medium | The Dockerfile is a separate, weaker production path: it installs without a lockfile, runs 'tsx' source via 'npx', and runs as root. |
| F-13 | P2 | High | GitHub Actions allows all actions and does not require SHA pinning; workflows use mutable major tags. |
| F-14 | P2 | High | API change detection outputs are not used to gate API deploy, so every push/manual dispatch can redeploy and re-run migrations. |

## Detailed findings

### F-01 — Committed credentials and disabled repository secret controls

**Severity:** P0. **Confidence:** High.

**Verified facts and evidence:**

- 'check-migrations.js:1-2' contains a literal Supabase PostgreSQL connection string with a non-empty password. The project reference in that URL matches the production reference selected by '.github/workflows/ci-cd.yml:200-206'. The credential value is omitted here.
- Secret-bearing tracked files include 'apps/api/.env.production:5,12,30-42', 'apps/api/.env.staging:5,12,15-20,44,48-49', 'apps/bot/.env.production:10,17-21', 'apps/bot/.env.staging:10,17-21', and 'packages/database/.env.production:2-5' / '.env.staging:2-5'. A sanitized inventory confirmed non-empty values for database URLs, API/bot secrets, webhook secrets, OAuth state/secret fields and seed passwords; exact values were not printed.
- 'deploy/api.zip' and 'deploy/bot.zip' are tracked ('git ls-files'), and each archive contains a '.env' member with non-empty secret-like keys. '.gitignore:68' ignores the ZIPs, but ignores do not remove already-tracked files.
- Read-only GitHub metadata reports 'visibility: public', 'secret_scanning: disabled', 'secret_scanning_push_protection: disabled', 'dependabot_security_updates: disabled', and 'secret_scanning_validity_checks: disabled'.

**Impact:** Anyone with repository/history access may obtain database, service, webhook, OAuth or seed credentials. The production database reference correlation makes this an active-credential risk, not merely a sample-config concern. Archived Git objects and ZIPs remain in scope even after a working-tree deletion.

**Recommendation:** Immediately rotate/revoke the database password and all service/OAuth/webhook/seed credentials found in tracked files and repository secrets. Remove secret-bearing files and historical objects using the repository’s approved secret-removal process, then enable secret scanning, validity checks and push protection. Keep only redacted '.env.example' files; never place '.env' inside deploy archives.

### F-02 — Release gates and environment protections are insufficient

**Severity:** P1. **Confidence:** High.

**Verified facts:**

- 'gh api repos/CarlitoDon/sync-erp/branches/main/protection' and the equivalent 'dev' response show only 'check-source-branch' in 'required_status_checks', 'required_approving_review_count: 0', and no required code-owner review. 'gh api .../rulesets' returns '[]'.
- '.github/workflows/ci-cd.yml:3-8' deploys on pushes to 'main'/'dev'; '.github/workflows/ci-cd.yml:177-184' runs API deployment for any push or manual dispatch. 'deploy_web' is skipped on PRs, while 'deploy_api' is also skipped on PRs; those skipped jobs are not required checks.
- GitHub reports 11 environments, including 'Production', 'staging', and several stale/duplicate names. The 'production' and 'staging' environment API responses have 'protection_rules: []' and 'deployment_branch_policy: null'; repository-level metadata shows 'DATABASE_URL', 'DATABASE_URL_STAGING', Hostinger and Vercel secrets are repository secrets, not the three OAuth secrets listed for the deployment environments.
- '.github/workflows/deploy-mcp-hostinger.yml:11-19,38-39,73-86' exposes a manual 'production' input and maps it to production paths/port. There is no environment approval or branch policy to constrain that input.

**Impact:** A PR can merge without API/Web/E2E or human approval being required, and a push/manual dispatch can reach deployment even when a prior deployment path is failing. Environment naming and repository-level secret scope make staging/production isolation difficult to prove.

**Recommendation:** Require successful API/Web quality gates, real E2E, source validation and at least one appropriate review on protected branches. Restrict production deployment to 'main' or signed release tags, add required reviewers and branch policies to one canonical 'production' environment, and remove stale duplicate environments/secrets. Make manual production dispatch impossible from arbitrary refs or require an explicit approved release SHA.

### F-03 — Live API deployment failure is not yet resolved in the remote state

**Severity:** P1. **Confidence:** High.

**Verified facts:**

- 'gh run view 30257188329' (push to 'main', SHA '3631357...') shows API/Web quality gates succeeded, Web deploy succeeded, and 'Deploy API to Hostinger' failed. The failed log ends with 'npm error No workspaces found: --workspace=@sync-erp/database' and exit code 1.
- The same failure occurred in 'gh run view 30256759708' (push to 'dev', SHA '6684ba7...') and '30255737814' (earlier 'dev' push). The latest observed E2E run was still marked success.
- Local 'HEAD=70b7a21' changes '.github/workflows/ci-cd.yml:437' from 'npm run db:deploy --workspace=@sync-erp/database' to an artifact-local Prisma CLI invocation. The local branch is one commit ahead of origin and no GitHub run for '70b7a21' was observed.

**Impact:** Production/staging deploys are currently proven to fail at the migration step for the remote workflow revision. The local change is plausible but unverified; declaring the incident fixed would be premature.

**Recommendation:** Run the current commit through a disposable staging deployment or an equivalent artifact test that asserts 'node_modules/prisma/build/index.js', 'prisma.config.ts', migrations and the selected database are all present. Then verify a real staging run, external health/OAuth/CORS checks and a production dry-run before promoting. Keep the current branch unpushed as requested.

### F-04 — Hostinger deployment has no atomic release or rollback

**Severity:** P1. **Confidence:** High.

**Verified facts:**

- API deployment deletes the existing target in place at '.github/workflows/ci-cd.yml:346-352', extracts the new archive, mutates the existing '.env' at '404-423', runs migration at '437', deletes PM2 at '453', kills listeners at '461-475', and starts the new process at '492-496'.
- The API comment says a migration failure leaves the old process serving, but the new files and '.env' have already replaced the target before migration. There is no versioned release directory, symlink switch, backup archive or rollback branch in the workflow.
- MCP deliberately kills/stops PM2 before transfer at '.github/workflows/deploy-mcp-hostinger.yml:123-139'; the target is then cleaned/extracted at '167-177' before restart at '211-218'.

**Impact:** A failed SCP, partial extraction, failed start, or post-migration health failure can leave a broken release or a stopped service. A migration failure can leave old code running against a new on-disk tree, making a later restart unsafe. MCP can incur downtime before the new artifact is even available.

**Recommendation:** Use immutable release directories named by commit, verify archive checksum, run migrations through an expand/contract compatibility plan, stage and health-check the new process on an isolated port, then atomically switch a 'current' symlink. Retain the prior release and provide an explicit PM2 rollback. Add tested database backup/restore and migration-failure runbooks.

### F-05 — PR-controlled AI review code receives secrets and write capability

**Severity:** P1. **Confidence:** High.

**Verified facts:**

- '.github/workflows/ai-review.yml:3-5,8-17,19-40' checks out the PR branch on 'pull_request', grants 'pull-requests: write', passes 'NINE_ROUTER_TUNNEL_API_KEY' and 'GITHUB_TOKEN', and runs 'tsx scripts/ai-review.ts' from the checkout.
- 'scripts/ai-review.ts:19' imports 'execSync'; '69-74' executes Git commands; '136-148' sends the external API key; and '239-248' constructs a 'curl' command using the GitHub token to submit a review.

**Impact:** A same-repository PR can alter 'scripts/ai-review.ts' and execute arbitrary code in a privileged workflow, potentially exfiltrating the AI key or using the write-capable token to alter PR review state. 'pull_request' reduces fork secret exposure but does not make same-repository PR code trusted.

**Recommendation:** Run untrusted PR analysis without secrets and with read-only permissions, using a trusted script/action from the base revision. If a comment/review is needed, split it into a separate trusted job that consumes validated, bounded output. Avoid shell interpolation of tokens and do not use a write-capable token in the code-execution job.

### F-06 — Playwright check is a false-green placeholder

**Severity:** P1. **Confidence:** High.

**Verified facts:**

- Root 'package.json:12-37' has no 'test:e2e' script.
- '.github/workflows/e2e-playwright.yml:66-68' runs 'npm run test:e2e 2>/dev/null || echo \"No e2e suite configured yet — placeholder\"' and sets 'continue-on-error: true'.
- 'gh run view 30257188482' / the PR #44 check rollup reports 'Playwright E2E' success despite the missing root script path.

**Impact:** A green E2E check does not demonstrate that Playwright executed. The workflow can hide test failures, and branch protection does not require this check anyway.

**Recommendation:** Add an explicit workspace script such as 'npm run test:e2e --workspace=@sync-erp/web' (or invoke the intended Playwright command), fail when the suite is absent, remove 'continue-on-error', upload traces/screenshots on failure, and require the check before merge.

### F-07 — SSH host identity verification is disabled

**Severity:** P1. **Confidence:** High.

**Verified facts:**

- API deploy uses 'ssh-keyscan ... || true' at '.github/workflows/ci-cd.yml:216-221', then sets 'StrictHostKeyChecking=no' and 'UserKnownHostsFile=/dev/null' at '247-249'.
- MCP deploy repeats the pattern at '.github/workflows/deploy-mcp-hostinger.yml:88-94,113-115'.
- The live failure log shows the resulting “Permanently added ... to the list of known hosts” warnings while the host key is not actually pinned.

**Impact:** A network-level attacker or DNS/host substitution can receive deployment archives and credentials, or execute commands in the SSH session.

**Recommendation:** Store the Hostinger host key/fingerprint as reviewed configuration, build a temporary 'known_hosts' file from that pinned value, require 'StrictHostKeyChecking=yes', and fail closed if the key changes. Remove 'ssh-keyscan || true' and the '/dev/null' host-key options.

### F-08 — Migration path is not exercised and has competing authorities

**Severity:** P1. **Confidence:** High for the gap; Medium for live drift.

**Verified facts:**

- CI setup uses 'npm run db:push --workspace=@sync-erp/database' at '.github/workflows/ci-cd.yml:92-93' and '.github/workflows/e2e-playwright.yml:52-55'; production uses 'migrate deploy' at 'ci-cd.yml:435-437'.
- Prisma owns 16 migration directories under 'packages/database/prisma/migrations', while 'supabase/migrations' has four additional SQL files, including '20260114111531_prisma_init.sql' sharing a timestamp with the Prisma init and RLS files whose comments require 'supabase db push --linked' ('supabase/migrations/20260115_enable_rls.sql:1-3'). No workflow invokes 'supabase db'.
- 'packages/database/prisma/migrations/20260522150000_align_app_schema_drift/migration.sql:21-37' performs a data rewrite followed by dropping/renaming a payment column and dropping an enum type.

**Impact:** 'db push' can make CI pass while migration ordering, drift, locking, backfill duration and production compatibility remain untested. RLS/application of Supabase SQL may be missing or manually applied, and destructive migrations have no automated backup/restore proof.

**Recommendation:** Choose one authoritative migration ledger or explicitly orchestrate both. In a disposable database, run 'migrate deploy' from the exact artifact and assert migration history; in staging, run the same path with production-like data volume. Apply and verify RLS in a controlled step, add expand/contract and backup gates for destructive changes, and record the live migration state without committing credentials.

### F-09 — Health checks are HTTP-status checks, not readiness checks

**Severity:** P2. **Confidence:** High.

**Verified facts:**

- API '/health' is a static JSON response at 'apps/api/src/app.ts:53-55'; it does not query the database, Redis or workers.
- API '/mcp/health' returns HTTP 200 with 'status: \"disabled\"' when MCP is not enabled at 'apps/api/src/modules/mcp/router.ts:22-29'. Standalone MCP similarly returns 'status: \"disabled\"' with 200 at 'apps/mcp/src/index.ts:32-44'.
- API deployment checks only HTTP 200 for '/health' and '/mcp/health' at '.github/workflows/ci-cd.yml:541-580'; MCP deployment checks only local HTTP 200 at 'deploy-mcp-hostinger.yml:221-235'. Web deployment curls only '/' at 'ci-cd.yml:689-697'.

**Impact:** A process can be alive with a bad database/Redis connection, disabled MCP, broken MCP protocol, or broken static/API asset path while deployment is reported healthy.

**Recommendation:** Add explicit liveness/readiness semantics and assert response JSON ('status == ok', dependencies reachable, migrations compatible). Run MCP 'initialize'/tool-list smoke using 'apps/mcp/src/smoke.ts' or a non-mutating protocol check, exercise a safe authenticated API route, and verify critical web assets plus the API rewrite from a browser-like client.

### F-10 — Server API secret is wired into the web bundle

**Severity:** P1. **Confidence:** Medium.

**Verified facts and inference:**

- 'apps/web/vite.config.ts:69-77' defines 'process.env.SYNC_ERP_API_SECRET' using 'JSON.stringify(env.SYNC_ERP_API_SECRET)'. Vite 'define' values are compiled into client code when present.
- The variable is a server credential by naming and use in API code; current committed web env files do not contain it, but Vercel/project/working-directory environment state was not available for confirmation.

**Impact:** If the variable is supplied by Vercel or a local/root env during a web build, the API secret becomes recoverable by every browser user. This is a conditional exposure, not proof that the current deployed bundle contains it.

**Recommendation:** Remove the secret from all browser 'define' entries and from web build inputs. Keep only 'VITE_*' public values in the web environment. Add a clean-build sentinel test that fails if known server-secret names or values appear under 'apps/web/dist'.

### F-11 — Vercel configuration and dependency/runtime reproducibility drift

**Severity:** P2. **Confidence:** Medium.

**Verified facts and inference:**

- Root 'vercel.json:2-15' builds the web from the monorepo, uses 'npm install', and rewrites '/api/trpc/*' to the production API. 'apps/web/vercel.json:2-6' declares a different build command/output and no equivalent API rewrite.
- The staging branch of '.github/workflows/ci-cd.yml:673-677' sets 'VITE_SYNC_ERP_API_URL' to staging, while the root rewrite remains production ('vercel.json:8-10'). Which Vercel project root/config is authoritative is not visible in this checkout.
- The repository declares 'npm@11.6.1' in 'package.json:7', the current developer runtime reports Node 'v22.12.0'/npm '10.9.0', and CI uses Node 20 with 'npm install' in 'ci-cd.yml:89-90,158-159,611-615'. The deploy workflow also installs mutable 'vercel@latest'.

**Impact:** Staging can route a relative API request to production, or a dashboard root setting can select a different config than the workflow expects. 'npm install' and an unpinned CLI reduce reproducibility and can change dependency resolution between releases.

**Recommendation:** Select one Vercel project root/config and make production/staging rewrites explicit and testable. Pin the Node/npm/Vercel CLI versions, prefer 'npm ci' where the root lockfile is authoritative, and record the exact build environment in CI.

### F-12 — Dockerfile is not aligned with the Hostinger production artifact

**Severity:** P2. **Confidence:** Medium.

**Verified facts:**

- 'apps/mcp/Dockerfile:1-7' uses 'node:20-alpine' and 'npm install' without a copied lockfile; '12-18' sets production mode but starts TypeScript source via 'npx tsx src/index.ts' and does not select a non-root user.
- The active Hostinger MCP workflow instead builds compiled output and installs '--omit=dev' dependencies ('deploy-mcp-hostinger.yml:53-70'), then runs 'dist/index.js' ('211-218').

**Impact:** Docker and Hostinger can run materially different code/dependency paths. The Docker image is larger and less reproducible, and 'npx' can resolve/download a package unexpectedly if the image contents change.

**Recommendation:** Either retire the unused Dockerfile or make it the canonical deployment path: copy the root lockfile/workspace metadata, use 'npm ci --omit=dev', build in a multi-stage image, run compiled output as a non-root user, pin the base image digest and retain the healthcheck.

### F-13 — Actions supply-chain controls are weak

**Severity:** P2. **Confidence:** High.

**Verified facts:**

- 'gh api repos/CarlitoDon/sync-erp/actions/permissions' reports 'allowed_actions: all' and 'sha_pinning_required: false'.
- Workflows use mutable tags such as 'actions/checkout@v4', 'actions/setup-node@v4', 'actions/upload-artifact@v4', 'actions/download-artifact@v4' and 'dorny/paths-filter@v3'.

**Impact:** A future tag movement or newly allowed third-party action can alter code executed with deployment credentials.

**Recommendation:** Pin every action to a reviewed commit SHA, restrict allowed actions to an approved list, use Dependabot/Renovate to propose digest updates, and review action permissions as part of release hardening.

### F-14 — API change filter does not gate API deployment

**Severity:** P2. **Confidence:** High.

**Verified facts:**

- 'ci-cd.yml:29-31' publishes 'api' and 'web' filter outputs, and the 'api' filter is defined at '42-50'.
- 'deploy_api' requires 'changes' but its condition at '177-181' checks only push/manual dispatch; it never checks 'needs.changes.outputs.api == true'. 'deploy_web' does check its web output at '588-591'.

**Impact:** Documentation-only, Vercel-only or unrelated pushes to 'main'/'dev' can rebuild, migrate and restart the API. This increases outage/migration risk and makes a failed deploy more likely without delivering an API change.

**Recommendation:** Gate API deployment on the API filter, explicitly include migration/config dependencies in that filter, and make manual dispatch require a reviewed ref/environment. Keep a separate deliberate 'force deploy' input for exceptional cases.

## Strengths

- Workflow-level permissions default to read and individual workflows use 'contents: read'; concurrency serializes deployment per environment and cancels superseded CI runs.
- CI provisions PostgreSQL 16 with a container healthcheck, runs lint/typecheck/unit/integration/build gates, and uploads a runner-built production dependency artifact instead of installing application dependencies on Hostinger.
- API deployment validates required OAuth/auth/database inputs and checks the selected Supabase project reference before migration; it also checks package presence, local health, CORS and external Google OAuth behavior.
- The API path intentionally migrates before stopping the old PM2 process, which limits downtime for migration failures even though the surrounding filesystem operation is not atomic.
- API and MCP have separate staging/production directories, ports and PM2 names; deployment archives exclude '.env', temporary files and logs in the active workflows.

## Gaps/unknowns

- Hostinger PM2 state, current release contents, external DNS/proxy behavior, backups and restore capability were not accessible without expanding scope; no remote commands were run.
- Vercel project root, environment variable values, current aliased deployment and production bundle contents were not independently inspected.
- GitHub secret values and the live database’s '_prisma_migrations'/Supabase migration history were not read. The credential exposure finding is based on committed non-empty literals and secret-bearing files, not on a live credential test.
- Local '70b7a21' has not executed in GitHub Actions; the latest observed remote runs use earlier SHAs. No CI run newer than 2026-07-27 appeared in the read-only query.
- 'actionlint'/'yamllint' are not installed in the current shell; no build/test command was run locally because this audit was read-only and must not mutate generated artifacts.
- Whether 'apps/mcp/Dockerfile' is used by any external deployment is unknown; the checked-in workflow uses the Hostinger tar path.

## Prioritized recommendations

1. **Immediate containment:** rotate/revoke all credentials in 'check-migrations.js', tracked env files, ZIP archives and affected GitHub secrets; remove them from current/history after coordination; enable secret scanning and push protection.
2. **Release governance:** require real API/Web/E2E checks and human review on 'dev'/'main'; add environment reviewers/branch policies; restrict production to 'main'/release refs and eliminate arbitrary-ref production dispatch.
3. **Restore deploy confidence:** verify '70b7a21' in a clean staging run, capture the artifact manifest/checksum, prove Prisma migration success and confirm post-deploy API/OAuth/CORS behavior. Do not treat the local one-line change as fixed until that run succeeds.
4. **Make deploys recoverable:** introduce immutable releases, atomic activation, retained previous artifacts, explicit PM2 rollback, tested database backups and expand/contract migration rules.
5. **Make verification meaningful:** remove the E2E placeholder/failure suppression; add dependency-aware readiness, MCP protocol smoke and browser/API asset checks.
6. **Harden execution:** pin SSH host keys and action SHAs, restrict allowed actions, remove secrets from PR-controlled code and web bundle definitions, and standardize Node/npm/CLI versions with lockfile-based installs.
7. **Reduce configuration ambiguity:** consolidate Vercel configs, choose one migration authority (or an explicit two-step ledger), and align Docker with the actual production artifact path or remove the unused path.

## Suggested verification commands

Run commands that contact production/staging only from an approved, read-only maintenance context; run build commands in a disposable clone because they create generated output.

~~~sh
# Confirm no audit side effects and inspect the exact local-vs-remote CI revision.
git status --short --branch
git diff --check
git diff --stat origin/fix/ci-use-npx...HEAD
git show --stat --oneline 70b7a21

# Inventory sensitive tracked paths without printing values.
git ls-files | rg '(^|/)(\.env($|\.)|deploy/.*\.(zip|tar\.gz)$|check-migrations\.js$)'
git grep -n -I -E 'postgres(ql)?://[^[:space:]]+:[^@[:space:]]+@' -- ':!package-lock.json' \
  | sed -E 's#(postgresql?://[^:]+:)[^@[:space:]]+@#\1<redacted>@g'

# Recheck governance and recent failures through read-only GitHub APIs.
gh api repos/CarlitoDon/sync-erp/branches/main/protection
gh api repos/CarlitoDon/sync-erp/branches/dev/protection
gh api repos/CarlitoDon/sync-erp/environments
gh run list --branch main --limit 20 --json databaseId,workflowName,status,conclusion,headSha,createdAt,url
gh run view <run-id> --json jobs,headSha,conclusion,url
gh run view <run-id> --log-failed

# In a clean clone, validate the standalone artifact assumptions without a deploy.
npm ci
npm run build:api
# Inspect the produced artifact and verify the exact entrypoint used by the workflow.
test -f deploy/api-mcp/node_modules/prisma/build/index.js
test -f deploy/api-mcp/prisma.config.ts
test -d deploy/api-mcp/prisma/migrations

# In an approved disposable database, test the production migration path.
DATABASE_URL='<staging-url>' NODE_ENV=staging \
  node deploy/api-mcp/node_modules/prisma/build/index.js migrate deploy \
  --config deploy/api-mcp/prisma.config.ts

# Static workflow/security checks in a clean tooling environment.
actionlint .github/workflows/*.yml
gh api repos/CarlitoDon/sync-erp/actions/permissions

# Hostinger read-only post-deploy verification with pre-approved SSH host key.
ssh -o StrictHostKeyChecking=yes -o UserKnownHostsFile=<pinned-known-hosts> <user>@<host> \
  'pm2 status && curl -fsS http://127.0.0.1:<port>/health'
curl -fsS https://<api-host>/health
curl -fsS https://<api-host>/mcp/health
~~~
