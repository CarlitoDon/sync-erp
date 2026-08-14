# Repository Snapshot and Verification Log

Audit timestamp: 2026-08-09 (Asia/Jakarta)  
Repository: `CarlitoDon/sync-erp`  
Audited checkout: `fix/ci-use-npx` at `70b7a218e71f0bf9904768e261f84b8caf7493ae`

## Scope and evidence policy

This snapshot records the cross-cutting facts used to reconcile the aspect reports. Facts marked **live** came from commands or GitHub API/Actions output during this audit. Facts marked **static** came from the checked-out source. Secrets were classified by key shape and placeholder status without reproducing their values.

## Repository and branch state

| Item | Verified state | Evidence |
|---|---|---|
| Git root | `/Users/wecik/Documents/Offline/Professional/Coding/sync-erp` | **live:** `git rev-parse --show-toplevel` |
| Current checkout | `fix/ci-use-npx`, clean before audit, one commit ahead of its remote tracking ref | **live:** `git status --short --branch`; `git rev-list --left-right --count origin/fix/ci-use-npx...HEAD` |
| Current HEAD | `70b7a21` — `fix(ci): use artifact-local Prisma migrations` | **live:** `git show -s --format=... HEAD` |
| Second worktree | `/private/tmp/sync-erp-codex-ci-prisma`, branch `codex/ci-prisma-artifact-20260809`, clean at `66e9dfe` | **live:** `git worktree list --porcelain`; `git -C ... status --short --branch` |
| Live primary refs | `dev=6684ba7`; `main=3631357`; `fix/ci-use-npx=d10152c` | **live:** `git ls-remote origin refs/heads/...`; GitHub API |
| Local remote-tracking drift | Local `origin/dev=41bd42a` and `origin/main=43f9aca` were stale relative to the live remote | **live:** local refs compared with `git ls-remote`; no fetch was performed |
| GitHub surface | Public repository; default branch `main`; 11 live remote branches; 45 pull requests; no open PRs/issues; no tags/releases/license | **live:** GitHub API and `gh` queries |

The checkout's only unpushed change relative to live `origin/fix/ci-use-npx` replaces the Hostinger migration command with the artifact-local Prisma CLI. It has not yet been validated by a live remote deployment.

## Branch governance and GitHub security controls

- `main` and `dev` are protected, but the only required status context is `check-source-branch`.
- Required approving reviews: `0`; code-owner review, last-push approval, and required conversation resolution are disabled.
- Force-push and deletion are blocked and admin enforcement is enabled.
- Secret scanning, push protection, Dependabot alerts/security updates, and code scanning are disabled or have no analysis.
- Automatic branch deletion after merge is disabled; most historical remote feature/fix branches are already merged but retained.

Evidence: **live** GitHub repository, branch-protection, secret-scanning, Dependabot, code-scanning, branches, pulls, tags, and releases API responses.

## Codebase inventory

| Scope | Tracked files | Approx. tracked lines |
|---|---:|---:|
| API source | 191 | 39,862 |
| API tests | 97 | 27,112 |
| Web source | 245 | 38,624 |
| Web tests | 26 | 3,540 |
| Bot source | 19 | 1,432 |
| MCP source | 30 | 4,891 |
| Database Prisma assets | 20 | 4,824 |
| Shared source | 36 | 5,192 |
| Scripts | 21 | 6,195 |
| Specifications | 316 | 33,769 |
| Documentation | 85 | 12,664 |

Total tracked files: 1,231. The root has no `README.md`. Generated or operational artifacts are tracked, including a Playwright HTML report, `.last-run` files, deployment ZIP archives, a WhatsApp web cache HTML file, and `cookies.txt`.

## Runtime and dependency baseline

- Required checkout runtime: Node `22.12.0` from `.node-version` and `.nvmrc`.
- Runtime used for this audit: Node `22.12.0`; installed npm `10.9.0`.
- Root manifest declares `npm@11.6.1`, while several workflows use Node 20 and mixed `npm install --legacy-peer-deps` / `npm ci` behavior.
- API and bot bundle targets are Node 18; the MCP Dockerfile uses Node 20; one MCP helper script contains an absolute local Node `22.21.1` path.
- `npm audit --json` reported 26 active advisories: 14 high, 11 moderate, 1 low, 0 critical. The same count remained on the production graph check. Important direct/runtime paths include Baileys/link-preview-js, Prisma, React Router, Mermaid, the MCP SDK/Hono, and related transitive packages.

## Secret/configuration exposure

The public Git tree contains environment files for API, bot, web, and database production/staging targets. A value-safe classifier found likely non-placeholder credential material in tracked files, including database URLs, API/bot/webhook secrets, and a Redis URL. `cookies.txt` is also tracked. No secret values are reproduced in this audit.

This is treated as a **P0 containment issue** because the repository is public, the material is in Git history, and repository secret controls are disabled. Required response is rotation/revocation first, then controlled history remediation and prevention. Deleting only the current files would not invalidate exposed credentials or remove history.

## Verification results

| Check | Result | Notes |
|---|---|---|
| TypeScript project typecheck | PASS | `npm run typecheck` |
| API lint | PASS with 2 warnings | `no-console` warnings in `email.service.ts` |
| Web, bot, database, shared lint | PASS | Direct workspace lint commands |
| API/database/shared/MCP builds | PASS | Direct workspace builds |
| Bot build | PASS on isolated rerun | Initial parallel attempt raced a concurrently cleaned/rebuilt shared `dist`; isolated rerun passed |
| Web build + typecheck | PASS with bundle warnings | Main JS chunk about 904 KB; several Mermaid/detail chunks above 500 KB |
| Web unit/component tests | PASS | 22 files, 179 tests |
| API tests, default parallelism | FAIL | 14 failed tests across two webhook-outbox files because both use the same stable company/key fixtures and delete each other's data |
| The two colliding API files, serialized | PASS | 14/14 tests |
| Full API suite, serialized | PASS | 89 files passed, 1 skipped; 493 tests passed, 8 skipped |
| API coverage gate | FAIL | statements 54.18%, branches 46.45%, functions 54.11%, lines 54.53% versus roughly 80% thresholds |
| Web coverage gate | FAIL | statements 8.29%, branches 8.03%, functions 6.12%, lines 8.56% versus 80% line/statement thresholds |
| Dependency audit | FAIL | 26 advisories, including 14 high |

The initial root lint orchestration encountered a transient operating-system child-process spawn error while parallel audit processes were active. Direct workspace lint checks then passed, so this event is not classified as a source-code lint failure.

## Deployment and CI truthfulness

The latest inspected `dev` and `main` CI/CD runs passed quality gates, API/web checks, Vercel deployment, and failed the Hostinger API deployment with:

```text
npm error No workspaces found:
--workspace=@sync-erp/database
```

The separate E2E workflow is a semantic false-green. It runs a nonexistent root `test:e2e` script, redirects stderr, converts failure to a placeholder echo, and sets `continue-on-error: true`. The inspected successful Actions log explicitly printed `No e2e suite configured yet — placeholder`; therefore the green E2E job did **not** prove that Playwright executed. In addition, the Playwright config points to `test/e2e`, while the tracked spec lives under `apps/web/e2e-tests`, and no preview server is configured.

## Verified strengths

- The TypeScript codebase compiles and all production workspaces audited here build.
- API testing is broad and meaningful when run with safe serialization: 493 tests passed.
- Web's existing 179 tests pass.
- `main` and `dev` have baseline protection against direct destructive branch operations.
- Domain specifications and engineering documentation are unusually extensive for the repository size.
- The current unpushed deployment fix is directionally aligned with the verified artifact/workspace failure mode, though it still needs a live canary.

## Immediate release constraints

Until the P0 credential exposure is contained, the deployment pipeline is made truthful, and the Hostinger path is canary-verified, the audit does not consider the repository production-release-ready. A green Vercel job or the current E2E badge is insufficient evidence of end-to-end stability.

