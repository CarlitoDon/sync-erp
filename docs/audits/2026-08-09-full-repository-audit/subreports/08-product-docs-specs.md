# Product, Documentation, and Specification Audit

**Audit date:** 2026-08-09 (Asia/Jakarta)  
**Repository:** `CarlitoDon/sync-erp`  
**Audited checkout:** `fix/ci-use-npx` at `70b7a218e71f0bf9904768e261f84b8caf7493ae`  
**Scope:** product readiness and the complete documentation/specification estate.  
**Write scope respected:** only this subreport was created; no product code, configuration, lockfile, branch, remote, generated artifact, or other audit report was changed.

## Executive verdict

Sync ERP has a substantial and coherent ERP core: multi-company context, procurement-to-pay, sales, inventory, accounting, rental operations, integrations, authentication/email verification, onboarding, billing foundations, a web application, a bot, and MCP. The repository also has unusually broad product and engineering material: the snapshot counts 316 specification files and 85 documentation files, alongside 191 API source files, 245 web source files, 97 API test files, and 26 web test files (`docs/audits/2026-08-09-full-repository-audit/00-repository-snapshot.md:35-51`).

That breadth does not yet translate into a defensible public-launch claim. The strongest verified conclusion is:

> **The product is a credible controlled-pilot candidate only after containment and release-truth repairs. It is not public-production-ready, and the documentation cannot currently serve as a single reliable product contract.**

The repository snapshot records TypeScript/build success, 493 serialized API tests passing, and 179 web tests passing, but also records 26 dependency advisories, coverage well below configured thresholds, a failing Hostinger deployment, and an E2E workflow that is semantically false-green (`00-repository-snapshot.md:67-96`). The product documents themselves agree with a constrained conclusion: the go-to-market document says “ready for controlled pilot selling, not unmonitored public scale” and requires direct support, monitored errors, legal baseline, backup/export, and a production deployment (`docs/go-to-market-readiness.md:1-21`).

## Evidence convention

- **Verified fact** means directly observed in the checked-out files, a bounded command result, or the existing audit snapshot.
- **Inference** means a product or release conclusion derived from multiple verified facts.
- **Unknown** means the repository does not prove the claim; it must be verified in staging/production or by the responsible owner.
- Priorities follow the audit convention: **P0** immediate containment/blocker, **P1** release-blocking or next-sprint mandatory, **P2** planned remediation, **P3** hygiene/optimization.

## Current-state product map

| Product surface | Verified implementation | Documentation/spec truth | Readiness judgment |
|---|---|---|---|
| Account registration and activation | REST/tRPC auth exposes register, login, resend, and verify-email with public rate limits (`apps/api/src/trpc/routers/auth.router.ts:58-194`); the service hashes verification tokens, invalidates older tokens, blocks unverified login, and creates a session after verification (`apps/api/src/modules/auth/auth.service.ts:72-140`, `:206-356`); web routes exist at `/register` and `/verify-email` (`apps/web/src/app/AppRouter.tsx:57-65`). | Spec 044 marks code-level auth work complete but leaves production email environment, target migration, sender-domain verification, and staging smoke test open (`specs/044-registration-hardening/tasks.md:9-28`, `:50-53`). | **Foundation present; operational activation not evidenced.** |
| Company bootstrap/onboarding | Prisma has onboarding status/step fields (`packages/database/prisma/schema.prisma:20-27`, `:75-89`); API onboarding procedures exist (`apps/api/src/trpc/routers/onboarding.router.ts:97-201`, `:203-332`, `:335-568`); the web has `/onboarding` and a global protected-route redirect (`apps/web/src/app/AppRouter.tsx:78-87`, `apps/web/src/features/auth/components/ProtectedRoute.tsx:39-52`). | The onboarding spec is explicitly Draft and its baseline says the state machine, hard gates, and locked sidebar were previously absent (`docs/spec/onboarding-spec.md:1-8`, `:26-41`). Its task file still leaves every implementation and QA task unchecked (`docs/spec/onboarding-tasks.md:11-63`). | **Partially implemented; completion and retry safety are not release-evidenced.** |
| Core ERP | Web routes cover company, procurement, sales, inventory, accounting, cash/bank, admin observability, settings, and integrations (`apps/web/src/app/AppRouter.tsx:89-114`; route files under `apps/web/src/features/*/routes.tsx`). The documented P2P golden path covers PO → GRN → bill → payment (`docs/flows/procure-to-pay-p2p.md:1-214`). | Apple-like roadmap defines a focused MVP around “barang masuk → barang keluar → uang tercatat” (`docs/apple-like-development/ROADMAP.md:40-101`), while several active specs remain Draft or have open verification tasks. | **Broad functional surface; product scope and acceptance boundaries need consolidation.** |
| Rental operations | Web exposes items, bundles, orders, order detail, returns, overdue, settings, and scheduler (`apps/web/src/features/rental/routes.tsx:1-88`); API routes include item/order/availability/return/policy capabilities (the corresponding router is `apps/api/src/trpc/routers/rental.router.ts`). | Rental spec 043 remains Draft (`specs/043-rental-business/spec.md:1-6`) and defines additional grace-period auto-cancel, agreements, unit assignment/condition evidence, customer risk, and reports (`specs/043-rental-business/spec.md:196-290`). Open task output includes lifecycle tests, seed/runbook work, scheduled auto-cancel, PDF agreement, reports, and risk UI. | **Core rental flow exists; “full rental product” is not complete or contractually accepted.** |
| External integration API | REST is mounted under `/api/v1` and tRPC under `/api/trpc/integration/v1` (`apps/api/src/app.ts:67-81`); REST routes and tRPC procedures are listed in `docs/integration-api-v1.md:21-47`. Shared Zod schemas are the actual input boundary (`apps/api/src/modules/rental/rental-integration.schemas.ts:3-66`, `:96-113`). | The repository has generic integration docs, an idempotency contract, and a Santi case-study layer (`docs/integration-api-v1.md:1-60`, `docs/integrations/webhook-idempotency-contract.md:1-31`, `docs/case-studies/README.md:1-5`). | **Useful foundation, but public examples and event contracts disagree with runtime schemas.** |
| Billing and entitlements | Billing HTTP routes include manual checkout/sandbox and webhook processing (`apps/api/src/modules/billing/billing-http.router.ts:50-104`, `:264-348`); billing migrations are present under `packages/database/prisma/migrations/20260522130000_add_billing_tables` and `20260522140000_default_company_subscription_free`. | Go-to-market billing upgrade checks are all open (`docs/go-to-market-readiness.md:63-93`); the SaaS go-live checklist keeps billing in P0 and leaves provider, checkout, webhook, plan enforcement, and upgrade/downgrade evidence unchecked (`docs/saas-go-live-checklist.md:7-45`). | **Code foundation, not proven commercial operation.** |
| User/operator trust surface | `/privacy` and `/terms` are routed (`apps/web/src/app/AppRouter.tsx:57-65`); Sentry wiring is documented as code-integrated but live verification deferred (`docs/sentry-mvp-readiness.md:1-25`). | Legal page still contains company identity placeholders and explicitly requires review before production (`apps/web/src/features/legal/pages/LegalPage.tsx:11-19`, `:275-279`). Backup, restore, support, monitoring, and legal launch evidence remain open in the SaaS checklist (`docs/saas-go-live-checklist.md:47-147`). | **Not launch-ready for unattended public use.** |

## Strong verified strengths

1. **The implementation is materially real, not only a design repository.** The code compiles/builds and the serialized API suite and web tests pass according to the snapshot (`00-repository-snapshot.md:67-80`). The API has meaningful integration/e2e test coverage across P2P, finance, rental, CSRF, idempotency, and webhooks, even though the default parallel runner is unsafe (`00-repository-snapshot.md:77-82`).
2. **The product philosophy is internally legible.** The Apple-like roadmap binds the team to core-flow depth, defaults, explicit ownership, and postponing advanced features (`docs/apple-like-development/ROADMAP.md:7-15`). The goals and guardrails prioritize domain correctness, idempotency, auditability, and failure handling (`docs/apple-like-development/GOALS.md:8-24`; `docs/apple-like-development/GUARDRAILS.md:33-81`).
3. **The genericization direction has made real progress.** Current integration catalog entries are `custom-storefront`, `rockhouse`, and `pos-lite` (`apps/api/src/services/integration.service.ts:20-54`); external order creation uses generic API-key/API provenance (`apps/api/src/modules/rental/rental-external-order.service.ts:883-888`); external catalog sync is named generically (`apps/api/src/modules/rental/rental-bundle.service.ts:161-183`). This is newer truth than the older CTO report.
4. **Auth hardening aligns closely with its PRD.** Production log-provider fallback is blocked, failed delivery compensates the created user, older verification tokens are invalidated, and auth events are recorded (`apps/api/src/modules/common/services/email.service.ts:63-115`; `apps/api/src/modules/auth/auth.service.ts:98-132`, `:180-203`; `specs/044-registration-hardening/tasks.md:20-28`).
5. **The repository has a plausible pilot narrative.** The go-to-market document explicitly limits the current position to a supported pilot of 3–10 businesses and lists concrete launch prerequisites instead of claiming unrestricted scale (`docs/go-to-market-readiness.md:3-14`).

## Priority findings

### P0 — Immediate blockers

#### P0-01 — Public credential/cookie exposure invalidates ordinary launch claims

**Confidence:** High.  
**Verified evidence:** The existing snapshot found likely real credential material in tracked environment files and a tracked `cookies.txt`, classified it as P0 because the repository is public and the values exist in Git history (`docs/audits/2026-08-09-full-repository-audit/00-repository-snapshot.md:61-65`). The consolidated register specifies rotation/revocation, history remediation, and secret-scanning/push-protection acceptance (`docs/audits/2026-08-09-full-repository-audit/RISK-REGISTER.md:7-10`).

**Impact:** A product readiness report cannot treat the current checkout as safe for pilot or public deployment until exposed credentials are invalidated. Removing only current files would not invalidate historical values.

**Recommendation:** Treat security containment as the first release gate, owned jointly by security/platform/application owners. Do not reproduce any values in issue comments or documentation.

**Acceptance criteria:** Every exposed value is inventoried; old values fail after rotation/revocation; history remediation is performed under an approved procedure; runtime secrets are moved to an approved secret store; a blocking secret scanner is enabled; a post-rotation smoke test proves the intended integrations still work.

#### P0-02 — Public catalog synchronization accepts caller-supplied tenant identity

**Confidence:** High.  
**Verified evidence:** `syncFromExternalCatalog` is a `publicProcedure` and accepts `companyId` from input (`apps/api/src/trpc/routers/rental-bundle.router.ts:95-129`); the service then uses that input company ID for billing checks, bundle upserts, product creation, rental-item creation, and component writes (`apps/api/src/modules/rental/rental-bundle.service.ts:177-201`, `:219-258`). The consolidated register classifies this as a verified P0 cross-tenant write risk (`docs/audits/2026-08-09-full-repository-audit/RISK-REGISTER.md:7-10`).

**Impact:** An unauthenticated caller may poison another company’s catalog or cause write amplification. This is both a security defect and a product-integrity blocker for multi-tenant claims.

**Recommendation:** Remove the public mutation or move it behind an authenticated API-key/integration principal. Derive tenant identity from the principal, not the request body; keep any cross-tenant import as an explicitly authorized administrative operation.

**Acceptance criteria:** No unauthenticated catalog write exists; company is principal-derived; all referenced product/bundle/item writes are tenant-bound in one transaction; two-company negative tests cover read, create, update, and replay cases.

### P1 — Release-blocking or next-sprint mandatory

#### P1-01 — In-app API documentation is incompatible with the actual API contract

**Confidence:** High.  
**Verified evidence:** The in-app API page documents `POST /api/v1/rental/orders` with `customerName`, `customerPhone`, `startDate`, `endDate`, and `itemId` (`apps/web/src/features/settings/pages/ApiDocsPage.tsx:78-109`). The actual create schema requires `partnerId`, `rentalStartDate`, `rentalEndDate`, and either `rentalItemId` or `rentalBundleId` (`apps/api/src/modules/rental/rental-integration.schemas.ts:28-66`). The in-app payment example sends `orderId`, `amount`, `TRANSFER_BCA`, and `proofUrl` (`ApiDocsPage.tsx:113-135`), while the actual claim schema accepts `token`, one of `qris|transfer|gopay`, and optional `reference` (`rental-integration.schemas.ts:96-100`). The REST router parses these schemas for the live endpoints (`apps/api/src/routes/integration-v1.router.ts:201-227`, `:376-397`).

**Impact:** A partner following the product’s own API page receives validation errors or sends data that is ignored/rejected. This directly undermines the marketing claim that API docs support operations.

**Recommendation:** Establish the Zod schemas and route declarations as the contract source. Generate OpenAPI/JSON and render the same examples in the web page. Keep a compatibility document only if a legacy contract is deliberately supported.

**Acceptance criteria:** Every example is executable against a disposable tenant; REST and tRPC response fixtures are parity-tested; OpenAPI JSON is generated in CI; the in-app page is generated or tested from the same schemas; invalid legacy payloads are explicitly documented as unsupported or versioned.

#### P1-02 — Webhook event, signature, and worker documentation describes multiple incompatible contracts

**Confidence:** High.  
**Verified evidence:** The generic API document promises `rental.order.*` and `rental.payment.*` events (`docs/integration-api-v1.md:49-60`), and the external order service emits those names (`apps/api/src/modules/rental/rental-external-order.service.ts:403-405`, `:920-948`). The in-app page instead documents `order.created`, `order.status_updated`, `payment.received`, and only `x-webhook-signature` (`apps/web/src/features/settings/pages/ApiDocsPage.tsx:139-190`). The legacy Santi plugin still maps `order.created` and `payment.status.changed` to channel-specific paths (`apps/api/src/integrations/santi-living/webhooks/payload-builder.ts:1-65`).

The runtime startup also starts both the rental-specific and tenant webhook workers (`apps/api/src/index.ts:1-15`), although the standalone-flow task marks stopping the rental-specific worker as complete and leaves removal/migration of its remaining surfaces plus signature/replay tests open (`TASK-sync-erp-standalone-santi-flow.md:20-25`).

**Impact:** Integrators cannot know which event names, HMAC input, delivery headers, retry owner, or endpoint path is authoritative. Duplicate processors can deliver different payloads or retry semantics.

**Recommendation:** Choose one canonical tenant webhook contract. Mark the old Santi/compatibility contract explicitly versioned, or remove it after a migration window. Make one outbox implementation own enqueue, signing, retry, replay, and startup.

**Acceptance criteria:** One event catalog defines names, payload schemas, signature algorithm/input, `X-Webhook-Delivery-Id`, idempotency, retry, and replay behavior; exactly one worker is started; focused positive, invalid-signature, replay, and retry tests pass; docs and in-app examples are generated from that catalog.

#### P1-03 — CI/CD documentation and status are not trustworthy enough to gate product release

**Confidence:** High.  
**Verified evidence:** The snapshot records Hostinger API deployment failures on both inspected `dev` and `main` runs because the extracted artifact lacks npm workspace context (`00-repository-snapshot.md:87-96`). It also records that the Playwright job invokes a nonexistent root script, swallows errors, prints a placeholder, uses the wrong test directory, has no preview server, and is `continue-on-error` (`00-repository-snapshot.md:96`). The repository’s CI/CD documentation explicitly describes E2E as non-blocking (`docs/ci-cd.md:91-105`), while the architecture requires quality gates before deploy (`docs/ci-cd.md:28-68`).

**Impact:** Green pipeline status does not prove browser behavior or API deployment. A release can ship stale backend code while Vercel and nominal E2E checks look healthy.

**Recommendation:** Repair the workflow and make the real checks required branch protections. Use the artifact-local migration fix only after a live canary proves it.

**Acceptance criteria:** The job logs the actual Playwright spec count and controlled server URL; any test failure fails the job; artifacts are retained; the Hostinger artifact deploys, migrates, starts, and passes `/health` and version probes; protected branches require truthful quality and security contexts.

#### P1-04 — Legal, billing, email, backup, and observability launch gates are documented as open

**Confidence:** High for documentation state; deployment state is unknown.  
**Verified evidence:** The go-to-market document says public scale requires payment-provider confirmation, legal review, uptime monitoring, backups/monitoring, and a production deployment (`docs/go-to-market-readiness.md:9-36`). Its billing upgrade, onboarding-sales, legal, and commercial tasks remain unchecked (`:63-73`, `:106-134`). The SaaS go-live checklist calls itself the source of go-live decisions and forbids public launch while P0 is open (`docs/saas-go-live-checklist.md:7-18`), yet all billing, security, backup/recovery, observability, and legal/trust P0 checks remain open (`:20-117`).

The legal page contains `[NAMA PERUSAHAAN]`, `[ALAMAT LENGKAP]`, and `[NOMOR TELEPON]` placeholders and warns that legal review is required before public production (`apps/web/src/features/legal/pages/LegalPage.tsx:11-19`, `:275-279`).

**Impact:** The product may display pricing, data-rights, refund, SLA, and support claims without operational or legal evidence. This is a trust and launch blocker even if code paths exist.

**Recommendation:** Separate “implemented in code” from “verified in a target environment” in one release gate. Complete provider/domain/legal identity, backup/restore, monitoring/alerting, support, and export evidence before public launch.

**Acceptance criteria:** Production legal copy has no placeholders and is approved; provider checkout/webhook success/failure/replay/cancel paths are tested in staging and production mode as appropriate; backup restore drill meets stated RPO/RTO; Sentry/alerts receive a controlled event; support owner and escalation runbook are published.

#### P1-05 — Onboarding is implemented in source but lacks the safety evidence promised by its spec

**Confidence:** High.  
**Verified evidence:** The API and UI exist, including state transitions, opening-balance creation, first-transaction orchestration, and the protected-route gate (`apps/api/src/trpc/routers/onboarding.router.ts:97-201`, `:203-332`, `:335-568`; `apps/web/src/features/auth/components/ProtectedRoute.tsx:39-52`; `apps/web/src/features/onboarding/pages/OnboardingPage.tsx:32-177`).

However, the task file still marks the Prisma fields, audit events, idempotency keys, gate, resume logic, orchestration tests, routing tests, and manual runbook unchecked (`docs/spec/onboarding-tasks.md:11-63`). The implementation checks for an existing opening journal (`onboarding.router.ts:230-300`) and stores a first-transaction marker (`:362-376`, `:511-527`), but no onboarding audit service or idempotency-key procedure is used in that router; the marker is written only after the multi-step transaction has run. The bounded test inventory found auth/protected-route/dashboard onboarding tests but no dedicated onboarding end-to-end or API onboarding test.

**Impact:** A retry or concurrent tab can still be a product-data risk, and the team cannot prove the promised “resume, no duplicate journal/document, audit trail” behavior. The product’s first-run experience is a launch-critical path.

**Recommendation:** Finish the spec or explicitly re-baseline it against the implemented design. Put first-run mutations behind a transaction/idempotency boundary, emit the specified audit events, and add a deterministic Retail happy-path/resume/duplicate test.

**Acceptance criteria:** A new company can complete Retail onboarding from registration to `ACTIVE`; logout/resume returns to the correct step; repeated and concurrent submissions produce one journal and one first transaction; audit metadata contains company/user/step/result IDs; protected-route and API tests are required in CI; the task/checklist status is updated with links to evidence.

#### P1-06 — Rental spec scope exceeds the accepted implementation surface

**Confidence:** High.  
**Verified evidence:** Spec 043 is still Draft (`specs/043-rental-business/spec.md:1-6`). It requires grace-period auto-cancel and unit release, rental agreement generation, condition/photo evidence, customer-risk workflow, and utilization/revenue reports (`:196-208`, `:218-290`). The web route map exposes operations, returns, overdue, settings, and scheduler but no rental reports, risk-management, or agreement route (`apps/web/src/features/rental/routes.tsx:1-88`). Open tasks include lifecycle tests, scheduled auto-cancel, agreement PDF, reports, and customer-risk UI.

**Impact:** Marketing, onboarding, and sales/support cannot accurately say whether “rental ERP” means core order processing or the full business specification. A pilot may discover that required operational controls are still roadmap items.

**Recommendation:** Choose a pilot contract: either narrow the supported rental promise to the implemented core flow, or finish the P1 requirements before calling the rental product complete.

**Acceptance criteria:** A release scope lists supported and unsupported rental workflows; every supported FR has a UI/API/test link; the selected scope passes the full lifecycle test and operator runbook; unimplemented FRs are visibly marked roadmap rather than silently implied.

### P2 — Planned remediation and documentation debt

#### P2-01 — No canonical documentation/specification index or root operator entry point

**Confidence:** High.  
**Verified evidence:** The snapshot explicitly records that the repository has no root `README.md` (`00-repository-snapshot.md:48-51`). `GEMINI.md` says it was auto-generated from feature plans on 2025-12-18, describes a generic `src/`/`tests/` layout rather than the actual `apps/*`/`packages/*` monorepo, and offers only `npm test && npm run lint` as the main command (`GEMINI.md:1-29`). The Apple-like directory has its own good index (`docs/apple-like-development/README.md:5-55`), but there is no equivalent top-level product/documentation/spec index in the inventory.

The active spec sequence has a numbering gap: bounded commands returned `spec_038_exit=1`; the active directories include 033–037 and 039–044. The same check returned `p2p_doc_exit=1` for `docs/api/p2p.md`, although spec 035 has an open task to update that path, and `rental_flow_test_exit=1` for `apps/api/test/integration/rental-flow.test.ts`, although spec 043 tasks reference it.

**Impact:** Contributors, support, and operators cannot tell which document is canonical, which paths are historical, or which task is actionable. Missing referenced files make requirements look complete when their evidence path does not exist.

**Recommendation:** Add a root README/index and a `docs/`/`specs/` catalog with owner, status, last verified date, canonical-vs-historical label, implementation links, test links, and release scope. Do not copy content; link and supersede.

**Acceptance criteria:** Every active spec has a unique index entry and complete artifact set or an explicit exception; every referenced file path resolves; stale docs point to their successor; CI checks links and required metadata.

#### P2-02 — Historical Santi documents are not consistently marked or superseded

**Confidence:** High.  
**Verified evidence:** `docs/case-studies/README.md` correctly says customer-specific artifacts are historical and generic behavior belongs under `docs/integrations/` (`:1-5`). But the integration analysis still describes the old `apps/erp-sync-service`, old branches, unauthenticated `publicRental` architecture, and open tasks to create a REST adapter (`docs/integrations/santi-living-integration-analysis.md:1-8`, `:333-362`). A progress tracker in `santi-living-tasks.md` declares every sprint complete (`docs/integrations/santi-living-tasks.md:217-243`), while the standalone flow task still leaves API-v1 tests and parity open (`TASK-sync-erp-standalone-santi-flow.md:44-51`). The implementation plan in `docs/integrations/` is byte-identical to the case-study plan; the bounded `cmp` command returned `implementation_plan_cmp=0`, and the tasks files likewise returned `tasks_cmp=0`.

The older CTO report states that the product is deeply Santi-coupled and proposes moving code into a plugin system (`docs/cto/integration-saas-readiness-report.md:1-13`, `:369-418`). Current code has already moved some behavior to generic catalog names and a Santi plugin (`apps/api/src/services/integration.service.ts:28-54`; `apps/api/src/integrations/registry.ts:1-29`), so the CTO report is a historical assessment, not current truth.

**Impact:** Engineers may redo completed genericization work, trust obsolete endpoints, or miss the remaining gaps: the runtime registry still registers only the Santi plugin, while the marketplace catalog is static and API-key permissions remain hardcoded to rental read/write (`apps/api/src/integrations/registry.ts:25-29`; `apps/api/src/trpc/routers/integration.router.ts:31-49`).

**Recommendation:** Mark old reports “historical—verified against commit/date,” link the current generic contract, remove duplicate copies, and create a short delta record showing what was fixed versus what remains.

**Acceptance criteria:** No active document presents `publicRental`, `apps/erp-sync-service`, or old payload paths as the current default without a compatibility label; one current integration architecture page links registry, catalog, REST/tRPC, webhook, and Santi adapter behavior.

#### P2-03 — Task checkboxes are not requirements traceability

**Confidence:** High.  
**Verified evidence:** Several active specs have checked task lists but Draft/Planning status. Spec 041 still leaves integration tests, UI guards, overbilling/overpayment tests, and manual verification open (`specs/041-p2p-document-linking/tasks.md:63-180`). Spec 044 marks source work complete but leaves target-environment checks open (`specs/044-registration-hardening/tasks.md:9-28`, `:50-53`). The onboarding task list remains entirely unchecked despite corresponding source files being present (`docs/spec/onboarding-tasks.md:11-63`). The SaaS launch checklist requires evidence in PRs/issues/runbooks but does not provide linked evidence for its unchecked gates (`docs/saas-go-live-checklist.md:7-18`).

**Impact:** A checked task may mean “code exists,” “locally tested,” or “deployed,” with no machine-readable distinction. Product, engineering, and release owners cannot derive a reliable done/not-done state.

**Recommendation:** Introduce a lightweight traceability matrix rather than more prose: requirement ID → source path → API/UI behavior → test → environment evidence → owner → release decision.

**Acceptance criteria:** All P0/P1 requirements have a linked test and environment evidence; every open item has owner and target milestone; a task cannot be marked complete without a test or explicit accepted exception; status values distinguish Draft, Implemented, Verified-in-staging, and Released.

#### P2-04 — User and operator documentation is materially thinner than the product surface

**Confidence:** High.  
**Verified evidence:** `apps/web/README.md` contains only deployment/CI notes and no user or operator workflow guide (`apps/web/README.md:1-7`). The root has no README (`00-repository-snapshot.md:51`). The SaaS checklist leaves backup/RPO/RTO/restore, observability, support, onboarding admin, demo seed, error states, and CSV export evidence open (`docs/saas-go-live-checklist.md:68-147`). The legal page promises operational export through built-in module features or support, but the launch checklist still treats export as readiness work (`apps/web/src/features/legal/pages/LegalPage.tsx:92-100`; `docs/saas-go-live-checklist.md:119-147`).

**Impact:** A pilot depends on tribal knowledge. Operators lack a single deployment, rollback, migration, backup/restore, incident, webhook replay, billing, and support runbook; users lack concise golden-path and limitation documentation.

**Recommendation:** Prioritize a small operator handbook and user quickstart over more architecture prose. Document only the supported pilot path first: register/verify → company/onboarding → P2P or rental transaction → payment → export/support/escalation.

**Acceptance criteria:** A new operator can deploy, migrate, health-check, roll back, restore a staging backup, inspect correlation IDs, replay a webhook, and disable a compromised key using the docs alone; a pilot user can complete the supported workflow without internal source-code knowledge.

#### P2-05 — Integration extensibility is presented as broader than the current runtime model

**Confidence:** High.  
**Verified evidence:** Marketing presents multi-company/team/API docs/WhatsApp integration as product capabilities (`apps/web/src/features/marketing/pages/MarketingHomePage.tsx:108-120`, `:650-700`). The runtime catalog is a static source array (`apps/api/src/services/integration.service.ts:28-54`), while the plugin registry registers only `santiLivingPlugin` (`apps/api/src/integrations/registry.ts:25-29`). Integration creation and rotation grant hardcoded `rental:read`/`rental:write` permissions (`apps/api/src/trpc/routers/integration.router.ts:31-49`, `:72-87`, `:139-152`).

**Impact:** “Marketplace” and generic capability language imply a third-party extensibility model that is not yet available without code changes/redeploys and is not capability-derived.

**Recommendation:** Either narrow the product copy to “built-in API/custom storefront plus Santi adapter,” or finish the manifest/capability lifecycle and document its actual limits.

**Acceptance criteria:** Product copy, integration UI, manifest registry, permissions, and docs agree on whether integrations are built-in, tenant-configured, or third-party plugins; adding a supported integration has a documented owner and test path.

### P3 — Hygiene and lower-risk drift

#### P3-01 — Product catalog content is misplaced as a root product document

**Confidence:** High.  
**Verified evidence:** `product.md` describes itself as customer-facing Indonesian mattress/package/accessory copy for a website/catalog/Google Business Profile, explicitly not technical product requirements (`product.md:1-3`). `CONTEXT.md` defines a generic multi-tenant ERP glossary and explicitly rejects a proprietary default tenant such as legacy Santi Living (`CONTEXT.md:1-8`).

**Impact:** The file can be mistaken for the ERP product source of truth, while its pricing/catalog content is not linked to the ERP product schema, billing rules, or tenant catalog governance.

**Recommendation:** Move or relabel it as a Santi/external-storefront case-study asset; create a real product brief that defines ICP, supported modules, commercial boundaries, and canonical domain terms.

**Acceptance criteria:** Root product documentation is generic and versioned; customer-specific catalog copy is under case studies/integration assets; no product claim depends on an unlinked marketing draft.

#### P3-02 — Error-code and engineering docs contain stale examples and command assumptions

**Confidence:** Medium-high.  
**Verified evidence:** `docs/api/ERROR_CODES.md` is dated 2025-12-16 and includes frontend examples using `authStore`, `router.push`, and `api.post` (`docs/api/ERROR_CODES.md:1-6`, `:131-196`). `GEMINI.md` is dated 2025-12-18 and describes generic `src/`/`tests/` directories and only root `npm test && npm run lint` (`GEMINI.md:3-18`). The actual repository is an `apps/*`/`packages/*` workspaces monorepo, and the snapshot records mixed Node/npm/workflow versions (`00-repository-snapshot.md:53-59`).

**Impact:** New contributors and support staff lose time following examples that do not match the current code or runtime.

**Recommendation:** Refresh commands and examples from current package scripts, add owner/last-verified metadata, and make stale docs explicitly historical.

**Acceptance criteria:** Every “getting started” command runs from a clean checkout; examples resolve to current files/procedures; CI link/command checks cover the root guide and public API docs.

## Documentation and product-debt synthesis

### Documentation estate map

| Estate | Role | Assessment |
|---|---|---|
| Root context/guidelines/task/product | Domain vocabulary, generated contributor guidance, standalone Santi boundary task, customer catalog copy | Useful signals, but mixed audiences and dates; `GEMINI.md` and `product.md` are not current generic product truth. |
| `docs/apple-like-development/` | Product philosophy, goals, guardrails, scope, roadmap, phase docs | Strongest strategic spine; phase status is not connected to release evidence. |
| `docs/prd/` + `docs/spec/` | Onboarding and registration product requirements | Recent and actionable; status/task state is not reconciled with implementation. |
| `specs/033`–`044` | Feature-level requirements, plans, data models, quickstarts, tasks | Richest engineering detail; numbering gap, Draft statuses, open test tasks, and no cross-feature release index. |
| `docs/integrations/` + case studies | External API, webhooks, Santi implementation and analysis | Generic docs and historical Santi docs coexist; in-app API page is stale relative to actual schema. |
| `docs/saas-*` + go-to-market | Pilot/public launch gates and roadmap | Clear, appropriately conservative, but most operational gates remain unchecked. |
| `docs/flows/`, `docs/others/`, `docs/cto/` | Golden paths, lessons, historical analyses | Valuable context, but several artifacts are old, duplicated, or describe prior architecture. |
| README/operator layer | User setup, deployment, incident, backup, rollback, support | Insufficient; there is no root README and the web README is deployment-only. |

### Product gaps that matter most

1. **Contract truth:** API payloads, webhook names, headers, signatures, retries, and compatibility routes need one source of truth.
2. **Launch proof:** billing, email, legal identity, backups, restore, monitoring, support, and deployment canary need target-environment evidence, not only code.
3. **First-run reliability:** onboarding needs transactional/idempotent behavior and a complete test/runbook path.
4. **Rental scope discipline:** separate the implemented rental core from the Draft spec’s agreement, condition, risk, auto-cancel, and reporting ambitions.
5. **Multi-tenant safety:** close public caller-supplied tenant writes and reconcile RBAC/integration permission issues before marketing “multi-company” as a trust claim.
6. **Traceability:** replace checkbox-only completion with requirement-to-test-to-environment evidence.

## Quick wins

1. Add a root README/index with current commands, package map, pilot scope, environment prerequisites, and links to canonical docs.
2. Add `docs/INDEX.md` and `specs/INDEX.md`; mark each artifact `canonical`, `historical`, or `superseded`, with owner and last-verified date.
3. Replace the in-app API examples with schema-valid examples immediately; add an executable contract test before generating formal OpenAPI.
4. Publish one webhook event catalog and mark legacy Santi routes/events as compatibility-only.
5. Update onboarding and registration checklists to reflect actual code, leaving only missing audit/idempotency/staging evidence open.
6. Remove placeholders from legal copy and add a CI sentinel for placeholder tokens such as `[NAMA PERUSAHAAN]`.
7. Fix the E2E workflow’s script/path/server/error handling and make its truthful result visible in the release gate.
8. Add a pilot runbook covering deploy, migration, rollback, backup/restore, billing webhook, API-key rotation, webhook replay, and support escalation.

## Phased product/engineering roadmap

### Phase 0 — Containment and truthful release gate (0–48 hours)

- Rotate/revoke exposed credentials and invalidate cookie/session material; enable secret scanning/push protection.
- Remove or protect the public catalog mutation; add two-company negative tests.
- Mark the current release as “no public launch” until P0 gates close.
- Repair the actual E2E job and record a Hostinger canary with health/version/migration evidence.

**Exit:** P0 security and tenant-write findings closed; failed deployment/E2E cannot appear green.

### Phase 1 — Contract and documentation baseline (one focused sprint)

- Make Zod schemas/routes the API contract source; generate OpenAPI JSON and validate examples.
- Select canonical webhook event/signature/outbox behavior and remove the duplicate worker path.
- Create root/docs/spec indexes and a requirements traceability matrix.
- Reconcile onboarding/registration tasks with source and add the missing API/UI tests and runbook.

**Exit:** A partner, contributor, and operator can follow current docs without guessing which contract is live.

### Phase 2 — Controlled pilot operations (one to two sprints)

- Verify email provider/domain and migration in staging; run registration-to-onboarding smoke tests.
- Verify billing provider mode, checkout, webhook idempotency, entitlement enforcement, cancellation/failure behavior.
- Complete legal identity review, support contact, backup policy, restore drill, monitoring/alerts, and deployment rollback.
- Run the supported P2P and/or rental golden path with real pilot data and direct support.

**Exit:** 3–10 pilot businesses can be supported with measured incidents, restore evidence, and a known scope of supported workflows.

### Phase 3 — Product completeness and trust (subsequent milestones)

- Decide whether rental 043 is a narrow core product or the full agreement/condition/risk/reporting product; implement only the committed scope.
- Finish P2P/document-linking tests and user-facing guards.
- Provide supported exports, operator audit/replay tools, and customer-facing limitation/help documentation.
- Replace static/hardcoded integration permissions with manifest-derived capabilities if marketplace extensibility remains a product goal.

**Exit:** Product claims, routes, tests, docs, and support commitments agree for every advertised module.

### Phase 4 — Public launch

- Launch only after P0/P1 release gates, legal approval, restore drill, truthful CI/E2E, deployment canary, and billing/email evidence are all closed.
- Monitor activation, onboarding completion, first transaction, billing conversion, webhook failures, support tickets, and data-integrity incidents.
- Keep the public promise narrower than the backlog; promote Draft specs only after acceptance evidence exists.

## Verified facts, inferences, and unknowns

### Verified facts

- The checkout and source are a large monorepo with extensive specs/docs and no root README (`00-repository-snapshot.md:35-51`).
- Code/build checks passed in the snapshot, but parallel API tests collide, coverage gates fail, dependency audit fails, Hostinger deployment fails, and E2E is false-green (`00-repository-snapshot.md:67-96`).
- Auth, onboarding, billing, REST/tRPC integration, generic tenant webhook emission, and broad ERP/rental routes exist in source, with the exact evidence cited above.
- The current documentation contains explicit contradictions: in-app API payloads vs Zod schemas; generic webhook docs vs legacy in-app events; onboarding task state vs source; old Santi architecture vs current genericization; legal copy vs launch checklist.
- The repository’s own launch docs do not authorize unattended public scale (`docs/go-to-market-readiness.md:1-21`; `docs/saas-go-live-checklist.md:7-18`).

### Inferences

- A supported pilot could be viable after containment and operational verification because the core flows build and test, and the go-to-market document intentionally narrows the promise.
- Documentation drift is now a product risk, not merely editorial debt: it can cause failed integrations, incorrect billing/legal expectations, unsafe operations, and contradictory support guidance.
- The next highest-return work is release truth and contract convergence, not adding more feature documents.

### Unknowns requiring owner verification

- Whether any exposed credential/cookie values remain valid after coordinated rotation.
- Whether the target database has every migration applied successfully and whether backups/restores meet an actual RPO/RTO.
- Whether production/staging email, billing provider, DNS, legal approval, Sentry alerts, and Hostinger canary are configured and verified.
- Whether the optional cross-repository Santi storefront E2E can run in a real environment; its test is environment-gated and references an external workspace (`apps/api/test/e2e/external-rental-storefront-live-order-flow.test.ts:24-94`).
- Whether all tenant-isolation/RBAC findings in the cross-cutting audit reproduce in the deployed role/configuration; the product documentation must not infer safety from source shape alone.

## Final assessment

The repository contains a real product and a strong strategic/documentation foundation, but it currently has more declared surface area than verified product truth. The release decision should be **pilot-only after P0 containment**, with P1 contract, pipeline, legal, billing, onboarding, rental-scope, and operations gates explicitly tracked. Public launch should wait until the documentation estate becomes executable evidence rather than a mixture of current code, Draft specs, unchecked tasks, and historical architecture.
