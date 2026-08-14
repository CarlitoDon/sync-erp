# Full Repository Audit — Sync ERP

Audit date: 2026-08-09  
Repository: `CarlitoDon/sync-erp` (public)  
Audited checkout: `fix/ci-use-npx` at `70b7a21`  
Method: main-agent runtime verification plus parallel aspect audits using `gpt-5.6-luna` at maximum reasoning effort; all subreports were read and high-severity claims were reconciled before inclusion.

## Executive verdict

**Sync ERP is not stable end-to-end and is not production-release-ready in its audited state.** The codebase has a credible modular-monolith foundation, broad ERP domain coverage, strict TypeScript, 493 API tests that pass under safe serialization, 179 passing web tests, and successful builds across audited workspaces. Those strengths are outweighed by three immediate P0 conditions and a cluster of release-blocking P1 controls:

1. likely real credentials and cookie/deployment artifacts are present in a public Git repository/history;
2. an unauthenticated tRPC procedure accepts arbitrary `companyId` and mutates rental catalog data;
3. authenticated tRPC admission does not reject a selected company for which the user has no membership; direct arbitrary-company/user and quantity lookups confirm cross-tenant read paths, while RBAC is not consistently enforced;
4. the tracked migration chain is not credible for a fresh database, and the deployed migration ledger/recovery posture is unknown;
5. Hostinger API deployments are proven failing, rollback is non-atomic, and the local fix is unpushed/unverified;
6. the green Playwright job is a false-green placeholder and executes zero browser tests;
7. protected branches do not require the meaningful quality/deploy checks or approvals;
8. tenant/RLS, transactional, concurrency, backup/restore, dependency, and accessibility controls remain materially incomplete.

The practical maturity assessment is **approximately 3.5/10 for production readiness**. This is an engineering judgment, not a generated metric: implementation breadth is ahead of operational/security assurance.

## What changed from the earlier Carlito verdict

Carlito's branch heads and Hostinger failure diagnosis were substantially correct for the remote runs it inspected. Its phrase **“E2E Playwright: success” was not valid evidence of E2E stability**. The GitHub job concluded `success`, but its log explicitly printed `No e2e suite configured yet — placeholder`; the workflow runs a nonexistent script, suppresses stderr, converts failure to success, and allows errors. Local Playwright discovery also found zero tests because its configured directory differs from the tracked spec location.

Therefore the accurate statement is: **the E2E workflow status was green, but no Playwright E2E execution was proven.**

## Scope and confidence

The audit covered:

- 1,231 tracked files across API, web, bot, MCP, database/shared packages, scripts, deployment assets, docs, and 316 specification files;
- current worktree, second worktree, local branches, live remote refs, all live remote branches, pull requests/issues, protections, Actions, tags/releases, and repository security settings;
- architecture/domain boundaries, API security/contracts/business behavior, frontend UX/security/performance, Prisma/migrations/tenancy/concurrency, CI/CD/infrastructure, tests/coverage, dependencies, runtime/version drift, documentation/product readiness, and operational integrations;
- static evidence and targeted runtime checks. No production/staging/database mutation, push, merge, credential test, secret printout, or destructive Git operation was performed.

High-confidence means the source or live system directly proves the condition. Medium-confidence findings depend on deployment configuration, runtime role, traffic, or exploit details not available read-only.

## Production readiness scorecard

| Dimension | Assessment | Evidence-led interpretation |
|---|---:|---|
| Security / secrets | 1/10 | Public tracked credentials/artifacts, public tenant mutation, weak RBAC/admission, SSRF, scanners disabled |
| Tenant/data isolation | 3/10 | Many company predicates and tests exist, but global admission, direct IDOR paths, scalar cross-tenant references, and RLS wiring are incomplete |
| Database correctness/recovery | 3/10 | Strong schema breadth and some transactions, but migration ordering, concurrency, atomicity, constraints, and restore evidence are blocking |
| CI/CD/release safety | 2/10 | Quality jobs run, but E2E is false-green, Hostinger fails, gates are optional, SSH identity/rollback are unsafe |
| Test quality | 5/10 | Broad API suite and passing web unit tests; unsafe DB isolation, unwired packages, failing coverage, and no real browser gate |
| Architecture/maintainability | 6/10 | Real modular decomposition/facades/DI intent; boundaries are convention-only and contracts are coupled to API/Prisma source |
| Frontend quality | 5/10 | Feature routing and tests are solid foundations; a11y primitives, tenant cache, Mermaid, bundle size, and critical feature coverage need work |
| Operations/observability | 3/10 | Sentry/correlation/outboxes/health endpoints exist; readiness, restore, SLOs, rollback, protocol checks, and privacy posture are unproven |

## Immediate stop-ship findings

### P0-1 — Public credential exposure

Tracked production/staging env files, a literal database URL in a script, deployment ZIPs containing env members, and `cookies.txt` exist in a public repository/history. A value-safe scan identified likely non-placeholder database/API/bot/webhook/Redis material. Secret scanning, push protection, validity checks, Dependabot security controls, and code scanning are disabled or absent.

**Action:** rotate/revoke first, verify old values fail, inspect access logs, then coordinate current-tree/history removal and prevention. Never print or reuse values from Git.

### P0-2 — Unauthenticated tenant catalog mutation

`rentalBundle.syncFromExternalCatalog` is a `publicProcedure`, accepts `companyId` from the caller, and can upsert bundles, delete/recreate components, and create products/items. Related protected bundle methods also trust input tenant IDs instead of context in places.

**Action:** disable or authenticate the mutation immediately; use a signed/API-key integration principal, derive company from the principal, tenant-bind every write, bound batch size, transact, audit, and add unauthenticated/cross-tenant tests.

### P0-3 — Authenticated cross-tenant admission/read paths

The main tRPC mount copies caller-supplied `X-Company-Id` into context. Membership lookup does not reject a missing membership, and `protectedProcedure` checks only that user/company IDs are present. Direct procedures accept arbitrary company/user/order UUIDs without a complete tenant predicate, so this is more than a theoretical missing-defense issue.

**Action:** make context fail closed, derive allowed company from membership, separate API-key tenancy, patch direct IDORs, and require a two-user/two-company read/write matrix before release.

## P1 release blockers

### Privilege enforcement

Admin/replay/API-key/integration/role-management surfaces frequently use the base protected procedure without enforceable permission policy. Broad PO/SO update paths also lack adequate input constraints. The tenant-admission failure itself is elevated to P0 above.

**Required closure:** reject absent membership, derive tenant from the authenticated principal, deny missing roles by default, introduce a tested permission matrix, and complete two-user/two-company negative tests across every router family.

### Migration integrity and recovery

A `202505...generalize_webhook_outbox` Prisma migration sorts before the 2026 init yet alters/references objects created later. CI uses `db push`, while production uses `migrate deploy`; Supabase has a second SQL/RLS history that CI does not apply. No live `_prisma_migrations`/role/policy evidence was available. Backup policy, RPO/RTO, restore tooling, and a completed restore drill are not evidenced.

**Required closure:** inspect every environment ledger, establish one explicit migration authority/baseline, pass fresh-empty and production-snapshot upgrades, then prove encrypted backup and restore integrity against a staging drill.

### Hostinger deployment and branch governance

Inspected `dev` and `main` runs fail Hostinger migration with `No workspaces found: --workspace=@sync-erp/database`. Local `70b7a21` uses an artifact-local Prisma CLI and is directionally plausible, but remains one unpushed commit without a remote canary. Deployment replaces files in place; MCP stops before transfer; no atomic release/automatic rollback exists. SSH host checking is disabled.

Protected branches require only `check-source-branch`, zero approvals, no code-owner/recent-push approval, and no required conversation resolution. Meaningful CI/E2E checks can fail or skip without blocking merge.

**Required closure:** canary exact artifact/commit, reconcile migrations first, pin SSH host identity, use immutable releases and atomic activation/rollback, and require truthful CI/security/E2E plus review on protected branches.

### CI privilege and E2E truth

The AI review workflow executes PR-controlled source with an external API key and a write-capable pull-request token. The E2E workflow hides a missing script and zero tests. Actions allow mutable tags and do not require SHA pinning.

**Required closure:** separate untrusted analysis from trusted publishing, remove secrets/write capability from PR-controlled execution, pin/restrict actions, and make zero-test or failed Playwright runs fail a required check.

### Database correctness and tenant enforcement

RLS migration coverage is 19 of 61 Prisma models; exported context setters have no application call site and are unsafe across pooled operations unless tied to the exact transaction. Scalar foreign keys and unchecked IDs do not enforce same-company ownership. Audit writes escape business transactions; sales confirmation can commit before invoice creation; fulfillment numbers use `count + 1`; weighted-average cost lacks row serialization.

**Required closure:** choose and enforce the tenant boundary, patch direct leaks first, add transaction-local RLS or explicit centralized scoping, propagate transaction clients, add constraints, and pass adversarial/concurrency/fault-injection tests.

### Runtime dependency exposure

`npm audit` reports 26 advisories (14 high, 11 moderate, 1 low) even on the production graph check. Direct/runtime paths include Baileys/link-preview-js SSRF with no published fix, Prisma, React Router, Mermaid, MCP SDK/Hono, and transitive dependencies. Automated dependency security controls are disabled.

**Required closure:** perform reachability/exploit triage, replace the no-fix dependency or isolate its behavior, upgrade fixable paths, enforce a required scanner, and give every exception an owner and expiry.

## Architecture and domain assessment

### Strengths

- The API is a recognizable modular monolith with 17 domain modules, dedicated accounting/rental depth, facades, a composition root, and explicit integration transports.
- Strict TypeScript and project references provide useful compile-time control; all audited app/package typechecks passed.
- Core API/shared tests cover P2P/O2C, finance, rental, inventory, idempotency, optimistic locking, and invariants.
- Many schema models use company-scoped indexes/uniques; strict auth middleware exists even though tRPC does not use it.

### Debt

- Route/controller/service/repository layering is a convention, not an enforced dependency graph; routers and services directly orchestrate Prisma and multiple domains.
- Web and bot import API source/router types; shared exports Prisma-derived types and generated schemas. Apps cannot evolve independently around stable contracts.
- Rental outbox ownership is split: current enqueue/admin paths use the newer implementation while startup runs the older processor on the same table. A second newer poller function exists but is not called in the audited startup. This is producer/consumer semantic drift, not proof that both pollers run concurrently.
- ADR/glossary language says `Tenant` and generic core, while persistence/runtime uses `Company` and the Santi connector is hard-wired into the registry.

**Direction:** retain the modular monolith, enforce an allowed-import matrix, separate pure contracts/domain/database packages, centralize construction, and extract services only after stable boundaries and operational ownership exist.

## Backend/API assessment

Beyond the P0/P1 tenant and privilege findings:

- rate limiting fails open on Redis errors and public identity can depend on forwarding-header assumptions;
- webhook testing can fetch arbitrary URLs, creating SSRF/egress risk;
- bot `/status` can expose the live WhatsApp pairing QR without authentication, while global CORS is enabled;
- generic PO/SO update records are cast to Prisma update input rather than explicit allowlisted DTOs;
- billing checkout interpolates tenant data into HTML and has CSRF/capability/expiry inconsistencies;
- public order tokens expose broader PII/location/payment metadata than a minimal tracking capability should;
- idempotency scope/fencing can collide across actors/operations and late workers;
- HTTP error detection can misclassify application/domain errors as Prisma errors;
- attachment handling decodes base64 before enforcing decoded limits, and local storage needs an explicit durability/multi-instance design.

Positive patterns include strict raw `/api/v1` API-key/permission handling, HMAC signatures, random hashed API keys, transaction/locking intent, CSRF/correlation/Sentry, and graceful worker shutdown.

## Database/Prisma assessment

The 61-model schema covers a serious ERP domain and validates successfully under Prisma. The remaining risk is not schema syntax but operational integrity:

- fresh migration ordering and dual Prisma/Supabase authority;
- missing same-company composite relationships and high-value checks;
- direct cross-tenant quantity reads and unchecked referenced IDs;
- inconsistent transaction clients and non-atomic side effects;
- race-prone fulfillment numbering/weighted-average valuation;
- no database checks for several one-of/positive/uniqueness invariants;
- canonical schema versus tracked deploy schema drift and conditional generated-client assembly;
- seeds that use fresh bcrypt hashes as upsert keys and can install fallback/default credentials;
- no proven restore capability.

Database work must be sequenced: ledger/recovery evidence first, direct tenant leaks second, then constraints/concurrency changes under tested rollback.

## Frontend/web assessment

The React/Vite SPA has sensible feature folders, route lazy-loading, cookie credentials, CSRF headers, reusable primitives, and passing unit/component tests. High-risk gaps are:

- no server-enforced admin authorization (frontend hiding cannot fix this);
- Mermaid loose mode + HTML labels + raw SVG injection;
- a build path that can embed a server API secret;
- global query cache not keyed/cleared by user and company;
- zero discovered Playwright tests and no truthful browser gate;
- shared Input/Select/Dialog/Confirm primitives without reliable label, keyboard, ARIA, Escape, focus-trap/restore behavior;
- weak 404/loading/error/retry consistency and raw backend message display;
- whole-file base64 uploads without early client bounds;
- mobile overflow on high-column transaction screens;
- production build warnings around several >500 KB chunks and a main chunk around 904 KB;
- security headers and Sentry Replay privacy controls not provable from the repository.

Fix server authorization first, then tenant cache and XSS/build-secret paths, shared accessibility primitives, browser journeys, uploads, and performance budgets.

## Test and quality assessment

### Measured results

- Typecheck: pass.
- Direct API/web/bot/database/shared lint: pass; two API `no-console` warnings.
- API/database/shared/MCP/bot builds: pass; web build/typecheck pass with large-chunk warnings.
- Web tests: 22 files / 179 tests pass.
- API default run: 14 failures caused by two webhook-outbox test files sharing stable company/key fixtures and deleting each other's rows.
- Those two files serialized: 14/14 pass.
- Full API serialized: 89 files pass, 1 skipped; 493 tests pass, 8 skipped.
- API coverage: about 54% statements/lines, below configured ~80% thresholds.
- Web coverage: about 8% statements/lines, below configured 80% thresholds.

### Interpretation

The API has meaningful behavioral breadth, but the default runner is nondeterministic and lacks a hard disposable-database allowlist. Coverage settings are currently aspirational because CI does not invoke them. Shared tests are not wired into root Turbo, bot/MCP/database/ESLint plugin lack ordinary first-party suites, invariant command wiring is stale, and the cross-repository storefront E2E is conditional.

Use a baseline-and-ratchet model rather than instantly lowering or pretending to meet 80%. First enforce test database safety, fix isolation, wire every production workspace, and cover the security/tenant/financial boundaries identified here.

## Bot, MCP, integrations, and operational scripts

The bot and integration estate contains several independently release-significant paths:

- bot `/status` returns the live Baileys pairing QR without authentication; public CORS increases reachability if the port is exposed;
- bot/API/Redis env files and deploy archives are tracked, and WhatsApp auth state is serialized in Redis without an evidenced isolation/retention policy;
- ordinary company members can create/rotate/configure integration keys with high-value permissions because lifecycle routers inherit weak base authorization;
- webhook test/outbox and bot link-preview paths accept arbitrary URLs without a shared SSRF/egress policy;
- customer ledger correction/finalization scripts execute deletes and multi-step mutations/uploads without a global default-dry-run, exact-company/environment confirmation, or end-to-end rollback;
- standalone Streamable HTTP MCP and legacy API SSE MCP coexist with process-local sessions, divergent auth/runtime paths, weak body/rate bounds, and mutation retry ambiguity;
- outbox atomic claim/backoff/HMAC/idempotency are useful foundations, but stale `PROCESSING` recovery, endpoint ownership, and competing rental implementations are not coherent;
- customer/WhatsApp-derived evidence and generated reports lack a repository-evidenced encryption/retention/deletion/redaction lifecycle;
- bot has no first-party test task; MCP smoke/E2E mutates business data and does not prove safe cleanup/readiness.

Immediate containment is QR removal/authentication, credential rotation, integration-admin enforcement, egress restriction, and freezing destructive customer-data scripts for production until their safety wrapper and owner approval exist. Medium-term direction is one canonical MCP transport, explicit session topology, contract tests, a single outbox authority, reproducible compiled artifacts, and privacy-governed evidence storage.

## Repository and branch state

At audit time:

- current branch `fix/ci-use-npx` was one commit ahead of live `origin/fix/ci-use-npx`;
- live refs were `dev=6684ba7`, `main=3631357`, `fix/ci-use-npx=d10152c`;
- local cached `origin/dev` and `origin/main` refs were stale, demonstrating why live remote comparison matters;
- a second clean worktree held `codex/ci-prisma-artifact-20260809` at `66e9dfe`;
- GitHub had 11 live remote branches, 45 total PRs, no open PRs/issues, no tags/releases/license;
- most retained feature/fix branches were merged; automatic deletion after merge was disabled.
- the checkout also contains recovery state—45 `refs/original/*` backup refs, a stash, Codex diff refs, and unreachable objects—which was intentionally preserved pending an owner-approved retention/cleanup decision;
- no root CODEOWNERS, SECURITY, CONTRIBUTING, issue/PR templates, or license was found, and only bot-comment reviews were visible in the recent inspected PR range.

No branch, remote ref, protection, PR, or worktree was changed by this audit.

## Product, documentation, and specification readiness

The repository contains a real, broad ERP implementation and unusually rich design material, but the documents themselves support only a **controlled pilot after containment and release-truth repair**, not unattended public scale.

The most consequential product/documentation gaps are:

- in-app API order/payment examples are incompatible with the Zod schemas enforced by the live REST routes;
- webhook names, signatures, headers, retry/replay ownership, generic tenant events, and legacy Santi events are described inconsistently;
- auth, onboarding, billing, and broad rental features exist in source, but their task/spec status and target-environment acceptance evidence do not match;
- legal pages retain company identity placeholders and explicitly warn that review is required;
- go-live checklists leave billing provider behavior, production email/domain, backup/restore, monitoring, support, exports, and deployment evidence open;
- onboarding lacks dedicated proof for concurrent/repeated submission, audit, idempotency, and full registration-to-active resume;
- Draft rental scope includes auto-cancel, agreements, condition evidence, customer risk, and reports beyond the accepted/tested route surface;
- there is no root README or canonical docs/spec index; historical/duplicated Santi analyses, stale commands/paths, and checkbox-only progress are mixed with current contracts;
- “marketplace”/generic integration language is broader than a runtime registry that still registers only Santi and grants hardcoded rental permissions.

The recommended product posture is narrow and explicit: after P0 closure, support a 3–10-business pilot on one documented P2P and/or rental golden path with direct support, target-environment evidence, known limitations, and restore/incident ownership. Public launch waits for legal, billing/email, recovery, truthful CI/deployment, and requirement-to-test-to-release traceability.

## Consolidated technical-debt map

| Debt class | Representative items | Priority |
|---|---|---|
| Security incident debt | tracked credentials/history, public mutation, cross-tenant admission/IDOR, bot pairing QR, browser secret path, PR workflow secret, SSH host checking | P0–P1 |
| Authorization/tenancy | optional membership, RBAC gaps, IDOR/scalar references, partial/unwired RLS, cache isolation | P1 |
| Release engineering | failing Hostinger, false-green E2E, weak required checks, non-atomic deploy, weak readiness | P1 |
| Data correctness | migration order/authority, transaction leakage, numbering/cost races, destructive operational scripts, missing constraints, seed idempotency | P1–P2 |
| Quality system | DB test isolation, coverage not gated, unwired package tests, conditional E2E, test lint/mocks | P1–P2 |
| Architecture | app-to-app source imports, Prisma-coupled shared package, DI bypass, unenforced boundaries, vocabulary drift | P2 |
| Frontend UX | accessibility primitives, async/error states, responsive tables, upload bounds, performance budgets | P1–P2 |
| Product/contract truth | stale API examples, conflicting webhook contracts, onboarding/rental scope, open legal/billing/email/launch gates | P1–P2 |
| Documentation | no canonical root/docs/spec index, Draft/unchecked/historical mixes, stale paths/examples, weak operator/user guides | P2–P3 |
| Operations | dependency advisories, backup/restore, MCP/session drift, outbox recovery, customer-data lifecycle, SLOs, Sentry privacy, branch/release hygiene | P1–P3 |
| Repository hygiene | tracked generated artifacts/ZIP/cache/cookies, duplicate schemas/configs, missing root README | P2–P3 |

## Recommended execution order

1. **0–72 hours:** credential incident containment, disable/authenticate public catalog mutation, remove browser secret path, restrict production deploy.
2. **Days 3–14:** truthful E2E and required gates; migration-ledger/fresh-upgrade proof; staging canary of exact artifact; immutable deploy/rollback; secure PR/SSH/action execution.
3. **Weeks 2–6:** fail-closed membership/RBAC; direct tenant leaks; RLS decision; one outbox owner; transactional/concurrency fixes; backup/restore drill.
4. **Weeks 4–10:** safe deterministic DB tests; every workspace wired; coverage ratchet; API security matrices and real browser journeys.
5. **Months 2–4:** enforce architecture/contracts; frontend accessibility/security/performance; dependency and artifact hardening.
6. **Months 3–6:** documentation/product traceability, SLOs/alerts, releases/ownership/governance, recurring recovery drills.

Full deliverables and acceptance criteria are in [ROADMAP.md](ROADMAP.md) and [RISK-REGISTER.md](RISK-REGISTER.md).

## Verification limitations

- Credential activity was not tested; public non-placeholder material is treated as compromised until rotated.
- No live database catalog, role, RLS policy state, migration ledger, provider backup, Hostinger PM2, or Vercel build environment was mutated/inspected with privileged credentials.
- Local `70b7a21` was not pushed, so it has no GitHub Actions/deployment proof.
- Some risks require a disposable two-tenant environment, two concurrent database sessions, browser runtime, or controlled egress target for final exploit/closure proof.
- Generated build/test outputs were not committed; the only intended changes are this audit package.

## Report index

- [Repository snapshot and runtime verification](00-repository-snapshot.md)
- [Architecture and domain](subreports/01-architecture-domain.md)
- [Backend API](subreports/02-backend-api.md)
- [Frontend web](subreports/03-frontend-web.md)
- [Database and Prisma](subreports/04-database-prisma.md)
- [CI/CD and infrastructure](subreports/05-cicd-infrastructure.md)
- [Testing and quality](subreports/06-testing-quality.md)
- [Security, dependencies, and observability](subreports/07-security-dependencies-observability.md)
- [Product, docs, and specifications](subreports/08-product-docs-specs.md)
- [Git branches and governance](subreports/09-git-branches-governance.md)
- [Bot, MCP, integrations, and scripts](subreports/10-bot-mcp-integrations-scripts.md)
- [Consolidated risk register](RISK-REGISTER.md)
- [Phased remediation roadmap](ROADMAP.md)
