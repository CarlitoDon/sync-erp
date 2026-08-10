# Security, Dependencies, and Observability Audit

Audit date: 2026-08-09  
Scope: repository source, manifests, lockfile, tracked configuration/artifacts, CI/CD, and static runtime paths.  
Method: read-only inspection; `npm ls`, `npm audit --omit=dev --json`, bounded `rg`/`git grep`, archive listing, and redaction-safe key/status checks. No product code, configuration, lockfile, branch, remote, or generated artifact was changed.

## Executive assessment

The repository has several good security primitives, but the current state is not release-safe for a multi-tenant ERP. The highest-risk verified issue is a tenant-boundary failure in the session-authenticated tRPC path: a logged-in user can supply an arbitrary `X-Company-Id`, while the context layer loads membership but does not reject a missing membership. `protectedProcedure` then accepts the context based only on `userId` and `companyId`. This can expose or mutate another tenant's data and should block release until fixed and regression-tested.

Other urgent issues are tracked production/staging secrets and cookie/deployment artifacts, an unauthenticated WhatsApp pairing QR endpoint, unrestricted server-side webhook/link-preview fetches, fail-open rate limiting during Redis errors, and a dependency audit showing 26 vulnerabilities in the installed production graph (14 high, 11 moderate, 1 low).

Severity convention: P0 = immediate tenant/security release blocker; P1 = urgent exploitable or material exposure; P2 = important hardening/operational risk; P3 = lower-risk hygiene or follow-up.

## Current-state map

| Surface | Current control | Verified gap / unknown |
|---|---|---|
| Web | Vite/Vercel static app; cross-origin cookie session with CSRF token; browser Sentry and replay integration | `VITE_*` values are public by design; explicit replay/input masking policy is not configured in code; API boundary is the main risk |
| API | Express + Helmet, CORS callback, cookie parser, double-submit CSRF, session/API-key/Bot procedures, tRPC | Global tRPC mount uses optional auth; tenant membership is not fail-closed in context; no global request rate limit or readiness check |
| Bot | Express endpoints, static bearer secret for send/ping/logout, Baileys session in Redis | `/status` returns the live QR without auth; Redis auth state is JSON at rest; public CORS and no endpoint rate limiting |
| MCP | Bearer-token protected Streamable HTTP sessions; constant-time token comparison; session ownership fingerprint | No request rate limiter; JSON body limit is not explicit; `/health` exposes session/config details |
| Database | Prisma/Postgres, company filters in many services, two RLS migrations | RLS context helper is exported but has no application call sites; helper sets pooled session state outside a transaction; policy coverage is uneven |
| CI/CD | GitHub Actions, npm lockfile, build/typecheck/test/integration gates, Hostinger/PM2 and Vercel deploys | CI/deploy jobs mostly use `npm install --legacy-peer-deps --no-audit`; Node 20 is used while repository pins 22.12.0; no dependency/security gate or SBOM observed |

## Findings

### SEC-01 — P0 — Session tenant isolation is not fail-closed

Confidence: High (static path verified; no live tenant exploit was run).

Verified facts:

- `apps/api/src/app.ts:83-90` mounts the main tRPC router behind `optionalAuthMiddleware`, not the stricter membership-checking middleware.
- `apps/api/src/middlewares/auth.ts:148-178` copies `X-Company-Id` into `req.context` and, when the session is valid, sets `userId`; it does not reject a company for which the user has no membership.
- `apps/api/src/trpc/context.ts:31-64` queries `CompanyMember`, but a missing membership only leaves `userRole`/permissions empty; it does not throw or clear `companyId`.
- `apps/api/src/trpc/trpc.ts:152-169` defines `protectedProcedure` as requiring only `ctx.userId` and `ctx.companyId`.
- `apps/api/src/trpc/routers/company.router.ts:28-32` allows an authenticated user to call `company.getById` for an arbitrary UUID. `apps/api/src/trpc/routers/user.router.ts:24-29` similarly fetches a user by arbitrary ID under `protectedProcedure`.

Impact: any authenticated account that knows or guesses another company UUID can enter the protected tenant context. The effect is amplified by broad `companyId`-scoped ERP routers and by admin/API-key management routes that rely on `protectedProcedure`. This is a cross-tenant confidentiality and integrity failure.

Recommendation: make tenant selection a single fail-closed middleware/policy: validate the session, require an existing `(userId, companyId)` membership, and derive the company only from an allowed membership. Require explicit membership for every authenticated company lookup, including `company.getById`, `user.getById`, admin, API-key, billing, and attachment routes. Do not rely on an empty permission array as a substitute.

Acceptance criteria:

- A session for tenant A with `X-Company-Id: B` receives 403/404 and produces no B query result, even when B is a valid UUID.
- Every protected router has a test for missing membership and arbitrary-company IDs.
- A session for A cannot read, create, update, delete, replay, or rotate resources belonging to B.
- Authorization tests run against an isolated database fixture before release.

### SEC-02 — P1 — Credentials and sensitive artifacts remain tracked

Confidence: High. Values are intentionally not reproduced.

Verified facts:

- `git ls-files` includes `apps/api/.env.production`, `apps/api/.env.staging`, `apps/bot/.env.production`, `apps/bot/.env.staging`, `apps/web/.env.production`, `apps/web/.env.staging`, `packages/database/.env.production`, `packages/database/.env.staging`, and `cookies.txt`.
- `git ls-files -s` shows these files and `deploy/api.zip`/`deploy/bot.zip` tracked as mode `100644`.
- A redaction-safe scan confirmed non-empty values for database URLs and application/auth/webhook variables in tracked environment files; it emitted only filenames, keys, status, and lengths, never values.
- `cookies.txt` is a 131-byte Netscape cookie file (`file cookies.txt`), despite `.gitignore:57-59` marking it sensitive.
- `unzip -Z1 deploy/api.zip` and `deploy/bot.zip` both contain a root `.env`; a key-only scan found non-empty database/auth/webhook/Redis fields inside the archives.
- `.gitignore:13-18` explicitly re-includes `.env.production` and `.env.staging`; `.gitignore:57-69` ignores cookies and deploy zips, but ignore rules do not remove already tracked files.

Impact: repository readers, CI artifacts, backups, or any exposed remote history may obtain database, API, bot, webhook, OAuth, Redis, cookie, or seed credentials. Reuse of application secrets across API/bot/webhook configuration also reduces blast-radius isolation. Current production use of the values is not confirmed from this local audit, but the presence and non-empty status are verified.

Recommendation: treat all tracked secret-bearing values and cookies as compromised; rotate database credentials, session/API/Bot/webhook/OAuth/Redis/seed credentials as applicable; invalidate sessions and cookies; remove tracked files and embedded `.env` entries through an approved history-rewrite/secret-remediation process; move deployment secrets to the platform secret store. Add a redaction-safe secret scanner and prevent archives/env files from entering Git or CI artifacts.

Acceptance criteria: `git ls-files` returns no real environment, cookie, or deployment archive; repository history and CI artifacts are remediated; rotated values are verified in each environment; deployment packages contain no `.env`; secret scanning is a required CI check.

### SEC-03 — P1 — WhatsApp pairing QR is unauthenticated

Confidence: High.

Evidence: `apps/bot/src/server.ts:18-31` exposes public health/root routes and `:46` mounts `/status` without middleware. `apps/bot/src/api/status.ts:7-11` returns both status and `getQrDataUrl()`. `apps/bot/src/bot/baileys.ts:54-60` stores a freshly generated WhatsApp pairing QR as a data URL.

Impact: any network client that can reach the bot can retrieve the current pairing QR while pairing is pending and potentially link an attacker-controlled WhatsApp client to the business session. The endpoint also has `cors()` enabled globally at `apps/bot/src/server.ts:12`.

Recommendation: remove QR data from public status; bind the bot to a private interface or allowlisted API network; expose setup QR only behind an authenticated, admin-authorized, short-lived one-time endpoint; rotate the bot/API secrets after remediation.

Acceptance criteria: unauthenticated `/status` never returns QR material; an authorized setup flow is time-limited and audited; integration tests assert no QR leakage.

### SEC-04 — P1 — Outbound fetches permit SSRF and internal-network probing

Confidence: High for the fetch paths; exploitability depends on deployment network reachability.

Evidence:

- `apps/api/src/trpc/routers/api-key.router.ts:163-181` accepts any syntactically valid URL from a `protectedProcedure` and calls `webhookService.testWebhook`.
- `apps/api/src/services/webhook.service.ts:130-157` passes that URL directly to `fetch` with no scheme/host allowlist or private/link-local/metadata-IP rejection.
- `apps/api/src/services/tenant-webhook-outbox.service.ts:72-102` persists tenant-supplied webhook URLs and `:521-581` later posts to them directly.
- `apps/bot/src/types/order.ts:40` accepts an arbitrary `orderUrl`; `apps/bot/src/api/send-order.ts:79-93` passes it to Baileys `getUrlInfo`, which performs a server-side link preview request.

Impact: authenticated users or API-key holders may use the API/bot as a network pivot to probe internal services, cloud metadata endpoints, localhost/admin ports, or attacker-controlled destinations. Outbox retries make a malicious URL durable.

Recommendation: use an egress proxy/allowlist, resolve and re-check DNS/IP on every connection, reject loopback/private/link-local/multicast/metadata ranges for IPv4 and IPv6, restrict redirects, cap response size and content type, and separate tenant webhook delivery from arbitrary connectivity testing. Apply the same policy to link previews or remove server-side previews.

Acceptance criteria: security tests reject private, link-local, IPv4-mapped, encoded, redirecting, and DNS-rebinding targets; permitted webhook destinations are explicit and audited; outbound requests have bounded timeout/body/redirect policy.

### DEP-01 — P1 — Installed production dependency graph has high vulnerabilities

Confidence: High for the local audit result; deployed-artifact applicability must be checked separately.

Evidence: `npm audit --omit=dev --json` on 2026-08-09 reported 26 vulnerabilities in the installed production graph of 888 packages: 14 high, 11 moderate, 1 low, 0 critical. Directly reported vulnerable packages include:

- `link-preview-js` high, GHSA-4gp8-rjrq-ch6q, with no automatic fix; it is used by the live bot link-preview path above.
- `@whiskeysockets/baileys` high through `link-preview-js`, with no automatic fix.
- `@modelcontextprotocol/sdk` moderate through `@hono/node-server`.
- `mermaid` moderate, `react-router-dom` moderate, and `prisma` high in the installed workspace graph.

Impact: the direct runtime SSRF path is coupled to an unpatched dependency; other findings include prototype-pollution, DoS, path/auth middleware, open-redirect/XSS, and tooling risks. `npm audit` is a dependency signal, not proof that every advisory is reachable in every deployed package.

Recommendation: immediately isolate/remove `link-preview-js` or replace it with a maintained, SSRF-safe resolver; upgrade Baileys only after compatibility testing. Produce per-artifact audits for API, bot, MCP, and web, then remediate or formally risk-accept each advisory with reachability evidence. Add `npm audit --audit-level=high` (or an equivalent policy) and SBOM generation to CI.

### AUTH-01 — P1 — Role and administrative authorization is incomplete

Confidence: High.

Evidence:

- `apps/api/src/trpc/routers/company.router.ts:84-112` checks only that the actor is a company member before changing another member's `roleId`.
- `apps/api/src/modules/company/company.service.ts:130-155` explicitly skips actor permission verification; `_actorId` is unused.
- `apps/api/src/trpc/routers/api-key.router.ts:17-188` exposes API-key creation, webhook changes, revocation, and testing through `protectedProcedure`, without an admin/owner permission gate. Permissions are accepted as arbitrary strings at `:24-32`.
- `apps/api/src/trpc/routers/admin.router.ts:17-265` mounts operational/audit/outbox reads and replay mutations through `protectedProcedure`; the referenced `AdminPolicy` exists, but the router/service path shown does not invoke it.
- `apps/api/src/middlewares/rbac.ts:85-89` explicitly allows users with no role to access everything (MVP fail-open).

Impact: a normal member may promote/demote members, create or revoke integration credentials, configure webhook destinations, replay sensitive deliveries, or view operational data. The SEC-01 tenant-context flaw makes the impact cross-tenant.

Recommendation: enforce role/permission checks in the procedure/service boundary, not comments or UI; validate role ownership within the same company; whitelist API-key permissions; require step-up/audit for credential changes and replay; remove all fail-open “allow all” branches.

### RATE-01 — P1 — Rate limiting fails open on Redis failure

Confidence: High.

Evidence: `apps/api/src/modules/common/services/redis-rate-limit.service.ts:50-75` catches Redis errors and returns `allowed: true`. `apps/api/src/modules/common/services/adaptive-rate-limit.service.ts:37-50` therefore sees a successful result and does not enter its intended in-memory fallback. Public authentication procedures use this service at `apps/api/src/trpc/trpc.ts:108-125`. The client identifier also trusts the first `X-Forwarded-For` value at `apps/api/src/trpc/trpc.ts:26-40`.

Impact: Redis outage or targeted Redis failure disables login/register/resend/verification throttles; spoofed forwarding headers can fragment identifiers. This enables brute force, account enumeration, email abuse, and request amplification.

Recommendation: choose an explicit fail-closed policy for authentication, or use a bounded local limiter when Redis is unavailable and expose degraded-state telemetry. Trust proxy configuration must match the actual ingress chain; do not use untrusted forwarded headers directly.

### DATA-01 — P1 — Public order tokens return excessive personal/payment data

Confidence: High; whether the breadth matches product intent is an owner decision.

Evidence: `apps/api/src/trpc/routers/public-rental/public-rental-order.router.ts:25-108` is a public token lookup. `apps/api/src/modules/rental/rental-external-order.service.ts:179-229` selects customer phone, full address components, coordinates, and order relations. `apps/api/src/modules/rental/rental-integration.dto.ts:141-197` returns address, geolocation, payment reference/failure fields, public token, prices, and customer phone. `packages/database/prisma/schema.prisma:1164-1165` stores a long-lived UUID bearer token with no expiry field. No rate limit is visible on the public lookup path.

Impact: a leaked token from URL history, referrer/logging, screenshots, or integrations exposes customer PII, location, and payment metadata and may enable tracking at scale.

Recommendation: use short-lived, revocable, purpose-scoped signed tokens; minimize public DTO fields; remove payment references, exact coordinates, and full address unless required; add rate limiting, abuse monitoring, token rotation, and `Referrer-Policy: no-referrer` on tracking pages.

### CONFIG-01 — P2 — Runtime and dependency reproducibility drift

Confidence: High.

Evidence:

- `.nvmrc:1` and `.node-version:1` pin Node `22.12.0`; root `package.json:39-40` permits `>=18.0.0`.
- CI/deploy workflows use Node 20 at `.github/workflows/ci-cd.yml:83-90,152-159,605-612` and `.github/workflows/deploy-mcp-hostinger.yml:44-51`; `scripts/local-dev-service.sh:15` points at a different Node 22.21.1 installation path.
- `vercel.json:2-4` uses `npm install`; CI deploy packaging uses `npm install --omit=dev --no-audit --legacy-peer-deps` at `.github/workflows/ci-cd.yml:123-128` and the equivalent MCP workflow lines `63-68`.
- `npm ls` resolves API `@prisma/client` 7.2.0 while database/shared resolve 7.1.0, `@prisma/adapter-pg` resolves 7.8.0, and all workspaces resolve Zod 3.25.76 despite root `package.json:42-44` declaring a Zod 4.0.0 override.

Impact: CI, local, and deployed artifacts may run different Node/Prisma/dependency behavior; `npm install` plus semver ranges and legacy-peer-deps weaken lockfile reproducibility and conceal audit failures.

Recommendation: standardize one supported Node version, declare it in every runtime package, use `npm ci` from the lockfile for all builds, remove legacy peer bypasses, align Prisma/adapter versions across workspaces, and make overrides match the actually tested tree.

### DATA-02 — P2 — RLS defense in depth is not wired into application execution

Confidence: High for absence of call sites; live database enforcement is unknown.

Evidence: RLS is enabled in `supabase/migrations/20260114112540_enable_rls.sql:6-64`; the second migration creates company policies using `current_setting('app.current_company', true)` at `supabase/migrations/20260115_enable_rls.sql:30-144` and says all queries must set it at `:154-157`. The helper `packages/database/src/client.ts:80-113` sets session state with `$executeRaw`, but a repository-wide search found no application call sites beyond its definition/export.

Impact: RLS may silently deny direct queries, or manual `companyId` filters become the only effective boundary. The helper's session-level setting outside an explicit transaction is also unsafe with a pooled connection because state and subsequent queries are not guaranteed to share one isolated connection.

Recommendation: either enforce tenant context in a transaction-scoped database wrapper for every request or make the application boundary the sole documented control and remove misleading RLS claims. Add live tests for direct SQL/Prisma access, pooled concurrency, service-role bypass, and every table carrying tenant data.

### API-01 — P2 — Credentialed CORS and spoofable request identity need tighter ingress policy

Confidence: Medium-high.

Evidence: `apps/api/src/app.ts:29-40` trusts one proxy hop, enables credentialed CORS, and accepts a default 25 MB JSON body. `apps/api/src/cors.ts:20-64` allows all `.vercel.app` origins when `CORS_ALLOW_VERCEL_PREVIEWS` is enabled and accepts requests with no `Origin`. `apps/api/src/trpc/trpc.ts:26-40` uses client-supplied `X-Forwarded-For` in rate-limit identity.

Impact: a forgotten preview flag can grant credentialed browser reads to untrusted preview deployments; proxy/header misconfiguration weakens origin/rate-limit assumptions; large JSON requests increase memory/CPU pressure.

Recommendation: use an exact production origin list, keep preview access separate from credentialed production sessions, validate proxy hops at the edge, derive client IP from trusted ingress metadata, and set route-specific body limits.

### FILE-01 — P2 — Attachment upload controls are incomplete

Confidence: High.

Evidence: `apps/api/src/trpc/routers/attachment.router.ts:30-37` accepts arbitrary `mimeType`, unbounded schema strings, and base64 content. `apps/api/src/modules/attachment/attachment.service.ts:71-107` decodes into memory and writes local files; size is checked only after decoding against a configurable 20 MB default at `:83-90`. `:278-321` has a useful path containment check and sanitized generated storage key.

Impact: authenticated users can consume memory/disk with repeated large uploads, upload active content under a declared MIME type, and lose files on ephemeral/non-shared deployments. No quota, content sniffing, malware scan, or object-storage durability control was found.

Recommendation: enforce encoded and decoded size limits before allocation, allowlist MIME/content signatures and extensions, scan/quarantine files, add per-tenant quotas and retention, and use durable private object storage with signed downloads. Keep the existing path-containment tests.

### OBS-01 — P2 — Logs, Sentry, and audit records can retain PII/secrets

Confidence: High for collection paths; actual Sentry retention/configuration is external and unknown.

Evidence:

- Backend Sentry initialization at `apps/api/src/instrument.ts:43-56` has no `beforeSend` redaction; `apps/api/src/middlewares/sentry.ts:29-49` attaches original URL, correlation ID, company ID, and user ID to captured errors.
- `apps/api/src/middlewares/errorHandler.ts:147-159` logs full server errors; the repository contains at least 122 non-test `console.log/warn/error` call sites across API, bot, MCP, and web.
- `apps/api/src/modules/common/services/email.service.ts:81-104` logs recipient and raw verification URL in the log provider path, including non-production/staging fallback; `:32-55` interpolates user-controlled name/URL into HTML without escaping.
- `packages/database/prisma/schema.prisma:376-391` stores email, IP, user-agent, correlation ID, and JSON metadata in `AuthAuditLog`; `:907-925` stores arbitrary `AuditLog.payloadSnapshot`. No retention/deletion/DSAR policy is visible in this repository.
- Browser Sentry enables replay at `apps/web/src/lib/sentry.ts:42-58`; the frontend logger still writes raw error/stack/context to console and leaves Sentry capture as a TODO at `apps/web/src/lib/logger.ts:34-52`.

Impact: verification links/session-adjacent material, customer identifiers, URLs, error payloads, and audit snapshots may enter logs or third-party telemetry. Email HTML injection can affect recipients if a malicious name reaches registration.

Recommendation: centralize structured logging with field-level redaction, never log tokens/URLs/phone numbers by default, configure Sentry `beforeSend`/scrubbing and explicit replay masking, escape email HTML, define retention and deletion controls for audit/auth data, and monitor log volume/error budgets.

### OBS-02 — P2 — Health and operational observability are shallow

Confidence: High.

Evidence: `apps/api/src/app.ts:53-55` returns `{status:"ok"}` without checking database, Redis, outbox worker, storage, or dependency readiness. `apps/api/src/index.ts:11-18` starts two outbox workers in every API process, while failure/dead-letter state is primarily logged by the worker. MCP `/health` at `apps/mcp/src/index.ts:32-54` exposes active session/config details and returns configuration error text. No metrics or readiness endpoint was found in the inspected runtime paths.

Impact: load balancers can route traffic to an instance that cannot serve data; queue lag, dead letters, Redis outages, and latency regressions are detected late; health responses disclose operational details.

Recommendation: separate liveness/readiness, check dependencies with bounded timeouts, expose authenticated/internal metrics for latency, auth failures, queue depth/age/dead letters, Redis state, storage, and worker leases, and alert on SLOs. Return generic public health errors.

### BOT-01 — P2 — WhatsApp credentials and reconnect behavior need hardening

Confidence: High.

Evidence: `apps/bot/src/bot/use-redis-auth-state.ts:71-83` stores serialized Baileys credentials in Redis without application encryption or TTL; `:155-169` uses `KEYS` over the prefix to clear state. `apps/bot/src/bot/baileys.ts:96-104` recursively reconnects without a bounded backoff/jitter strategy and logs raw disconnect error JSON at `:76-79`.

Impact: Redis compromise exposes a reusable WhatsApp session; shared/misconfigured prefixes can cause environment interference; repeated failures can create resource and log storms.

Recommendation: use TLS/ACL-isolated Redis, least-privilege credentials, environment-specific namespaces, encrypted/managed secret storage, bounded exponential backoff with a circuit breaker, and non-sensitive structured error logging. Replace `KEYS` with a bounded namespace strategy.

## Strengths worth preserving

- Helmet is enabled (`apps/api/src/app.ts:31`); API session cookies are HTTP-only and secure in production/staging (`apps/api/src/trpc/routers/auth.router.ts:23-35`).
- CSRF uses a cryptographically random double-submit token and exempts bearer-token requests (`apps/api/src/middlewares/csrf.ts:27-84`).
- Passwords use bcrypt cost 12 and email verification tokens are random and stored hashed (`apps/api/src/modules/auth/auth.utils.ts:4-22`).
- API keys are random, bcrypt-hashed, prefix-indexed, expiry-aware, and returned only once (`apps/api/src/services/api-key.service.ts:50-82,129-189`).
- Google OAuth state uses a signed, expiring state value; attachment storage checks path containment and scopes reads by company (`apps/api/src/modules/attachment/attachment.service.ts:132-150,278-314`).
- The lockfile is version 3 with registry integrity metadata, CI runs lint/typecheck/tests/integration tests, and outbox workers have retry/dead-letter states and graceful shutdown hooks.

## Prioritized quick wins

1. Treat SEC-02 as an incident: rotate all tracked secret-bearing values/cookies, remove them from tracked artifacts/history, and verify deployment/CI artifacts contain none.
2. Fix SEC-01 with fail-closed membership context and cross-tenant negative tests before any production release.
3. Remove/authorize the Bot QR response and rotate bot/API credentials (SEC-03).
4. Add SSRF-safe egress policy to webhook and link-preview fetches; remove the unpatched link-preview dependency or isolate it (SEC-04, DEP-01).
5. Gate role changes, API-key/webhook management, admin observability, and replay behind explicit company-scoped admin permissions (AUTH-01).
6. Make authentication throttles effective during Redis outages and stop trusting arbitrary forwarded headers (RATE-01, API-01).
7. Add Sentry/log redaction, verification-link suppression, retention policy, and dependency audit/SBOM CI gates (OBS-01, DEP-01).

## Longer roadmap

- Establish a single authorization layer with tenant-scoped repositories, policy tests generated from the router inventory, and transaction-scoped RLS or an explicit documented alternative.
- Use a secret manager and environment promotion pipeline; pin Node/npm/package versions, use `npm ci`, generate SBOMs, and require signed/reproducible deployment artifacts.
- Replace local attachment storage with private durable object storage, quotas, malware scanning, content validation, signed expiring downloads, and deletion/retention workflows.
- Replace public UUID bearer tracking with scoped short-lived tokens and minimal DTOs; add privacy inventory, retention, deletion, and incident-response procedures.
- Adopt structured logs plus OpenTelemetry/metrics, readiness checks, queue/Redis/storage SLOs, alert routing, and tested disaster recovery.

## Suggested verification commands

These commands are intended for an isolated test environment and preserve secret values by summarizing metadata only:

```sh
git rev-parse --show-toplevel
git status --short --untracked-files=all
git ls-files -- '*/.env*' cookies.txt 'deploy/*.zip'
npm audit --omit=dev --audit-level=high
npm ls --all @prisma/client prisma @prisma/adapter-pg zod @modelcontextprotocol/sdk link-preview-js
unzip -Z1 deploy/api.zip | rg '(^|/)\.env($|\.)|node_modules/'
unzip -Z1 deploy/bot.zip | rg '(^|/)\.env($|\.)|node_modules/'
```

For dynamic security verification, use two isolated fixture tenants and assert that a session/API key for tenant A receives 403/404 for tenant B on every protected, admin, attachment, billing, and credential-management procedure; assert no QR is returned without setup authorization; assert SSRF test vectors are rejected; and run these tests against a disposable database/Redis rather than any live environment.

## Unknowns and limitations

- No live production database, Hostinger process, Vercel project, ingress/WAF, Redis configuration, Sentry project, or remote Git visibility was inspected; current credential validity, public exposure, and external retention settings are therefore unknown.
- `npm audit` describes the current installed workspace graph; each generated deployment artifact needs an independent artifact-level audit after remediation.
- RLS policy behavior with the production database role and Prisma pool was not exercised; the missing application call sites and unsafe helper shape are static findings.
- No destructive, write, deployment, migration, build, test-database, or secret-rotation action was performed.
