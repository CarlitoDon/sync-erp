# Testing & Engineering Quality Audit

## Scope & method

Audit date: 2026-08-09. Scope was the current checkout of `sync-erp`, branch `fix/ci-use-npx`, using static source/configuration review plus read-only `git` and shell inspection. No product, configuration, lockfile, branch, remote, or generated-artifact changes were intended; no test/build/lint command was executed because those commands can write caches, reports, or build metadata. Dynamic pass/fail rates and measured coverage therefore remain unknown.

I inspected package/workspace scripts, Vitest/Playwright/TypeScript/ESLint configuration, all tracked CI workflows, representative API unit/integration/E2E/invariant tests, web tests and high-risk feature routes, shared/MCP/bot/database packages, and test setup/cleanup patterns. Static inventory counts are file counts; `it`/`test` counts are a heuristic line count, not executed-test counts.

## Current-state map

| Surface | Current evidence | Verification wiring |
|---|---|---|
| API | 190 source `.ts` files; 21 unit, 54 integration, 12 API-E2E, and 3 invariant test files (499 `it`/`test` call lines by static scan). | `apps/api/vitest.config.ts:31-39` includes all four categories. Root `test` delegates to Turbo (`package.json:23`); CI also invokes API integration explicitly (`.github/workflows/ci-cd.yml:101-106`). |
| Web | 244 source `.ts/.tsx` files; 22 Vitest files (179 `it`/`test` call lines) and one Playwright spec (3 calls). | Vitest is configured in `apps/web/vitest.config.ts:17-22`; the browser workflow is separately wired but currently non-gating (F-01). |
| Shared package | 36 source files and 5 test files (21 `it`/`test` call lines). | `vitest.workspace.ts:1` mentions it, but `packages/shared/package.json:31-35` has no `test` script, so it is not part of the root Turbo test task. |
| Bot/MCP/database/ESLint plugin | No first-party test files found outside `node_modules`. MCP has executable smoke/E2E harnesses (`apps/mcp/package.json:9-12`), but they are not test-runner suites. | Bot has lint/typecheck only; MCP has typecheck only; database and ESLint plugin have build/lint or build scripts but no test task. |
| Quality gates | TypeScript project references and strict compiler defaults exist (`tsconfig.json:3-9`, `tsconfig.base.json:10-20`). API and web define local V8 coverage thresholds. | CI runs lint/typecheck/tests/build for the API job and lint/typecheck/build for the web job, but does not invoke either coverage script (`.github/workflows/ci-cd.yml:95-109`, `161-168`). |

## Findings table

| ID | Severity | Confidence | Finding | Primary impact |
|---|---|---|---|---|
| F-01 | P1 | High | Browser E2E is not a reliable CI gate: the invoked script is absent, errors are swallowed, and the Playwright path/server wiring is incorrect. | Green CI can provide no browser-regression signal. |
| F-02 | P1 | High | Database integration/invariant tests lack a runner-level test-database guard and deterministic isolation. | Wrong-DB data changes, collisions, and order/concurrency-dependent results. |
| F-03 | P2 | High | Coverage thresholds exist locally but are not enforced in CI, and 21 API repository files are excluded from coverage. | Regressions can pass without a measurable coverage floor or persistence-layer signal. |
| F-04 | P2 | High | Workspace test topology omits shared tests and has no first-party tests for bot, MCP, database, or the ESLint plugin; `test:all` and `test:invariants` are misleading/stale. | Deployed packages and shared contracts can regress outside the default test gate. |
| F-05 | P2 | High | Web tests are concentrated in auth/company/layout/procurement; accounting, cash-bank, inventory, rental, sales, integrations, and settings have no feature test directory. | High-value UI flows and mutation wiring are largely unverified, compounded by F-01. |
| F-06 | P2 | High | Test source is outside normal lint scope, while API mock selection is path-convention-based and silently swallows mock-import failures. | Test mistakes and false-positive mock behavior can survive quality gates. |
| F-07 | P2 | High | CI runtime and install paths do not match the repository pin: CI uses Node 20 and mixed `npm install`/`npm ci`, while the checkout pins Node 22.12.0 and declares npm 11.6.1. | Local/CI behavior and dependency resolution are less reproducible. |
| F-08 | P2 | High | The external rental storefront cross-repository E2E is intentionally conditional and is not enabled by standard CI. | A partner-facing order/payment/webhook flow is absent from routine verification. |

## Detailed findings

### F-01 — Browser E2E is not a CI gate

**Verified facts.** The root package has no `test:e2e` script (`package.json:12-25`), and neither does `apps/web/package.json` (`apps/web/package.json:6-15`). Nevertheless, `.github/workflows/e2e-playwright.yml:66-68` runs `npm run test:e2e 2>/dev/null || echo ...` and sets `continue-on-error: true`; an unknown-script failure is therefore converted into a successful placeholder step. Even if invoked directly, `apps/web/playwright.config.ts:3-13` points Playwright at `./test/e2e` while the tracked spec is `apps/web/e2e-tests/landing.spec.ts:1-13`. The config also defaults to `http://localhost:4173` but defines no `webServer` (`apps/web/playwright.config.ts:10-13`), and the workflow only builds the apps before the E2E step (`.github/workflows/e2e-playwright.yml:60-68`).

**Impact / inferred risk.** The workflow can pass without discovering or executing the tracked browser spec; after path correction, it would still need a running preview server. This is a verified wiring defect; the resulting false confidence is an inferred risk because no CI run was executed in this audit.

**Recommendation.** Add an explicit web `test:e2e` script, make `testDir` match `e2e-tests`, start `vite preview` through Playwright `webServer` (or a controlled workflow background process), remove stderr suppression and `continue-on-error`, and make the job a required check. Preserve traces/screenshots on failure.

### F-02 — Database tests are destructive and not safely isolated

**Verified facts.** The shared API setup connects the real database for integration/E2E tests and only resets unit mocks (`apps/api/test/setup.ts:12-19`, `22-53`); invariant setup only connects/disconnects (`apps/api/test/invariants/setup.ts:6-12`). There is no database-name/schema allowlist or test-only abort in `apps/api/vitest.config.ts:27-39`. The database client falls back to `.env` when `NODE_ENV` is not `test`, `staging`, or `production`, then uses whatever `DATABASE_URL` is present (`packages/database/src/client.ts:21-50`). Representative suites use stable company IDs and delete rows in `afterAll`, including raw SQL (`apps/api/test/integration/p2p-full-cycle.test.ts:21-34`, `93-122`; `apps/api/test/e2e/upfront-payment-p2p.test.ts:31-32`, `105-130`). The invariant tests scan all invoices/products/journal rows rather than a run-owned fixture set (`apps/api/test/invariants/finance.test.ts:30-45`, `apps/api/test/invariants/inventory.test.ts:4-17`).

**Impact / inferred risk.** A local invocation without the expected environment can load a development `.env` and mutate/delete rows matching test IDs. Fixed IDs and cleanup-at-file-end are vulnerable to concurrent workers, reruns after interrupted cleanup, and cross-file contamination; global invariant scans can observe a database while another suite is mutating it. The collision/concurrency outcome is inferred from the code; the absence of a safety guard is verified.

**Recommendation.** Fail fast unless `NODE_ENV=test` and the parsed database target is an allowlisted disposable database/schema. Allocate a unique schema or database per run, use run-scoped fixture IDs/factories, clean in `afterEach` or transaction rollback where feasible, and either serialize DB suites explicitly or make every suite concurrency-safe. Run invariants as a separate post-suite job against a known snapshot or scope them to owned fixtures.

### F-03 — Coverage is configured but not enforced

**Verified facts.** API coverage declares 80/79/80/80 thresholds but excludes all repository paths (`apps/api/vitest.config.ts:40-62`). A static inventory finds 21 `*.repository.ts` files under `apps/api/src`. Web coverage declares only lines and statements thresholds (`apps/web/vitest.config.ts:23-41`). Both packages expose `test:coverage` scripts (`apps/api/package.json:17`, `apps/web/package.json:14`), but CI invokes ordinary `test` and integration commands, not either coverage script (`.github/workflows/ci-cd.yml:95-106`); the web quality job does not invoke a test command at all (`.github/workflows/ci-cd.yml:161-168`).

**Impact / inferred risk.** The thresholds are a local opt-in signal, not a merge gate. Aggregate API coverage can remain above threshold while repository/persistence behavior is unmeasured. Whether the current percentages pass is unknown because coverage was not run.

**Recommendation.** Add explicit CI jobs or steps for API and web coverage, publish artifacts, and fail on thresholds. Keep exclusions narrowly justified; cover repository behavior through integration/contract tests or report it as a separate required metric. Add branch/function thresholds for web if those dimensions matter.

### F-04 — Workspace test topology omits packages and contains stale commands

**Verified facts.** The root test command is `turbo run test` (`package.json:23-25`), while `packages/shared` defines Vitest discovery but no `test` script (`packages/shared/vitest.config.ts:3-7`, `packages/shared/package.json:31-35`). Static script inspection reports no test script for `apps/bot`, `apps/mcp`, `packages/database`, or `packages/eslint-plugin`. The API `test:all` command runs only unit and integration suites (`apps/api/package.json:13-15`), and `test:invariants` points to a missing `apps/api/test/invariants/vitest.config.ts`; static check result: `MISSING:apps/api/test/invariants/vitest.config.ts`. MCP has smoke/E2E commands, but the deployment workflow only builds it (`apps/mcp/package.json:9-16`, `.github/workflows/deploy-mcp-hostinger.yml:53-54`).

**Impact / inferred risk.** The five shared tests are not part of the root Turbo test task unless run manually. The naming of `test:all` does not include API E2E or invariants, and the dedicated invariant command is broken. Bot runtime behavior, MCP protocol/session/tool behavior, database adapter behavior, and the custom ESLint rule have no first-party test suite. These are verified topology gaps; the severity of any latent defect is an inferred risk.

**Recommendation.** Give every production workspace an explicit `test` task or document it as intentionally build-only. Add a shared-package test script and include it in CI; add protocol-level MCP tests (initialize/list/call/auth/session ownership), bot HTTP/tRPC tests, database client/migration smoke tests, and ESLint rule fixtures. Rename or correct `test:all`, repair/remove the stale invariant script, and add a CI matrix that proves each workspace task is invoked.

### F-05 — High-risk web features have no feature-level tests

**Verified facts.** Static source/test mapping reports: accounting 33 source files/0 feature test files; cash-bank 8/0; inventory 12/0; rental 43/0; sales 14/0; integrations 5/0; settings 10/0. The existing feature tests are limited to auth, company, dashboard onboarding, and one procurement component (`apps/web/test/features/*`). The untested routes lazy-load substantial business pages, e.g. accounting (`apps/web/src/features/accounting/routes.tsx:5-18`), rental (`apps/web/src/features/rental/routes.tsx:5-21`), and inventory (`apps/web/src/features/inventory/routes.tsx:5-16`); cash-bank contains stateful tabs and spend/receive/transfer modals (`apps/web/src/features/cash-bank/index.tsx:15-23`, `100-113`).

**Impact / inferred risk.** Component/layout tests can pass while route registration, form validation, mutation payloads, loading/error states, permissions, and financial UI behavior regress. The missing browser gate in F-01 removes the main compensating control.

**Recommendation.** Prioritize route smoke tests and mutation-focused component tests for accounting, rental, inventory, sales, and cash-bank. Use typed API fixtures/MSW-style boundaries for deterministic error and permission cases, then add one browser journey per critical business flow after the E2E gate is repaired.

### F-06 — Test linting and mock setup are weaker than production checks

**Verified facts.** API, web, and shared lint scripts target only `src` (`apps/api/package.json:11`, `apps/web/package.json:11`, `packages/shared/package.json:35`), so their test trees are outside the normal lint command. The global test override turns off unused-variable checks, disables non-null assertions, disables the hardcoded-enum rule, and downgrades explicit `any` to a warning (`.eslintrc.cjs:90-97`). API mock selection depends on the internal `__vitest_worker__.filepath` containing `/test/unit/`, while the dynamic mock import catches all errors and treats them as an integration-test case (`apps/api/test/setup.ts:12-19`, `23-44`).

**Impact / inferred risk.** Test typos, dead setup, and unsafe casts are less likely to fail a gate. A future Vitest/runtime change or mock import error could silently route a unit test toward real Prisma, creating a false positive/slow or destructive test rather than a clear setup failure.

**Recommendation.** Lint test files with a deliberate but strict test profile; retain no-explicit-any and unused-import enforcement except for narrowly justified fixtures. Replace path introspection with separate Vitest projects/configs for unit versus database suites, and make mock setup failures fail fast with the original error.

### F-07 — CI runtime and dependency installation are not reproducible with the pinned checkout

**Verified facts.** The repository pins Node `22.12.0` in both `.node-version:1` and `.nvmrc:1`, and declares `npm@11.6.1` in `package.json:6`. The main quality jobs use Node 20 and `npm install --legacy-peer-deps` (`.github/workflows/ci-cd.yml:83-90`, `152-159`). The separate E2E and MCP deployment jobs also use Node 20, but use `npm ci` (`.github/workflows/e2e-playwright.yml:43-50`, `.github/workflows/deploy-mcp-hostinger.yml:44-51`).

**Impact / inferred risk.** Node/npm behavior, postinstall output, peer-dependency resolution, and lockfile handling can differ between local work and CI; a green quality result is not necessarily reproducible with the stated development runtime. No dependency-resolution failure was reproduced in this audit.

**Recommendation.** Use the repository Node pin in all workflows, enforce the declared npm version, and standardize on `npm ci` with a committed `.npmrc`/documented peer-dependency policy. Add a small CI diagnostic that prints Node/npm versions and verifies the lockfile is unchanged after install.

### F-08 — External storefront E2E is conditional and absent from routine CI

**Verified facts.** The external rental storefront test is wrapped in `describe.skipIf` unless both sibling workspace files exist and `RUN_EXTERNAL_RENTAL_STOREFRONT_E2E=true` (`apps/api/test/e2e/external-rental-storefront-live-order-flow.test.ts:90-94`, `434-436`). The standard workflows do not set that variable or check out the sibling `external-rental-storefront` workspace. The test covers local proxy/API/bot servers, payment status transitions, and webhook notifications (`apps/api/test/e2e/external-rental-storefront-live-order-flow.test.ts:442-510`, `625-825`).

**Impact / inferred risk.** The partner-facing create/claim/confirm/reject/webhook contract is not exercised in normal CI, even though the API Vitest include pattern discovers the file (`apps/api/vitest.config.ts:31-37`). This is intentional conditional behavior, but it is a material verification gap for a production integration.

**Recommendation.** Add a deterministic in-repository contract fixture for the external API/proxy boundary to the required suite, and run the full cross-repository E2E in a separately provisioned nightly/release workflow with explicit artifacts and failure reporting.

## Strengths

- Backend test breadth is materially better than the package wiring suggests: the API has dedicated unit, integration, API-E2E, and invariant categories covering P2P/O2C, rental, tax, finance, void/reversal, idempotency, optimistic locking, and data isolation.
- The API and web runners use explicit environments, setup files, and V8 coverage configuration; API tests use a real Postgres service in CI (`.github/workflows/ci-cd.yml:65-78`).
- Unit tests use centralized mock reset behavior (`apps/api/test/setup.ts:50-53`), while web tests reset mocked context/toast behavior in representative suites.
- TypeScript project references, strict compiler options, and production builds are present in the normal quality path.
- No unconditional `.skip`, `.todo`, or `.only` was found in the scanned first-party test trees; the identified skip is explicit and conditional (F-08). Playwright also preserves trace/screenshot diagnostics on retry/failure when it is actually run (`apps/web/playwright.config.ts:7-13`).

## Gaps/unknowns

- No current test, lint, build, coverage, or live GitHub Actions result was established in this read-only audit; current pass/fail status and actual percentages are unknown.
- The exact Turbo task graph was not dynamically enumerated because a read-only `turbo run test --dry=json` probe failed at process spawn with `errno -88`; script topology was verified statically instead.
- No flake history, quarantine list, test duration distribution, mutation score, or branch/function coverage report is committed.
- API repository coverage and the real behavior of the custom database/mock setup need runtime verification in a disposable database.
- The tracked `apps/web/playwright-report` is a generated artifact, not evidence that the current workflow executes the current spec.

## Prioritized recommendations

1. **P1 quick win:** Make Playwright executable and required: add the script, correct discovery/server wiring, remove the placeholder fallback, and fail the workflow on test failure.
2. **P1 safety:** Add a hard test-database guard and per-run isolation before expanding integration parallelism or running local destructive suites.
3. **P2 wiring:** Add explicit `test` scripts for shared and all deployed runtime packages; repair `test:invariants` and redefine `test:all` so names match execution.
4. **P2 measurement:** Run API/web coverage in CI, publish reports, enforce thresholds, and separately account for persistence/repository coverage.
5. **P2 risk reduction:** Add feature-level web tests for financial/inventory/rental/sales flows and API HTTP/MCP/bot contract tests; schedule the cross-repository storefront E2E nightly/release-gated.
6. **P2 maintainability:** Lint test trees, make mock setup fail-fast and type-safe, and align every workflow to Node 22.12.0/npm 11.6.1 plus `npm ci`.

## Suggested verification commands

Run only with a disposable Postgres database/schema and the pinned Node/npm versions:

```sh
git status --short --branch
node --version && npm --version
test -e apps/api/test/invariants/vitest.config.ts || echo "missing invariant config"
node -e "const p=require('./package.json'); console.log(p.scripts)"

# Static task and discovery checks after wiring fixes
npm run test --workspace=@sync-erp/shared
npm run test:invariants --workspace=@sync-erp/api
npx playwright test --config apps/web/playwright.config.ts

# Disposable-DB dynamic checks
# Set DISPOSABLE_TEST_DATABASE_URL to an allowlisted throwaway database/schema.
NODE_ENV=test DATABASE_URL="$DISPOSABLE_TEST_DATABASE_URL" npm run db:push --workspace=@sync-erp/database
NODE_ENV=test DATABASE_URL="$DISPOSABLE_TEST_DATABASE_URL" npm run test:integration --workspace=@sync-erp/api
npm run test:coverage --workspace=@sync-erp/api
npm run test:coverage --workspace=@sync-erp/web

# CI parity / lockfile check
npm ci
git diff --exit-code -- package-lock.json
```
