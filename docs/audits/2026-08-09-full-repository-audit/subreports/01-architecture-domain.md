# Architecture & Domain Audit

## Scope & method

Audit date: 2026-08-09. Runtime observed: Node v22.12.0. Scope covered `apps/*`, `packages/*`, `docs/adr`, `docs/architecture`, the root workspace/build graph, relevant CI configuration, and the tenant-isolation migration because these define the effective architecture. The audit was read-only except for this report.

Method: line-numbered source/document review; workspace and package-manifest inventory; targeted import/layer scans; comparison of Prisma models with the RLS migration; and isolated `tsc --noEmit -p` checks for API, web, bot, MCP, shared, and database. The working tree was clean before and after the checks. No build, test suite, database mutation, branch/remote change, commit, push, or `gh` state query was performed.

Severity means likely business/operational impact if the risk materializes. Confidence describes confidence in the evidence, not certainty that the inferred runtime failure has already occurred.

## Current-state map

- The root is an npm workspace over `apps/*` and `packages/*` (`package.json:8-10`) orchestrated by Turbo (`turbo.json:15-60`). The main applications are API, web, bot, and MCP; the main packages are database, shared, and the ESLint plugin. `packages/scripts` contains a script but no package manifest.
- `apps/api` is a large modular monolith: 17 domain folders under `src/modules`, approximately 30.7k TypeScript lines in 124 module files. Accounting is about 6.3k lines and rental about 8.4k lines. Facades exist for rental, inventory, and accounting, and a central composition root exists in `apps/api/src/modules/common/di/register.ts:61-352`.
- The API is a mixed transport host. `apps/api/src/app.ts:67-90` mounts MCP, HTTP routes, REST `/api/v1`, an integration tRPC router, and the main tRPC router. The v1 REST and tRPC routes both call `RentalExternalOrderService`, but the transport boundary is not represented by a separate contracts package.
- Persistence is a single Prisma schema of 61 models and 1810 lines (`packages/database/prisma/schema.prisma`). The aggregate root is named `Company`; a read-only scan found 163 `companyId` occurrences and no `tenantId` field in the schema. Rental, sales, procurement, inventory, accounting, billing, and integration records share the same database package and `prisma` client.
- `packages/shared` combines generated Prisma/Zod schemas, API DTO/types, validators, domain values (`Money`, `BusinessDate`), errors, constants, and test casting helpers. It also declares `@sync-erp/database` and `@prisma/client` dependencies (`packages/shared/package.json:37-44`).
- The integration model is partly generic (`Integration`, `appId`, registry/plugin interfaces) but the registry always imports and registers the Santi Living plugin (`apps/api/src/integrations/registry.ts:1-2,25-29`). There are three webhook-outbox concepts in the API/schema: rental outbox, tenant outbox, and an older second rental outbox implementation.

## Findings table

| ID | Severity / confidence | Finding | Primary impact |
|---|---|---|---|
| F-01 | P1 / High | Tenant/RLS enforcement is defined but not wired consistently; only 19 of 61 schema models are RLS-enabled. | Cross-tenant protection depends on every query being correct and on deployment role behavior; new or omitted scopes can become data-isolation incidents. |
| F-02 | P1 / High | Rental outbox ownership is split: production enqueue/admin paths use the newer implementation, while API startup runs the older worker against the same `RentalWebhookOutbox` table. | Producer/consumer contract drift, competing retry semantics, and difficult incident diagnosis for external integrations. |
| F-03 | P2 / High | Layering and module boundaries are convention-only: services/policies/routers import persistence and orchestrate across domains; DI is bypassed in production paths. | Broad change blast radius, low replaceability, and increasing difficulty scaling teams or extracting services. |
| F-04 | P2 / High | `apps/web` and `apps/bot` compile against API source/router types; `shared` is persistence-coupled; transport/architecture documents disagree with the implementation. | Frontend/connectors cannot evolve or deploy independently from API internals; schema/router changes propagate across app boundaries. |
| F-05 | P2 / High | ADR-0001 and the canonical glossary are not aligned with the live integration/domain vocabulary. | Generic product claims, tenant terminology, and connector ownership remain ambiguous; legacy assumptions can re-enter core paths. |
| F-06 | P2 / High | The build/test graph omits MCP and has weak internal dependency/version discipline; API v1 parity and end-to-end verification remain incomplete. | CI can report green while deployed app surfaces or REST/tRPC compatibility are not covered. |

## Detailed findings

### F-01 — Tenant/RLS enforcement is incomplete (P1, high confidence)

Verified facts:

- The migration claims all business tables need isolation and that Prisma middleware sets `app.current_company` (`supabase/migrations/20260115_enable_rls.sql:5-31,154-158`), but it enables RLS for only 19 of the 61 Prisma models. A read-only model comparison reported `schema models=61 rls-enabled=19 missing=42`; missing examples include `CompanySubscription`, `Integration`, both outboxes, `CompanyMember`, `OrderItem`, `InvoiceItem`, `Attachment`, `SagaLog`, `AuditLog`, all rental extension/deposit/return/policy models, and `CashTransaction`.
- The database package exposes `withCompanyContext` and `setCompanyContext` (`packages/database/src/client.ts:80-114`, re-exported at `packages/database/src/index.ts:1-6`), but `rg -n 'withCompanyContext|setCompanyContext' apps packages supabase` found only those definitions/exports and the example comment. No API middleware or request handler calls either helper.
- API auth reads `x-company-id`, validates membership, loads the company, and stores `req.context` (`apps/api/src/middlewares/auth.ts:55-105,125-128`); it does not set the PostgreSQL session variable. `apps/api/src/trpc/context.ts:31-64` performs more company-scoped lookups but likewise does not establish the DB session context.

Impact: the verified gap is missing runtime wiring and incomplete RLS coverage. The actual production exposure is unknown because query-level `companyId` filters and the database role determine behavior. The inferred risk is high: a missed filter, relation query, raw query, or future model can bypass the intended boundary, and changing from a service-role connection to an RLS-enforced role can change behavior abruptly.

Recommendation: choose one explicit request-scoped isolation mechanism and make it unavoidable (for example, a transaction/context wrapper that sets `app.current_company` for every request, with a safe transaction lifecycle). Bring all tenant-owned tables under reviewed RLS policies or document why a table is intentionally excluded. Add two-tenant read/write tests that exercise REST, tRPC, background workers, and raw/transaction paths, and verify `current_setting('app.current_company', true)` during the request.

### F-02 — Split-brain rental outbox ownership (P1, high confidence)

Verified facts:

- API startup imports and starts `startWebhookOutboxWorker` from `apps/api/src/modules/rental/webhook-outbox.service` and also starts the generic tenant worker (`apps/api/src/index.ts:1-14`).
- The older `WebhookOutboxService` reads/writes `prisma.rentalWebhookOutbox` and owns the polling worker wired at startup (`apps/api/src/modules/rental/webhook-outbox.service.ts:81-146,629-657`). The newer `RentalWebhookOutboxService` reads/writes the same table and defines a second polling-worker function (`apps/api/src/modules/rental/rental-webhook-outbox.service.ts:101-166,842-877`), but a repository-wide search found no caller of `startRentalWebhookOutboxWorker` outside its definition.
- The active rental notification facade and admin replay surface use the newer implementation (`apps/api/src/modules/rental/rental-webhook.service.ts:1-5,34-72`; `apps/api/src/trpc/routers/admin.router.ts:9-11,56-160`). The older implementation additionally consults `integrationRegistry` (`webhook-outbox.service.ts:12-13`), while the newer implementation builds configurable webhook requests (`rental-webhook-outbox.service.ts:621-640,756-840`).
- The project task notes explicitly mark “Stop starting the rental-specific webhook worker in the API runtime” as done, yet the startup code still starts it (`TASK-sync-erp-standalone-santi-flow.md:20-25`).

Impact: the active producer/admin paths and active consumer are owned by different implementations that can apply different payload/path, retry/dead-letter, logging, and operator semantics to the same rows. A second concurrent worker is not proven active in the audited startup path; the verified defect is split ownership and a dormant alternate poller that could later be activated accidentally.

Recommendation: establish one implementation as the sole owner of enqueue, processing, replay, and retry semantics for `RentalWebhookOutbox`; migrate callers and startup wiring together, then remove or disable the other poller. Converge the remaining rental-specific delivery into the generic tenant event/outbox model only after behavior is parity-tested. Add a single-worker ownership test, producer/consumer contract test, concurrent-claim test, stable delivery-id test, and REST/tRPC replay/signature tests.

### F-03 — Layering and module boundaries are not mechanically enforced (P2, high confidence)

The repository constitution defines route → controller → service → policy/rules → repository and says only repositories should know persistence (`.agent/rules/constitution.md:109-178`). The implementation diverges:

- No `*.controller.ts` files were found under `apps/api/src`; `apps/api/src/routes/integration-v1.router.ts:1-27` imports database types, API-key infrastructure, a domain service, schemas, and DTO mappers directly. Its handlers perform auth/permission checks, validation, idempotency, service invocation, and response mapping (`:79-139,179-227`).
- Services import Prisma/database types directly. Examples are `apps/api/src/modules/inventory/inventory.service.ts:12-23` and `apps/api/src/modules/rental/rental-order-lifecycle.service.ts:7-29`; the lifecycle service also calls `prisma.rentalItem` and `prisma.rentalBundle` directly (`:105-113`). Policies also import database enums/types, e.g. `company.policy.ts:10` and `inventory.policy.ts:13-14`.
- A read-only import scan found dense cross-domain edges, including `accounting->common` (16 imports), `common->accounting` (11), `rental->common` (10), `inventory->accounting` (6), and `rental->accounting` (5). `onboarding.router.ts:1-23,44-63` directly uses Prisma and imports seven domain services/repositories, then contains multi-step business orchestration.
- The documented DI composition root registers core services (`apps/api/src/modules/common/di/register.ts:61-352`), but production routes construct services outside it: `new RentalExternalOrderService()` appears in the integration and public-rental routers, and `RentalService` constructs seven sub-services directly (`apps/api/src/modules/rental/rental.service.ts:46-68`). The hybrid DI document calls this transitional (`docs/architecture/dependency-injection.md:35-44,84-89`), but the bypass is not limited to tests/scripts.

Impact: the code is a valid modular-monolith shape today, but boundaries are enforced by review rather than tooling. Persistence changes, transaction types, accounting rules, and rental/inventory changes can propagate through many modules; independent extraction or parallel team ownership will be expensive. This is maintainability/scalability debt, not a verified current outage.

Recommendation: define a small allowed-import matrix and enforce it with ESLint or dependency-cruiser. Move router orchestration into application services/controllers, expose cross-domain ports/facades/events instead of importing concrete services, and make the composition root the only production construction path. Keep default constructors only for explicitly isolated tests/scripts during a tracked migration.

### F-04 — Shared and app boundaries are coupled to API/persistence internals (P2, high confidence)

Verified facts:

- `packages/shared/src/types/rental.ts:1-4` imports `Prisma` from `@sync-erp/database` and exposes `Prisma.RentalOrderGetPayload`; `packages/shared/src/validators/index.ts:8-9,120-122` re-exports generated Prisma/Zod schemas. This conflicts with the repository rule that only `packages/database` may import Prisma (`.agent/rules/constitution.md:62-76`).
- The web app imports the API router source directly in three files (`apps/web/src/lib/trpc.ts:1-16`, `apps/web/src/lib/trpcProvider.tsx:5-8`, `apps/web/src/types/api.ts:12-23`), and its TypeScript paths expose API internals (`apps/web/tsconfig.json:8-15`). The bot similarly imports `@sync-erp/api/src/trpc/router` (`apps/bot/src/lib/trpc.ts:1-3`) and declares the API as a dev dependency (`apps/bot/package.json:31-33`).
- The implementation is tRPC-first for internal web use, while the constitution says web must use HTTP/REST only (`.agent/rules/constitution.md:64-76`). The API has intentionally retained both REST and tRPC integration v1 mounts (`apps/api/src/app.ts:71-90`), but the task list still has REST tests, tRPC tests, and parity tests unchecked (`TASK-sync-erp-standalone-santi-flow.md:44-50`).

Impact: `apps/web` and `apps/bot` are compile-time consumers of API source layout rather than versioned contracts. A router rename or API dependency change can break an app build even when the wire contract is unchanged. `shared` is not a pure portable contract/domain package and makes database schema evolution a transitive concern for every consumer.

Recommendation: split pure `@sync-erp/contracts` (Zod DTOs and transport-safe types) from `@sync-erp/domain` and `@sync-erp/database`; remove Prisma imports from shared. Publish/import a stable API contract or generated client rather than `apps/*/src` paths. Decide whether internal tRPC is canonical, update the ADR/constitution accordingly, and add REST/tRPC response-parity tests before treating both as supported surfaces.

### F-05 — ADR and domain vocabulary drift (P2, high confidence)

ADR-0001 says Santi-specific models, routers, and logic were eradicated and the canonical entity is `Tenant` (`docs/adr/0001-generic-multi-tenant-pivot.md:6-20`). The current tree still hard-wires Santi into the core registry (`apps/api/src/integrations/registry.ts:1-2,25-29`) and contains a live plugin manifest with `appId: 'santi-living'`, Santi URLs, and Santi asset defaults (`apps/api/src/integrations/santi-living/manifest.ts:3-14`, `config/defaults.ts:1-5`). The task list also records unfinished Santi cleanup and extraction work (`TASK-sync-erp-standalone-santi-flow.md:3-10,27-33`).

The glossary says `Tenant` is canonical and no internal/default Santi tenant exists (`CONTEXT.md:1-7`), but the Prisma model is `Company` (`schema.prisma:20`) and all operational context is `companyId`; there is no `Tenant` model or `tenantId` field. This may be an intentional external connector retained for the Santi flow, but the accepted ADR does not state that exception.

Impact: the generic core still has a product-specific registration dependency, while contributors must translate Tenant ↔ Company and generic integration ↔ Santi-specific behavior. That weakens portability and makes future connector extraction harder.

Recommendation: amend ADR-0001 to state the supported external-connector exception, or move Santi registration/seed/defaults/tests behind an optional connector package/configuration. Choose one canonical domain term and either rename the persistence/API vocabulary through a migration or explicitly document `Company` as the persistence name for a `Tenant` aggregate.

### F-06 — Incomplete build/test graph and internal dependency discipline (P2, high confidence)

Verified facts:

- Root project references cover API, web, database, shared, and bot but omit MCP and the ESLint plugin (`tsconfig.json:1-9`). MCP has an independent `typecheck` script but no test/lint script (`apps/mcp/package.json:6-16`); bot has `check-types` but no test script (`apps/bot/package.json:6-11`). Root `typecheck` and test scripts are only `tsc -b` and `turbo run test` (`package.json:18-25`).
- Internal package versions use `"*"` rather than the repository-mandated `workspace:*`, e.g. API (`apps/api/package.json:25-26`), shared (`packages/shared/package.json:37-44`), web (`apps/web/package.json:17-21`), and bot (`apps/bot/package.json:13-15,31-33`). The rule is explicit at `.agent/rules/constitution.md:70-76`.
- The E2E workflow invokes a root `test:e2e` script that is not present and masks failure with `|| echo` plus `continue-on-error` (`.github/workflows/e2e-playwright.yml:60-68`; root scripts `package.json:12-25`).
- Static validation performed for this audit passed for all six package/app tsconfigs with `tsc --noEmit`: API, web, bot, MCP, shared, and database. This validates type health for those isolated projects, not CI coverage or runtime behavior.

Impact: MCP and bot can drift outside the root quality gate; package resolution is less explicit and can conceal accidental registry/workspace substitution; and E2E can remain a placeholder while appearing operational in workflow logs. The task notes confirm missing v1 REST, tRPC parity, connector, and full build/lint verification (`TASK-sync-erp-standalone-santi-flow.md:44-51`).

Recommendation: create an explicit Turbo task matrix for every deployable app, add test/lint scripts or explicit exclusions for MCP/bot, fail when a required E2E command is absent, and replace internal `*`/`file:` references with a consistent workspace protocol. Treat `deploy/api-mcp` and copied deployment packages as generated outputs with a single source of truth and drift checks.

## Strengths

- The repository has meaningful domain decomposition, facades, and a visible composition root. Rental and accounting were deliberately split into specialized services (`apps/api/src/modules/rental/rental.service.ts:1-11`; `apps/api/src/modules/accounting/services/journal.service.ts:19-45`).
- TypeScript strictness is strong in the base config (`tsconfig.base.json:3-20`), and all six isolated no-emit checks passed in this audit.
- The Prisma schema consistently models company ownership and adds many company-scoped indexes/uniques (for example `Company` and its relations at `schema.prisma:20-67`, and rental order constraints around `:1142-1210`). Auth also validates company membership before setting request context (`apps/api/src/middlewares/auth.ts:60-105`).
- Integration v1 has shared schemas/DTO mappers and reuses the same external-order service from REST and tRPC (`routes/integration-v1.router.ts:12-27`; `trpc/routers/integration-v1.router.ts:9-23`). Idempotency is present in both transport paths.
- Core API and shared package tests are substantial in breadth: the tree contains 97 API test files and 5 shared-package test files, including finance, P2P, rental, invariants, isolation, idempotency, and lifecycle areas. This is a good base for the missing boundary/parity tests.

## Gaps/unknowns

- No live database/RLS handshake was performed; it is unknown whether `20260115_enable_rls.sql` is applied in each environment, which DB role the app uses, and whether service-role bypass currently masks the missing context wiring.
- Duplicate-worker delivery behavior was inferred from static code; proving duplicate external requests requires an isolated database and controlled worker run.
- It is unknown whether Santi is a supported first-party connector by deliberate product decision or an ADR-cleanup exception that was never documented.
- Full build, lint, integration, E2E, MCP smoke, and bot verification were not run because they may write generated artifacts, require external services, or mutate a database. No claim of runtime test completion is made.
- Deployment copies under `deploy/` and ignored generated directories were only used as boundary signals, not treated as authoritative source code.

## Prioritized recommendations

1. **P1 — Make tenant context and RLS executable and testable.** Wire request context into the DB session/transaction, review all tenant-owned models/policies, and add two-tenant tests across HTTP, tRPC, and workers.
2. **P1 — Collapse rental webhook ownership to one implementation/outbox contract.** Align producer, processor, replay, retry, and startup wiring, remove the stale poller path, then migrate generic event delivery and replay/signature verification behind the surviving implementation.
3. **P2 — Enforce the intended architecture.** Add import-boundary checks; move route/onboarding orchestration into application services; route production construction through DI; expose explicit cross-domain ports/events.
4. **P2 — Establish stable contracts.** Split pure contracts/domain/database packages, stop importing API source from web/bot, choose/document the canonical transport, and add REST/tRPC parity tests.
5. **P2 — Resolve product vocabulary and ADR status.** Clarify Santi as optional connector or remove it from core registration; document or migrate the Tenant/Company naming decision.
6. **P2 — Close the quality-gate graph.** Include MCP/bot in CI, make E2E fail loudly, use workspace protocol for internal dependencies, and add drift checks for deployment copies.

## Suggested verification commands

Run these in a disposable/test environment where a command can build or mutate state; the first four are read-only/static checks.

```sh
git status --short --branch
rg -n "withCompanyContext|setCompanyContext|current_company" apps packages supabase
rg -n "from ['\"]@sync-erp/database|from ['\"]\.\./.*modules/|new .*Service\(" apps/api/src
node --input-type=module <<'NODE'
import fs from 'node:fs';
const schema = fs.readFileSync('packages/database/prisma/schema.prisma', 'utf8');
const rls = fs.readFileSync('supabase/migrations/20260115_enable_rls.sql', 'utf8');
const models = [...schema.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]);
const enabled = [...rls.matchAll(/ALTER TABLE "([^"]+)" ENABLE ROW LEVEL SECURITY/g)].map((m) => m[1]);
console.log({ models: models.length, rlsEnabled: enabled.length, missing: models.filter((m) => !enabled.includes(m)) });
NODE

for p in apps/api apps/web apps/bot apps/mcp packages/shared packages/database; do
  ./node_modules/.bin/tsc --noEmit --pretty false -p "$p/tsconfig.json" || exit 1
done

# Requires an isolated test database and may mutate it.
DATABASE_URL=postgresql://... npm run test:integration --workspace=@sync-erp/api

# After adding an explicit script; currently the repository has no root test:e2e script.
npm run test:e2e
```
