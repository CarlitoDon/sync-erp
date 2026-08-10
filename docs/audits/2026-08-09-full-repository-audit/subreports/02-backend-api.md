# Backend API audit — `apps/api`

Audit date: 2026-08-09  
Scope: routing, services, repositories, authentication/authorization, tenancy, validation, errors, transactions/idempotency, business invariants, API contracts, security, performance, and operations.

Overall posture: **High risk for a multi-tenant ERP API.** The strongest concerns are committed environment credentials, a public tenant-write endpoint, and a tRPC admission path that does not verify company membership. Several good transaction, webhook, and integration patterns exist, but they do not compensate for those boundary failures.

## Scope & method

I inspected the current working tree read-only, starting at the repository root and reviewing the `apps/api` entrypoints, Express middleware, tRPC context/procedure definitions, all router registrations, representative high-risk routers/services/repositories, Prisma client/schema usage, authentication and billing paths, webhook workers, and API tests. I also used read-only `git status`, `git ls-files`, `git log`, `git diff --check`, and targeted `rg`/`nl` commands. No product code, configuration, lockfile, branch, remote, generated artifact, or database was changed by this audit.

Findings distinguish **Verified** code facts, **Inferred** exploitability/impact, and **Unknown** runtime or deployment state. Secret values were deliberately not printed. At the beginning the checkout was clean; later, unrelated `apps/web/playwright-report/index.html` and other audit files appeared in the working tree. They were preserved untouched.

## Current-state map

- **Ingress:** `apps/api/src/app.ts:27-43` creates Express with Helmet, correlation IDs, CORS, a 25 MB JSON limit, and global CSRF middleware. tRPC mounts at `:73-90` use `optionalAuthMiddleware`; the raw `/api/v1` integration route and attachment download are separate HTTP surfaces.
- **Authentication:** browser sessions are seven-day cookie sessions. `authMiddleware` implements strict session/company membership validation (`apps/api/src/middlewares/auth.ts:25-143`), but the tRPC mounts use the optional variant (`:148-178`), which accepts `x-company-id` into context without checking membership.
- **Authorization:** `protectedProcedure` checks only `ctx.userId` and `ctx.companyId` (`apps/api/src/trpc/trpc.ts:152-169`). Session RBAC is loaded into context but is not a default gate. API-key procedures validate a Bearer key and permissions; the raw `/api/v1` integration surface is stricter and more consistently scoped.
- **Data/tenancy:** Prisma is a shared singleton with per-query `companyId` filtering in many services/repositories (`packages/database/src/client.ts:58-75`). RLS context helpers exist at `:95-114`, but no `apps/api` call site or SQL policy was found in the inspected tree; tenant isolation therefore depends primarily on application code.
- **Business/operations:** DI registers services globally; accounting, inventory, payment, and fulfillment paths use transactions and row locks in representative locations. Two webhook outbox workers start with the API and stop on SIGTERM (`apps/api/src/index.ts:9-33`).
- **Contracts/tests:** tRPC gives typed contracts and Zod validation; the raw integration route has explicit Bearer/permission handling. Vitest covers unit, invariant, integration, and E2E flows, but coverage explicitly excludes repositories (`apps/api/vitest.config.ts:40-62`) and there are no focused negative tests for the highest-risk boundary paths identified below.

## Findings table

| ID | Severity | Confidence | Finding | Primary evidence |
|---|---|---|---|---|
| F-01 | P0 | High | Production/staging environment files with non-empty credentials are tracked in Git. | `git ls-files apps/api/.env.production apps/api/.env.staging`; redacted key-length scan showed non-empty `DATABASE_URL`, API secrets, OAuth secrets, webhook/billing secrets. |
| F-02 | P0 | High | Public tRPC rental-bundle catalog sync can mutate an arbitrary tenant and create catalog records. | `apps/api/src/trpc/routers/rental-bundle.router.ts:95-129`; service writes at `rental-bundle.service.ts:182-265`. |
| F-03 | P1 | High | Main tRPC admission trusts the company header and does not require session membership. | `app.ts:73-90`; `auth.ts:148-178`; `context.ts:31-64`; `trpc.ts:152-169`. |
| F-04 | P1 | High | Role/RBAC enforcement is incomplete; any member can change roles, and admin/credential operations use only `protectedProcedure`. | `company.router.ts:84-112`; `company.service.ts:130-155`; `admin.router.ts:17-265`; `admin.policy.ts:15-90` has no call sites. |
| F-05 | P1 | High | PO/SO updates accept an arbitrary record cast to Prisma input; quantity helper queries lack tenant binding. | `purchaseOrder.router.ts:50-58,90-99`; `salesOrder.router.ts:50-58,108-116`; repositories update/query by ID only. |
| F-06 | P1 | High | API-key rate limiting fails open on Redis errors, while public identifiers trust caller-supplied forwarding headers. | `redis-rate-limit.service.ts:50-75`; `trpc.ts:26-39,230-237`; `app.ts:29`. |
| F-07 | P1 | High | Protected users can make the server POST to an arbitrary URL through webhook testing (SSRF/egress risk). | `api-key.router.ts:163-187`; `services/webhook.service.ts:130-158`. |
| F-08 | P2 | High | Manual billing checkout embeds unescaped tenant data in HTML and exposes state transitions through a bearer-like session URL with CSRF/expiry inconsistencies. | `billing-http.router.ts:50-105,123-262`; global CSRF at `app.ts:40-43`; checkout URL inputs at `billing.router.ts:34-66`. |
| F-09 | P2 | High | Public order-token response exposes detailed PII, precise location, and payment metadata without token expiry/revocation. | `public-rental-order.router.ts:25-110`; lookup by token only at `rental-external-order.service.ts:179-229`. |
| F-10 | P2 | Medium | tRPC idempotency keys are company/scope-scoped, not actor/operation-scoped, and completion is not lease- or status-conditional. | `trpc.ts:42-98`; `idempotency.service.ts:27-87,105-135`; repository update at `idempotency.repository.ts:56-67`. |
| F-11 | P2 | High | HTTP error classification can misclassify every `AppError`/`DomainError` as a Prisma error, breaking status and API error contracts. | `errorHandler.ts:60-90`; both error classes expose a string `code` (`errorHandler.ts:12-28`; `packages/shared/src/errors/domain-error.ts:10-22`). |

## Detailed findings

### F-01 — Tracked production/staging credentials (P0, high confidence)

**Verified:** `git ls-files` returns both `apps/api/.env.production` and `apps/api/.env.staging`; `.gitignore` explicitly un-ignores those names (`.gitignore:13-18`). A redacted scan that printed only line number, key name, and value length showed non-empty database URLs and secret-looking fields, including `SYNC_ERP_API_SECRET`, Google OAuth client secrets, auth-state secrets, webhook/billing secrets, and bot secrets in one or both files. `git log --all -- <files>` also shows these files have been present across multiple commits.

**Unknown:** whether every value remains active, but the files are named as runtime mode files and `apps/api/src/env.ts:40-79` loads mode-specific files. Treat them as compromised until each credential owner confirms otherwise.

**Impact:** database access, session/API authentication, OAuth account manipulation, webhook spoofing, and bot/integration takeover may be possible. This is an organization-wide incident risk, not merely a repository hygiene issue.

**Recommendation:** immediately rotate/revoke all non-placeholder credentials and database credentials; audit access logs; remove the files and their historical blobs after coordination with incident/security owners; add secret scanning and a CI deny rule. Keep only a redacted `.env.example` in Git.

### F-02 — Public cross-tenant catalog mutation (P0, high confidence)

**Verified:** `rentalBundleRouter.findByExternalId` and `syncFromExternalCatalog` are `publicProcedure` (`apps/api/src/trpc/routers/rental-bundle.router.ts:95-129`). Both accept caller-supplied `companyId`. The sync service upserts bundles, deletes/recreates components, and creates products and rental items for that ID (`rental-bundle.service.ts:182-265`). The router is reachable through the main application router (`apps/api/src/trpc/router.ts:34-55`) behind only the optional tRPC middleware. The same module also has protected `list` and `create` operations that trust input `companyId` (`rental-bundle.router.ts:8-12,38-65`), and `update` ultimately calls a repository update by bundle ID only (`rental-bundle.service.ts:142-159`; `rental-bundle.repository.ts:120-125`).

**Impact:** an unauthenticated caller who obtains/guesses a tenant ID can poison or create catalog data, cause repeated write amplification, and potentially affect downstream rental availability. An authenticated user can also submit another tenant’s ID to the input-trusting paths. The issue bypasses both authentication and tenant ownership.

**Recommendation:** remove public write access; require a validated API key/integration permission or a server-to-server signed channel; derive `companyId` exclusively from the authenticated principal; enforce `{id, companyId}` on every update/delete; validate component ownership; cap batch size and execute a bounded transaction with audit logging.

### F-03 — tRPC company context is not membership-bound (P1, high confidence)

**Verified:** `app.ts:73-90` mounts only `optionalAuthMiddleware` for both tRPC surfaces. That middleware copies `x-company-id` into `req.context` without a membership query (`auth.ts:148-178`). `createContext` performs a membership lookup only to populate optional role data and does not reject a null membership (`context.ts:31-64`). `protectedProcedure` then admits any request with a user ID and any company ID (`trpc.ts:152-169`). The strict `authMiddleware` exists but is not used on these tRPC mounts. `company.getById` also calls the service without checking that the caller belongs to the target company (`company.router.ts:28-32`).

**Impact:** any logged-in user who can obtain a different company UUID may invoke tenant-filtered procedures against that company. The exact reachable data/write set depends on each router’s own filtering, but the global admission invariant is absent, so one missed filter becomes a cross-tenant read/write. This is an inferred exploit path from verified code; it should be treated as exploitable until a negative integration test proves otherwise.

**Recommendation:** make authenticated tRPC context fail closed when `x-company-id` is missing or membership is absent; derive the selected company from a membership-backed operation; distinguish session membership from API-key tenancy; add two-company tests for every protected router and test both read and mutation paths.

### F-04 — RBAC and admin controls are advisory (P1, high confidence)

**Verified:** `company.updateMemberRole` checks only that the actor is a member and even documents that the real permission check is missing (`company.router.ts:92-110`). The service receives `_actorId` but explicitly skips actor authorization (`company.service.ts:130-155`). Every admin endpoint is only `protectedProcedure` (`admin.router.ts:17-265`), while `AdminPolicy` contains the intended admin checks and pagination validation (`admin.policy.ts:15-90`) but has no call sites in `apps/api/src`. The generic Express RBAC middleware allows users with no role to access everything (`middlewares/rbac.ts:85-90,148-155`). API-key creation and integration install/rotation are likewise protected by authentication only (`api-key.router.ts:24-66`; `integration.router.ts:18-93,130-155`).

**Impact:** a normal member can promote members or themselves, inspect saga/audit/outbox data, replay webhook deliveries, mint API credentials with caller-selected permission strings, and alter integrations. The outbox replay paths are tenant-filtered, but replay is still a privileged operational action.

**Recommendation:** centralize role/permission middleware in tRPC; deny missing roles by default; require OWNER/ADMIN or narrowly defined permissions for role changes, API-key/integration management, billing, audit, and replay; enforce actor/target invariants (no self-demotion of the last owner, no cross-company role IDs); add authorization matrix tests.

### F-05 — Unbounded order updates and IDOR quantity queries (P1, high confidence)

**Verified:** PO and SO update inputs are `z.record(z.string(), z.unknown())` and are cast directly to `Prisma.OrderUpdateInput` (`purchaseOrder.router.ts:50-58`; `salesOrder.router.ts:50-58`). Services validate only the current order and a limited order-number policy, then repositories update with `where: { id }` (`purchase-order.service.ts:239-259`; `purchase-order.repository.ts:132-145`; corresponding SO code at `sales-order.service.ts:199-219` and `sales-order.repository.ts:156-168`). The quantity helper procedures receive only `orderId` and no company context (`purchaseOrder.router.ts:90-99`; `salesOrder.router.ts:108-116`); repository queries filter only by fulfillment `orderId` (`purchase-order.repository.ts:189-203`; `sales-order.repository.ts:91-104`).

**Impact:** the update contract exposes a broad Prisma mutation surface that can attempt to modify fields and relations not intended by the endpoint; exact field-level exploitability depends on Prisma’s generated input shape, but there is no application allow-list or state-specific mutation policy. Separately, a caller with a known foreign order UUID can query shipment/receipt quantities across tenants.

**Recommendation:** replace record casts with explicit DTOs and state-specific allow-lists; reject company/type/status/financial-total changes through generic update; update using `{id, companyId, type}` and optimistic version checks; make quantity methods accept and verify `companyId` before querying; add cross-tenant IDOR tests.

### F-06 — Rate limiting fails open and trusts spoofable client identity (P1, high confidence)

**Verified:** `RedisRateLimitService.consume` catches all Redis errors and returns `allowed: true` (`redis-rate-limit.service.ts:50-75`). The API-key procedure calls this service directly (`trpc.ts:203-257`), so its intended per-key limit is bypassed during Redis failure. The adaptive service’s in-memory fallback cannot reliably activate for this path because the Redis service swallows the exception (`adaptive-rate-limit.service.ts:32-50`). Public auth identity uses the first caller-supplied `x-forwarded-for` value (`trpc.ts:26-39`), while Express trusts one proxy hop (`app.ts:29`). The Redis unit test covers success/blocking but not error behavior (`test/unit/redis-rate-limit.service.test.ts:42-75`).

**Impact:** Redis outage or a forwarding-header deployment mistake can enable brute-force login/registration attempts and unlimited API-key traffic, with cost, availability, and credential-attack consequences.

**Recommendation:** normalize client IP through the trusted proxy chain and never accept an arbitrary forwarding header from an untrusted hop; enforce a bounded local fallback or fail closed for credential/API-key abuse; add account/key/device limits and outage tests; monitor Redis health and rate-limit mode.

### F-07 — Arbitrary webhook-test URL creates SSRF/egress risk (P1, high confidence)

**Verified:** `apiKey.testWebhook` accepts any Zod-valid URL and passes it without ownership verification (`api-key.router.ts:163-187`). `WebhookService.testWebhook` performs a server-side `fetch` to that URL with a timeout, but no host allow-list, private-address block, redirect policy, or DNS/IP re-check (`services/webhook.service.ts:130-158`).

**Impact:** any caller who can reach this protected procedure can make the API probe internal services, loopback endpoints, cloud metadata endpoints, or arbitrary internet hosts. The blast radius is amplified by the incomplete RBAC finding.

**Recommendation:** bind tests to a saved, company-owned API-key endpoint; require an explicit integration-management permission; allow only HTTPS and approved hosts; resolve and block loopback/private/link-local/reserved IPs before connect and on redirects; consider an isolated egress worker.

### F-08 — Manual billing checkout has XSS and capability/CSRF inconsistencies (P2, high confidence)

**Verified:** `renderCheckoutPage` interpolates `companyName` and other values directly into HTML (`billing-http.router.ts:50-105`). The checkout GET and confirm/fail/cancel POST handlers use the session ID as their business capability and do not visibly enforce one-time status or expiry (`billing-http.router.ts:123-262`); POSTs also pass through the global CSRF middleware. The tRPC endpoint accepts caller-supplied success/cancel URLs and stores them (`billing.router.ts:34-66`; `company-subscription.service.ts:310-341`). Global CSRF protects POSTs (`app.ts:40-43`), but the generated HTML forms contain no CSRF header/token (`billing-http.router.ts:90-99`), so the intended manual flow is incompatible with the middleware.

**Impact:** a tenant-controlled company name can inject markup into the manual checkout page; the flow can be broken in normal browser use; an exposed session URL can be replayed as a bearer capability; caller-controlled redirects can support phishing/open-redirect behavior.

**Recommendation:** HTML-escape every interpolated value; enforce session state/expiry and atomic one-time transitions; choose one explicit model (authenticated+CSRF or signed short-lived checkout capability) and test it end-to-end; allow-list same-origin redirect targets and avoid exposing raw database IDs where possible.

### F-09 — Public order token exposes excessive PII/payment data (P2, high confidence)

**Verified:** `publicRentalOrderRouter.getByToken` returns customer phone, full address, latitude/longitude, payment reference/failure details, totals, and item data (`public-rental-order.router.ts:25-110`). The service query is keyed only by `publicToken` (`rental-external-order.service.ts:179-229`); no expiry or revocation check is present in that path.

**Impact:** anyone possessing a token from a URL, browser history, referrer, log, screenshot, or support ticket can retrieve precise customer/location and payment metadata. A public tracking capability may be intentional, but the response is broader than a minimal tracking DTO.

**Recommendation:** define a deliberately minimal public response; remove payment references/failure reasons and precise coordinates; add token expiry/rotation/revocation and rate limits; avoid putting the token in analytics/referrer-bearing pages; add privacy review and contract tests.

### F-10 — Idempotency scope is too broad and completion is race-prone (P2, medium confidence)

**Verified:** tRPC calls `acquireLock(key, companyId, scope)` without an entity or procedure identifier (`trpc.ts:42-54`). `acquireLock` converts the missing entity to an empty string (`idempotency.service.ts:105-120`), so keys are effectively company+scope scoped. A completed response is returned to any later principal able to use the same company/key, and `complete` updates by key without checking the current processing state (`idempotency.service.ts:123-135`; `idempotency.repository.ts:56-67`). Zombie-lock deletion and recreation occur before the old worker’s completion can be conditionally fenced (`idempotency.service.ts:58-87`).

**Impact:** two clients or credentials in one tenant can collide on a reused key; a key reused across operations sharing a scope can replay an unrelated response; a late worker can overwrite a newer attempt. These are inferred race/replay risks and should be validated under concurrency.

**Recommendation:** bind the key to route/operation, authenticated principal/API-key fingerprint, and entity where applicable; use an atomic compare-and-set with a lease token; make completion/failure conditional on the current processing owner; add concurrent, stale-lock, cross-actor, and cross-operation tests.

### F-11 — HTTP error contract misclassifies application/domain errors (P2, high confidence)

**Verified:** `isPrismaKnownError` treats any error with a string `code` as Prisma (`middlewares/errorHandler.ts:55-65`). `AppError` itself defines `code` and `statusCode` (`errorHandler.ts:12-28`), and shared `DomainError` does the same (`packages/shared/src/errors/domain-error.ts:10-22`). The Prisma branch then maps every non-P2025 code to HTTP 400 with a generic database error (`errorHandler.ts:67-90`).

**Impact:** raw Express routes such as attachment download can turn intended 401/403/404/409 domain responses into misleading database errors, breaking client retry/authorization behavior and operational diagnosis. tRPC often handles its own errors, so the exposure is surface-dependent.

**Recommendation:** handle `AppError`/`DomainError` before Prisma errors and identify Prisma errors by Prisma error classes or a strict `P####` code pattern; add raw HTTP contract tests for each status class and ensure Sentry/logging preserves the original category.

## Strengths

- The raw `/api/v1` integration path has a clearer security model: Bearer API-key validation, explicit permission checks, company-scope assertions, and idempotency (`apps/api/src/routes/integration-v1.router.ts:71-177,181-229`).
- Core financial/inventory flows show serious concurrency intent: atomic document-number upsert (`apps/api/src/modules/common/services/document-number.service.ts:109-165`), row locks and transactions in receipt/shipment/payment paths, optimistic version checks, and audit logging.
- API keys are generated randomly, bcrypt-hashed, and returned once (`apps/api/src/services/api-key.service.ts`); webhook signatures and billing webhook signatures use HMAC/timing-safe comparison in their respective services.
- Express has useful baseline controls (Helmet, CORS allowlist, CSRF double-submit, correlation IDs), Sentry integration, graceful shutdown, and two explicit outbox workers.
- The test portfolio is broad: unit, invariant, integration, and E2E suites cover accounting, inventory, rental lifecycle, CSRF, auth services, idempotency, and webhook outboxes. CI runs lint, typecheck, tests, integration tests, build, and migration deployment (`.github/workflows/ci-cd.yml:92-119,435-437`).

## Gaps/unknowns

- No live database, Redis, proxy chain, deployment process, or production traffic was exercised. Active status of the tracked credentials is unknown; the safe static evidence is sufficient to require rotation.
- The repository contains `withCompanyContext`/`setCompanyContext` helpers and a Supabase RLS migration for a subset of tables, but no API call site for the helpers was found. Whether those policies are applied and enforced by the deployed database role is unknown.
- Coverage excludes repositories (`apps/api/vitest.config.ts:52-62`), even though repository predicates are a primary tenant-control layer. No focused negative tests were found for F-02/F-03/F-04/F-05/F-07 or Redis outage behavior.
- The API has typed tRPC and Zod contracts, but no independent OpenAPI/schema compatibility artifact was found during this audit. Raw HTTP billing, attachment, MCP, and `/api/v1` contracts need separate integration checks.
- Attachment uploads decode the complete base64 payload before enforcing the decoded 20 MB limit (`apps/api/src/modules/attachment/attachment.service.ts:60-90`) while Express accepts 25 MB JSON (`app.ts:40`); local filesystem storage and process-local MCP sessions also require an explicit multi-instance/retention design review.
- The CI workflow copies `packages/database/prisma/schema.prisma` into the deployment package (`.github/workflows/ci-cd.yml:111-119`), while an ignored local `apps/api/deploy` directory exists outside Git. The latter should be treated as a possible stale artifact, not a deployment source, until operators confirm its lifecycle.

## Prioritized recommendations

1. **Immediate incident/security action:** rotate and revoke all credentials in F-01, audit access, and prevent secrets in Git.
2. **Close tenant admission:** remove public bundle writes and make every tRPC company context membership-validated and fail-closed. Add two-company negative tests before release.
3. **Restore privilege boundaries:** enforce role/permission checks for member-role changes, admin observability/replay, API-key/integration/billing operations; deny missing roles.
4. **Constrain mutation contracts:** replace generic Prisma update records with explicit DTOs, tenant-bound repository predicates, state/version checks, and validated cross-entity company ownership.
5. **Harden abuse/egress controls:** fix Redis failure behavior, normalize proxy identity, restrict webhook destinations, and add outage/SSRF tests and metrics.
6. **Repair public/billing contracts:** escape checkout HTML, make checkout capabilities short-lived and one-time, allow-list redirects, minimize public order DTOs, and fix raw HTTP error classification.
7. **Operational hardening:** bound array/string/base64 payloads, move attachments to durable object storage or define single-instance constraints, and add repository-inclusive coverage for security predicates.

## Suggested verification commands

Run these against a disposable database/Redis and a non-production environment; none were run as part of this read-only audit:

```sh
# Secret exposure without printing values
git ls-files apps/api/.env.production apps/api/.env.staging
gitleaks detect --source . --redact --log-opts="--all"  # if installed

# Static/API checks
npm run typecheck
npm run lint
npm run test:unit --workspace=@sync-erp/api
npm run test:integration --workspace=@sync-erp/api

# Verify the tenant boundary with two users/companies
# 1. Login as a member of company A.
# 2. Send x-company-id: <company-B> to company.getById, product.list,
#    rentalBundle.list, admin.listTenantWebhookOutbox, and PO/SO queries.
# 3. Assert 403/404, never company-B data or mutations.

# Verify the public bundle write is closed
curl -i -X POST "$API/api/trpc/rentalBundle.syncFromExternalCatalog" \
  -H 'content-type: application/json' \
  --data '<tenant-B payload>'

# Redis failover and API-key throttling
# Stop/blackhole Redis, issue > configured API-key attempts, and assert 429
# or a bounded local fallback rather than unlimited 200 responses.

# SSRF regression matrix
# Test webhook URL validation against loopback, RFC1918, link-local,
# IPv6 loopback, DNS rebinding, redirects, and a permitted external host.

# Concurrent idempotency regression
# Reuse one key across two actors, two procedures in the same scope, and a
# stale-lock retry; assert no cross-actor response replay or late overwrite.
```
