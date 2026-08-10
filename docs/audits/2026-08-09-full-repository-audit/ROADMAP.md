# Remediation and Product Engineering Roadmap

Status date: 2026-08-10. This roadmap is dependency-ordered. Time ranges are planning horizons, not promises; owners must size work after containment and environment access are established.

## Checklist legend and current state

- `[x]` — completed with code/test and, where applicable, published-commit evidence.
- `[ ]` — still open. The subsection identifies whether it is partially evidenced, awaiting external authority, or not started.
- “Local code gate complete” does not mean “production incident closed.” Production closure still requires credential rotation/revocation, old-credential denial, access-log review, staging/production smoke, cleanup, and approved history remediation.

The current branch is `chore/unfinished-scope-consolidation` at `HEAD 86e208793961f38a27cb71315b1fe67674d26a7c` (upstream `origin/chore/unfinished-scope-consolidation` aligned), based exactly on base ref `origin/dev` at `c8a10022222705100d0c129255eb50827ffba91d`. It carries the five effective commits sourced from ref `origin/codex/phase0-security-containment` at `fede05b5aa9b96c0e79a9f63fc58926a371dc735`; the exact source and consolidated commit IDs plus the still-open landing disposition are recorded below. This branch is not yet merged into `dev`. This consolidation added no new sensitive path; existing tracked findings covering env files, cookie artifacts, deployment archives, and audit files remain unresolved. Current-tree `security:artifact-preflight` remains **BLOCKED** with 23 findings and `CONTENT_READ:NONE`. Remaining audit-package files stay untracked and are intentionally outside this change. No credential values, environment contents, cookie contents, or archive payloads are recorded here.

Checklist baseline before the consolidation-scope additions remains 20 checked, 73 open, and 93 actual checklist items (legend examples excluded). The current code-level snapshot, including the three scope/disposition items below, is 23 checked, 73 open, and 96 actual checklist items. These three checked statuses record code-level completion or disposition only; PR landing/remote merge and operational production gates remain separate.

## Unfinished effective scopes retained for the next PR

- [x] **Phase 0 security/roadmap code scope:** The five-commit Phase 0 code scope is consolidated and its focused gates passed; this checkbox records code-level completion only. Source ref `origin/codex/phase0-security-containment` at `fede05b5aa9b96c0e79a9f63fc58926a371dc735` maps, in chronological order, `70b7a218e71ce14e9730f8a69d27090bffd45015` → `4493a161526775587d92512c6700c073084c94a0`, `222f79fbecf7b32ef6c50965fb30d94195beeea5` → `114e19a45c9f9d5074ad11097de4c3fa55e3a3f9`, `88f250c6bd86662a0e20496d680c0189806058bb` → `3250291e3bfde05c5cd90d63c4b0432523988053`, `ba153c1af5b1c18461bf7d4cbf78d2cda693e128` → `59a9544d11492162c89dd4ef4a94b9b7914ee625`, and `fede05b5aa9b96c0e79a9f63fc58926a371dc735` → `31069107600a893fe028c3e129f7b37c657deb11`. PR landing/remote merge into `dev` and operational production gates remain separate.
- [x] **Canonical Prisma artifact fix:** The canonical source `fix/ci-use-npx@70b7a218e71ce14e9730f8a69d27090bffd45015` and consolidated commit `4493a161526775587d92512c6700c073084c94a0` are selected; the artifact command is `node node_modules/prisma/build/index.js migrate deploy --config prisma.config.ts`. Duplicate/intermediate alternatives `f0f89f63edf8e3248c78d98e6d2cc56afaa2879a` → `66e9dfedbd241b351c026c0a7140d3ee40829ba0` are superseded and must not be included. Disposable DB, canary, and rollback evidence remain separate.
- [x] **`fix/ci-cd-indentation-v3` disposition:** The branch at `8c434b6214c6f87daad27b66ed5bae9736f1ae6b` / PR #39 is superseded by patch-equivalent `69bb8e8005435c62a4f4803b6fe01e89c9628348`, already represented in the current base ref `origin/dev` at `c8a10022222705100d0c129255eb50827ffba91d`. This is a code-level disposition only: deploy/health proof remains separate, and the old branch remains pending cleanup until after the consolidation PR merges.

**Evidence note (code-level only):** Focused gates passed — API 272/272, bot 18/18, web 5/5, webhook integration 23/23, and artifact-preflight unit 14/14; Prisma validate, typecheck, root lint 10/10, and root build 8/8 also passed after `npm ci` repaired ignored Turbo. Current-tree `security:artifact-preflight` remains **BLOCKED** with 23 findings and `CONTENT_READ:NONE`. PR landing/remote merge, credential rotation/revocation, deployment/health/smoke, disposable DB/canary/rollback, and other operational production gates remain open; no production or credential/deploy readiness is claimed.

### Completed

- [x] Phase 0 tenant admission, catalog mutation containment, browser-secret removal, bot QR protection, generated Zod repair, and local security regression coverage — published in `222f79f`.
- [x] RBAC deny-by-default, API-key authority checks, same-company role management, last-owner atomicity, and HTTP/runtime admission evidence — published in `222f79f`.
- [x] SSRF-safe webhook transport applied to tenant/rental delivery, retry, replay, and inline production paths — published in `222f79f`.
- [x] Truthful Playwright discovery/preview-server gate and generated-artifact hygiene — published in `222f79f`.
- [x] Bot order URL preview suppression on both HTTP and tRPC send-order paths, including the Baileys resolver regression guard — published in `ba153c1`.
- [x] Metadata-only credential-remediation preflight validator and the Phase 0 containment runbook — published in `88f250c`.

### In progress / partially evidenced

- [ ] Local security controls have strong focused evidence, but production deployment/runtime evidence, full migration evidence, and external incident evidence are not yet attached.
- [ ] Some database tests are safe only when pointed at the proven disposable test database; default parallel isolation, full migration/restore evidence, and production-role evidence remain open.
- [ ] The webhook transport is unified, but rental outbox ownership, stale-claim recovery, and the canonical producer/consumer implementation remain unresolved.
- [ ] API negative coverage now includes tenant, RBAC, HTTP admission, role atomicity, rental, bot QR, and SSRF paths; Redis outage, idempotency, public capability, and broader financial-concurrency matrices remain open.

### Blocked pending external authority

- [ ] Credential rotation/revocation, old-credential denial, provider access-log review, and the incident G0–G3 sign-offs.
- [ ] Staging/production deployment and smoke evidence, including database/Redis/API/MCP/bot/OAuth/webhook checks.
- [ ] Current-tree and provider-artifact cleanup, GitHub history remediation, and the written approvals required by the runbook.
- [ ] GitHub secret scanning, push protection, Dependabot/code scanning, branch protections, required reviews/checks, production environment approvals, and provider-side deployment/SSH controls.

### Not started

- [ ] Remaining release-truth, database-authority, recovery, architecture, accessibility, product-readiness, and operational-maturity work listed below.

## North-star outcome

The application should be releasable through a truthful, recoverable pipeline; enforce tenant and privilege boundaries at one unavoidable layer; preserve financial/inventory invariants under concurrency; and give product owners objective launch evidence rather than green-but-skipped checks.

## Phase 0 — Contain active exposure (0–72 hours)

**Goal:** remove immediate compromise/write paths before normal feature delivery continues.

### Completed

- [x] Disable or authenticate `rentalBundle.syncFromExternalCatalog`; derive tenant identity from a signed/API-key principal, bound writes to that tenant, and add emergency negative tests. Evidence: published in `222f79f`.
- [x] Remove `SYNC_ERP_API_SECRET` from browser build inputs and scan emitted browser artifacts for server-secret identifiers. Evidence: published in `222f79f`; local artifact scan passed.
- [x] Remove/authenticate the public bot pairing QR and keep `/health` separate from QR-bearing status. Evidence: published in `222f79f`.
- [x] Restrict tenant/rental webhook delivery through the shared SSRF-safe transport, including DNS/address validation, redirect rejection, limits, and retry classification. Evidence: published in `222f79f`.
- [x] Disable server-side link previews for bot order URLs on HTTP and tRPC send-order paths. Evidence: published in `ba153c1`.
- [x] Add a metadata-only preflight blocker for tracked sensitive paths, archive member names, dirty worktrees, and history-rewrite eligibility. Evidence: published in `88f250c`.
- [x] Document the G0–G5 credential-containment sequence, evidence rules, cleanup order, and history-rewrite approval requirements. Evidence: published in `88f250c`.

### In progress / partially evidenced

- [ ] Start a credential incident inventory covering tracked env files, scripts, cookie artifacts, deployment archives, Git history, GitHub secrets, Hostinger, Vercel, Supabase/Postgres, Redis, OAuth, webhook, bot, and seed credentials. The repository now has a value-free inventory/runbook and a fail-closed validator, but named owners, exposure-window sign-off, and provider evidence are absent.
- [ ] Complete the clean-artifact portion of the exit criteria. The emitted web bundle scan is clean for server-secret identifiers, but tracked env/cookie/archive paths still block a production-artifact declaration.

### Blocked pending external authority

- [ ] Rotate/revoke credentials first; verify old values fail and review access/audit logs. Do not rely on deleting current files.
- [ ] Restrict production deployment/manual dispatch while Hostinger and branch gates are unsafe; pin SSH host identity before the next credential-bearing transfer.
- [ ] Enable secret scanning/push protection or an equivalent blocking scanner; freeze history rewrite until all consumers have rotated and an operator plan is approved.

### Not started

- [ ] Freeze destructive customer financial scripts against production until explicit dry-run/apply, exact-company/environment, rollback, and owner-approval gates exist.

- [ ] **Phase 0 exit criteria:** Every exposed value has an owner and rotation proof; old credentials fail; unauthenticated catalog mutation returns 401/403; clean web/API artifacts contain no secrets; and production deploy requires an explicitly approved ref/environment. Local code controls are complete, but the incident/production criteria are not.

## Phase 1 — Restore release truth and recoverability (days 3–14)

**Goal:** a green pipeline must mean the tested artifact is deployable and recoverable.

### Completed

- [x] Repair Playwright discovery, add a real script and controlled preview server, fail on zero tests/failure, retain traces, and remove generated report/result files from the tracked path. Evidence: published in `222f79f`.
- [x] Add a deterministic API release-artifact contract: CI writes an exact-SHA `release.json`, validates the real packaged artifact before upload and after download, and tests the validator with a disposable fixture. This proves artifact shape and commit metadata only; staging canary, database migration, health/readiness, and rollback evidence remain open.
- [x] Expose release identity through API `/health` and MCP `/health` as `release.commit` and `release.version`, with explicit `unknown` fallbacks when `release.json` is absent; deployment health checks compare the expected `GITHUB_SHA` on local and external API responses and local MCP responses. This proves the code/workflow contract only; staging canary, migration compatibility, readiness dependencies, and rollback evidence remain open.
- [x] Add a tested API Hostinger rollback transaction: capture the previous release/PM2 metadata, stage a SHA-named release, keep the previous app active through forward-only migration, restore the previous PM2 release after local startup/health/identity failure, and fail closed without a previous release. Live staging/production rollback drills remain open.

### In progress / partially evidenced

- [ ] Validate local commit `70b7a21` through a disposable artifact test and staging canary; artifact, deployment, version, and health evidence now exists, but live rollback and fresh disposable migration reconciliation remain open. Evidence: [PR #53](https://github.com/CarlitoDon/sync-erp/pull/53) merged as `27f8fb85d66be21928310f2d9b85d3c233697524`; [CI/CD run #31359645256](https://github.com/CarlitoDon/sync-erp/actions/runs/31359645256), [Deploy API job #93367320281](https://github.com/CarlitoDon/sync-erp/actions/runs/31359645256/job/93367320281), artifact SHA-256 `49b21c717334b45636cbb8ae9cbc3aa2d4a153e376b85e27013179a29879539f`, 16 migrations with no pending migrations, PM2 `sync-erp-api-staging` online on port `3001`, and local/external release identity `27f8fb85d66be21928310f2d9b85d3c233697524` / `0.0.1`.
- [ ] Require API/web lint, typecheck, tests, builds, truthful E2E, and security gates on `dev`/`main`; local gates exist, but required-check and review enforcement is not configured.
- [ ] Reconcile Prisma migration authority and reproduce `migrate deploy` against a fresh empty database and a production-like snapshot; the staging upgrade path reported 16 migrations and no pending migrations in run `31359645256`, but the disposable fresh path still fails on the stale `20250505160000_generalize_webhook_outbox` dependency order, and applied-ledger/forward-only approval evidence remains incomplete.

### Blocked pending external authority

- [ ] Replace in-place Hostinger deployment with immutable SHA releases, checksum validation, isolated-port readiness, atomic switch, retained previous release, and explicit PM2 rollback; the staging canary exercised the SHA release/retention path and kept previous release `31e9cc5163281608861a6314fe8d8fab105167b4`. A staging-only failure-injection/rollback workflow and deterministic contract tests are now implemented in `.github/workflows/staging-api-rollback-drill.yml` and `scripts/hostinger-api-release.test.sh`; live rollback evidence remains open until that manual workflow succeeds.
- [ ] Establish liveness versus readiness and prove database/migration compatibility, required dependencies, and the non-mutating MCP `initialize`/tool-list handshake in staging and production.
- [ ] Protect the canonical production environment with reviewers and branch/ref policy; make the required checks fail on deliberately broken changes.

### Not started

- [ ] Split PR AI analysis from trusted publishing: no secret/write token in PR-controlled execution, bounded diff data, and a trusted-base publisher. This is the open `CICD-002` finding.
- [ ] Align Node/npm and `npm ci` across CI, Docker, local policy, and release artifacts; pin action/CLI versions and action SHAs.

- [ ] **Phase 1 exit criteria:** Fresh and upgrade migrations pass; staging deploy and rollback drill pass; all required checks fail when deliberately broken; real Playwright specs execute; and the exact release SHA plus health/readiness are observable.

## Phase 2 — Close tenant, privilege, and data-integrity boundaries (weeks 2–6)

**Goal:** cross-tenant/privileged failure requires defeating more than one control.

### Completed

- [x] Make tRPC context fail closed when membership is absent; separate session membership from API-key tenancy and derive company from the authenticated principal. Evidence: published in `222f79f`.
- [x] Introduce deny-by-default permission middleware for admin, role management, API keys, integrations, billing/replay-sensitive surfaces, and last-owner/self-escalation invariants. Evidence: published in `222f79f`.
- [x] Fix direct IDOR/cross-company paths for PO/SO quantities, rental bundles, and caller-supplied entity IDs with company predicates and ownership checks. Evidence: published in `222f79f`.
- [x] Apply a shared SSRF-safe transport across webhook test/outbox, tenant delivery, rental delivery, retry, replay, and inline paths. Evidence: published in `222f79f`.
- [x] Remove the bot order-link preview network path while retaining the URL as literal message text. Evidence: published in `ba153c1`.

### In progress / partially evidenced

- [ ] Unify rental outbox ownership so enqueue, processor, retries, replay, signatures, and startup use one implementation. Delivery transport is unified, but the older/newer outbox implementation split and stale `PROCESSING` recovery remain open.
- [ ] Harden SSRF/egress, Redis rate-limit failure behavior, idempotency fencing/scope, public order-token minimization/expiry, checkout escaping/capabilities, and raw HTTP error classification. Webhook and order-preview SSRF controls are complete; the generic bot send-message preview path, rate-limit fail-open, and public order-token exposure remain unchecked.

### Blocked pending external authority

- [ ] Decide whether RLS is authoritative defense-in-depth; inventory tenant-owned tables, use transaction-local context on the exact Prisma transaction client, add `WITH CHECK` policies, verify deployed role behavior, and test REST/tRPC/workers/raw queries with two tenants.

### Not started

- [ ] Make audit writes transaction-aware; atomically couple order status/invoice effects; replace `count+1` fulfillment numbering; serialize or atomically update weighted-average cost; and add database constraints for the highest-value invariants.
- [ ] Add explicit allowlisted DTOs/capabilities for broad PO/SO updates, checkout, attachment/upload handling, and all remaining caller-supplied entity references.

- [ ] **Phase 2 exit criteria:** Adversarial two-user/two-company matrices pass for every router category; non-admin matrices pass; fresh schema has reviewed constraints/policies; two-session concurrency and fault-injection tests prove correct outcomes; and one outbox owner is observable.

## Phase 3 — Make quality gates representative (weeks 4–10)

**Goal:** testing effort follows business/security risk rather than file count.

### In progress / partially evidenced

- [ ] Add an allowlisted disposable-test-database guard and per-run schema/fixture isolation. Safe local integration runs exist, but default file-parallel isolation and repeated full-run evidence remain open.
- [ ] Add API negative matrices for tenant, RBAC, SSRF, Redis outage, idempotency, and public capability paths. Tenant/RBAC/SSRF coverage is present; Redis outage, idempotency, and public-capability coverage remain open.
- [ ] Add migration, restore, protocol, webhook producer/consumer, and external storefront contract tests. Webhook/transport regression coverage exists; migration, restore, protocol, and storefront evidence remains open.

### Not started

- [ ] Wire shared tests into Turbo/CI; give bot, MCP, database, and ESLint plugin explicit unit/contract/smoke tasks; repair `test:invariants` and define what `test:all` means.
- [ ] Establish a coverage baseline and ratchet; publish reports and include repositories/persistence metrics rather than treating current thresholds as achieved.
- [ ] Add web smoke journeys for login → company → dashboard and one critical accounting/procurement/rental transaction, plus tenant-switch, admin denial, Mermaid payload, upload limits, mobile, axe, and keyboard tests.
- [ ] Lint test trees and replace path-introspection/mock-error swallowing with explicit Vitest projects.

- [ ] **Phase 3 exit criteria:** The default test command is deterministic across repeated runs; every deployable workspace has an intentional gate; coverage trends upward with no critical uncovered boundary; and zero-test workflows fail by design.

## Phase 4 — Reduce architectural and frontend debt (months 2–4)

**Goal:** make changes local, contracts stable, and UI safe/usable.

### In progress / partially evidenced

- [ ] Remove duplicate/stale deploy schemas and make generated client/schema freshness a failing artifact check. The generated Zod patch is durable and published in `222f79f`; schema/deploy-source convergence is not complete.

### Not started

- [ ] Enforce an allowed import matrix; move router orchestration into application services/controllers, route construction through one composition root, and expose cross-domain ports/facades/events.
- [ ] Split pure transport contracts/domain values from Prisma/database-generated types; stop web/bot imports from `apps/api/src`; choose and document canonical REST/tRPC support and add parity tests where both remain supported.
- [ ] Resolve Tenant versus Company terminology and update ADR-0001 for the intended Santi connector exception or extract connector registration from core.
- [ ] Replace or harden no-fix vulnerable dependencies; adopt required dependency scanning with owned exceptions and expiry dates.
- [ ] Rebuild shared web primitives for label association, keyboard semantics, dialog focus, and accessible errors; scope/clear cache by user/company and add safe async/error states plus a 404 route.
- [ ] Harden Mermaid, uploads/object storage, security headers, Sentry Replay masking, responsive high-column tables, and browser privacy.
- [ ] Split public/app bundles and heavy chart dependencies; define bundle budgets and monitor real-user Web Vitals.

- [ ] **Phase 4 exit criteria:** The dependency-boundary checker passes; no app imports another app's source; shared contracts are persistence-free; critical WCAG checks pass; and initial-bundle budget plus Web Vitals SLO are visible and gated.

## Phase 5 — Product and operations maturity (months 3–6)

**Goal:** turn extensive specifications into a maintainable, supportable SaaS operating model.

### Blocked pending external authority

- [ ] Implement encrypted backup retention, RPO/RTO ownership, alerting, and recurring restore drills with tenant/accounting/inventory integrity checks.
- [ ] Complete target-environment launch evidence for legal identity/review, billing provider flows, email delivery/domain, monitoring/alerts, support, export, and production operations.
- [ ] Establish production release ownership, CODEOWNERS, dependency/branch retention, vulnerability SLA, incident response, and deprecation policies through approved repository/provider settings.

### Not started

- [ ] Create one authoritative root README/operator index and a requirements-to-route/test/release traceability map; label stale task/spec documents and reconcile ADRs with implementation.
- [ ] Define supported personas, workflows, integrations, environments, data retention/privacy, and support/SLA boundaries; separate implemented, beta, planned, and historical capabilities.
- [ ] Establish SLOs for API latency/error rate, background outbox age/dead letters, webhook delivery, database saturation, Redis degradation, deploy failure/rollback, and critical business invariants.
- [ ] Generate OpenAPI and in-app examples from enforced schemas; publish one versioned webhook event/signature/retry catalog and label legacy compatibility explicitly.
- [ ] Reconcile onboarding and rental Draft scope into a pilot contract with requirement-to-test-to-environment evidence; remove legal placeholders and verify billing/email/support/export commitments before public launch.
- [ ] Reassess modular-monolith hotspots using observed change coupling and performance; extract only bounded capabilities with stable contracts and operational ownership.

- [ ] **Phase 5 exit criteria:** The launch checklist is evidence-backed; SLO dashboards and alerts have owners; restore and incident drills are current; docs identify current behavior unambiguously; and releases are tagged and reproducible.

## Success metrics

These are target signals, not production sign-off. They remain unchecked until the evidence is objective and environment-appropriate.

- [ ] Exposed credentials — 0 active exposed values; scanner blocks recurrence.
- [ ] Tenant/RBAC negative tests — all critical router categories and two-tenant runtime paths covered and passing.
- [ ] Deployment — staging/production canary and rollback drill pass for the exact SHA.
- [ ] Browser E2E — non-zero critical journeys execute; the check is required and failure-sensitive on protected branches. Local execution is complete, branch enforcement is not.
- [ ] API tests — repeated default runs pass with safe database isolation.
- [ ] Coverage — published risk-based baseline and ratchet, with critical boundaries covered.
- [ ] Dependencies — no unaccepted exploitable high findings; exceptions are owned and expiring.
- [ ] Recovery — restore drill meets approved RPO/RTO and integrity checks.
- [ ] Web performance — enforced budgets and production Web Vitals SLO.
- [ ] Accessibility — critical flows pass keyboard and automated axe checks.

## Sequencing constraints

- [ ] Rotate credentials before history rewriting or normalizing secret files.
- [ ] Reconcile migration history before relying on the Hostinger command fix.
- [ ] Establish safe database isolation before increasing test parallelism or making coverage required.
- [x] Fix API authorization before treating frontend route guards as security. Evidence: tenant admission/RBAC controls published in `222f79f`.
- [ ] Choose outbox and migration authorities before deleting apparently duplicate implementations/files.
- [ ] Make deploy rollback and backup recovery real before destructive schema tightening.

## Release gate

No production release should be called stable until at least `SEC-001`, `API-001`, `API-002`, `REL-001`, `QLT-001`, `GOV-001`, and the safety portion of `TST-001` have objective closure evidence. A merge commit, Vercel success, or green placeholder E2E job is not closure evidence.

## References

- [Consolidated risk register](./RISK-REGISTER.md)
- [Full repository audit](./FULL-REPOSITORY-AUDIT.md)
- [Phase 0 credential-containment runbook](../../runbooks/phase0-credential-containment.md)
- Published remediation commits: `222f79f`, `88f250c`, `ba153c1`.
