# Database / Prisma Audit

## Scope & method

This read-only audit covers `packages/database`, the canonical Prisma schema/config/migrations, Supabase migrations, database and application seeds, generated-client handling, selected tenant-sensitive API paths, indexes/constraints, transaction/concurrency paths, CI deployment behavior, and backup/recovery documentation. Representative high-risk files were read in full or by focused line ranges; repository search and read-only Git commands were used to identify duplicate sources and migration history.

Verification performed in the checkout:

- `git status --short --branch`, tracked-file inventory, focused `rg`/`git log`, and `git diff --no-index` comparisons.
- `NODE_ENV=test npx prisma validate --config packages/database/prisma.config.ts` — passed.
- No database mutation, migration application, seed, generated-client write, product-code edit, branch/remote change, commit, or push was performed. No live database catalog, applied-migration table, role, or backup-provider state was available for inspection.

Severity is P1 for a material release, correctness, recovery, or tenant-boundary risk; P2 for a material but more contained hardening or operational risk; P3 for lower-risk hygiene. “Verified” means directly observed in the current tree; impact that depends on runtime role, data, or an untested path is explicitly marked inferred or unknown.

## Current-state map

- **Canonical database package:** `packages/database/prisma/schema.prisma` is PostgreSQL/Prisma 7 configuration with a generated client at `packages/database/src/generated/client` and generated Zod output under `packages/shared/src/generated/zod` (`schema.prisma:1-18`). The schema is a broad multi-company ERP model: `Company` owns sales, purchasing, inventory, finance, rental, billing, attachment, audit, idempotency, and outbox collections (`schema.prisma:20-73`).
- **Configuration/runtime:** `packages/database/prisma.config.ts:4-35` selects `.env`, `.env.production`, `.env.staging`, or `.env.test` from `NODE_ENV`, then falls back to a local PostgreSQL URL if `DATABASE_URL` is absent. `packages/database/src/client.ts:48-75` creates a `pg.Pool`/`PrismaPg` adapter and a non-production singleton with transaction timeouts.
- **Migrations:** The tracked Prisma migration directory contains the later `20260114111531_init` plus subsequent feature migrations, but also a `20250505160000_generalize_webhook_outbox` migration that sorts before the init and references objects created later. `migration_lock.toml` correctly selects PostgreSQL (`migration_lock.toml:1-3`).
- **Supabase:** `supabase/migrations` contains an older Prisma-shaped initialization, two RLS migrations, and an empty remote-commit marker. CI deployment does not run the Supabase CLI; it copies canonical Prisma migrations into the release and executes `prisma migrate deploy` on the remote host (`.github/workflows/ci-cd.yml:111-119`, `:435-437`).
- **Seeds:** `packages/database/prisma/seed.ts` seeds RBAC, demo companies, accounts, products, and integration/API-key data. Additional API/demo seeders exist under `apps/api`. `seed-permissions.sql` is a separate, stale-looking SQL path rather than the typed Prisma seed.
- **Tenant boundary:** API authentication checks `X-Company-Id` membership (`apps/api/src/middlewares/auth.ts:55-105`), and most root models carry `companyId` plus company indexes/unique keys. However, several child relationships are scalar-ID-only, and selected procedures do not pass the authenticated company into their lookup.
- **Recovery:** Backup/restore strategy, RPO/RTO, runbook, and restore drill remain unchecked launch work in the repository (`docs/saas-go-live-checklist.md:68-84`; `docs/saas-launch-tasks.md:90-112`). No checked-in backup/restore automation or verification script was found.

## Findings table

| ID | Severity / confidence | Finding | Primary evidence |
|---|---|---|---|
| DB-01 | **P1 / High** | Prisma migration history is not safe for a fresh deployment. | `20250505160000_generalize_webhook_outbox/migration.sql:1-11` precedes `20260114111531_init` but alters `RentalWebhookOutbox` and references `Integration`; those are created only by later migrations (`20260115025340...:1-30`, `20260314053000...:1-42`). |
| DB-02 | **P1 / High** | Tenant ownership is not enforced across several foreign-key paths and order creation accepts unchecked cross-company IDs. | `schema.prisma:467-512`, `:515-539`, `:857-870`; unchecked `partnerId`/`productId` inputs in `sales-order.service.ts:85-114` and `purchase-order.service.ts:114-147`. |
| DB-03 | **P1 / High** | Two authenticated quantity endpoints omit `companyId` in both router and repository lookup. | `salesOrder.router.ts:108-116`, `purchaseOrder.router.ts:90-99`; repositories filter by `orderId`/type/status only (`sales-order.repository.ts:91-105`, `purchase-order.repository.ts:189-203`). |
| DB-04 | **P1 / Medium-High** | RLS is documented as a tenant boundary but is not wired into application call sites and does not cover the current schema comprehensively. | RLS SQL promises automatic Prisma context (`supabase/migrations/20260115_enable_rls.sql:154-158`); only definitions/re-exports of the helper exist, while `client.ts:95-113` sets a non-local session setting on a separate pooled operation. |
| DB-05 | **P1 / Medium-High** | Transaction boundaries are inconsistent: audit writes use the global Prisma client inside business transactions, and sales confirmation can persist before DP invoice creation. | Global `prisma.auditLog.create` (`audit-log.repository.ts:25-39`) is called inside GRN/shipment transaction callbacks (`inventory-grn.service.ts:167-230`, `inventory-shipment.service.ts:128-203`); sales status/audit/invoice are separate calls (`sales-order.service.ts:254-291`). |
| DB-06 | **P1 / High** | Fulfillment numbering and weighted-average stock updates have concurrency/year-reset hazards. | `inventory.repository.ts:177-198` uses `count + 1` without year/date filtering and `Fulfillment.number` is not unique (`schema.prisma:928-951`); average cost is read then written without a product row lock (`inventory.repository.ts:55-84`). |
| DB-07 | **P2 / High** | Important data invariants rely on application code rather than database constraints. | No `CHECK` declarations were found; `RentalBundle` explicitly says component presence is application-enforced (`schema.prisma:1049-1080`), `RentalOrderItem` has two nullable alternatives without a one-of check (`:1265-1282`), and `SystemConfig` lacks `(companyId,key)` uniqueness (`:803-813`). |
| DB-08 | **P2 / High** | Canonical schema, tracked deployment schema, Supabase history, and ignored generated client can drift. | Canonical vs tracked `deploy/api-mcp/prisma/schema.prisma` diff is 317 changed lines; deploy copy still defaults subscription to `starter` while canonical uses `free`; generated client is ignored (`.gitignore:48-49`) and copied conditionally (`.github/workflows/ci-cd.yml:130-136`). |
| DB-09 | **P1 / High** | Production backup/restore readiness is not evidenced in the repository. | Launch checklist leaves backup, RPO/RTO, restore runbook, drill, and integrity verification unchecked (`docs/saas-go-live-checklist.md:68-84`). |
| DB-10 | **P2 / High** | Seeds are not safely idempotent or fail-closed for production-like execution. | Bcrypt-salted API-key hashes are used as the upsert key (`prisma/seed.ts:576-607`), fallback/default credential literals exist (`:241-249`, `:576-636`), and a finance seeder targets stale `demo-company-001` (`apps/api/scripts/seed-finance-accounts.ts:26-35`). |

## Detailed findings

### DB-01 — Migration history can block a fresh database

**Verified fact.** The timestamped migration `20250505160000_generalize_webhook_outbox` is ordered before `20260114111531_init`, yet its first statement renames `RentalWebhookOutbox` and its later statements add foreign keys to `Integration` (`packages/database/prisma/migrations/20250505160000_generalize_webhook_outbox/migration.sql:1-11`). The init migration is the base schema and does not create those objects; `Integration` is created by `20260115025340_add_integration_module`, and `RentalWebhookOutbox` by `20260314053000_add_rental_webhook_outbox`.

**Impact.** On an empty database, normal timestamp order reaches an `ALTER TABLE`/foreign-key operation before its relation exists, so `migrate deploy` is expected to fail. The current applied state of any staging/production database is **unknown**; it may contain a legacy baseline that masks the problem. This is a release blocker for a new environment and a migration-history integrity risk for existing environments.

**Recommendation.** Before the next deploy, inspect `_prisma_migrations` in each environment and reproduce `migrate deploy` against a disposable empty PostgreSQL instance. Choose and document one recovery path—an explicit baseline plus forward migrations, or a new corrected migration chain—without editing an already-applied migration in place. Add an empty-database and upgrade-from-production-snapshot migration gate to CI.

### DB-02 — Scalar foreign keys do not prove same-company ownership

**Verified fact.** `Order` stores `companyId` and `partnerId`, but the relation is only `partnerId -> Partner.id`; `OrderItem` similarly links only `productId -> Product.id` (`packages/database/prisma/schema.prisma:467-512`). `InventoryMovement` carries its own `companyId` while linking product, order, fulfillment, and warehouse by independent scalar IDs (`:515-539`). `StockLayer` has no `companyId` at all (`:857-870`). Similar child paths exist in rental units and rental order items (`:1095-1140`, `:1265-1298`).

The sales and purchase order services intentionally use `Prisma.OrderUncheckedCreateInput` and copy caller-supplied partner/product IDs without a same-company lookup (`apps/api/src/modules/sales/sales-order.service.ts:85-114`; `apps/api/src/modules/procurement/purchase-order.service.ts:114-147`). The shared validators check UUID/shape, not ownership (`packages/shared/src/validators/index.ts:102-117`; `packages/shared/src/validators/p2p.ts:19-30`).

**Impact.** An authenticated caller who obtains another company’s UUID can potentially create a company-A order linked to company-B records; downstream joins, inventory movements, billing, and audit trails then contain contradictory ownership. The exploitability of UUID discovery is an **inferred risk**, but the absence of a database or service ownership check is verified.

**Recommendation.** Make every referenced-record validation use `{ id, companyId }` inside the same transaction before create/update/post. For high-value paths, add composite tenant keys/foreign keys or an equivalent repository boundary so an invalid cross-company link is rejected by PostgreSQL, then run a one-time orphan/mismatch query before enforcing constraints. Include adversarial two-company tests for create, post, fulfillment, invoice, payment, rental assignment, and attachment flows.

### DB-03 — Quantity lookup procedures are cross-tenant readable by ID

**Verified fact.** `getShippedQuantities` and `getReceivedQuantities` accept only a UUID and the router callbacks ignore `ctx.companyId` (`apps/api/src/trpc/routers/salesOrder.router.ts:108-116`; `apps/api/src/trpc/routers/purchaseOrder.router.ts:90-99`). Their repositories query `FulfillmentItem` through a matching `orderId`, type, and status but do not constrain the fulfillment/order company (`apps/api/src/modules/sales/sales-order.repository.ts:91-105`; `apps/api/src/modules/procurement/purchase-order.repository.ts:189-203`). `protectedProcedure` authenticates the user/company context, but that context is not passed to these calls.

**Impact.** A user in company A can supply a known order UUID from company B and receive product IDs and shipped/received quantities. This is a verified tenant-boundary gap, even if the response is aggregate rather than a full order record.

**Recommendation.** Require `ctx.companyId`, verify the parent order with `{ id: orderId, companyId }`, and keep the company predicate in the repository query. Add a regression test that calls each procedure with a foreign order ID and asserts a not-found/authorization error.

### DB-04 — RLS intent is not a verified runtime control

**Verified fact.** The first Supabase RLS migration enables RLS and deliberately creates no policies, relying on backend-only Prisma access (`supabase/migrations/20260114112540_enable_rls.sql:1-3`, `:66-67`). The second migration creates policies for only a subset of tables and says Prisma middleware will set `app.current_company` automatically (`supabase/migrations/20260115_enable_rls.sql:8-26`, `:33-144`, `:154-158`). In the application, `withCompanyContext` and `setCompanyContext` are only defined/re-exported; repository search found no business call sites. Moreover, `withCompanyContext` runs `set_config(..., false)` in one global Prisma operation and then invokes the callback separately (`packages/database/src/client.ts:95-113`), so a pooled callback can use a different connection and the session setting is not transaction-local.

Current-schema tables added after those migrations (for example Integration, billing, attachments, and both webhook outboxes) have no corresponding RLS policy in this directory. Whether the runtime Prisma role owns the tables or has `rolbypassrls` is **unknown**; that state determines whether missing context causes denial or bypasses the intended policy.

**Impact.** The repository cannot currently prove either “RLS protects all tenant data” or “Prisma safely supplies the RLS context.” The control is therefore not reliable defense-in-depth for a multi-tenant system.

**Recommendation.** Choose one authoritative isolation design. If RLS is retained, set context with `SET LOCAL`/`set_config(..., true)` on the exact transaction client, pass that client through repositories, add policies (including `WITH CHECK`) for every tenant table, and verify the actual runtime role with `FORCE ROW LEVEL SECURITY` where appropriate. If explicit application scoping is authoritative, remove stale/misleading assumptions and enforce it with centralized repositories and adversarial tests.

### DB-05 — Business transactions and audit/invoice side effects are not consistently atomic

**Verified fact.** GRN and shipment posting use interactive transaction callbacks (`apps/api/src/modules/inventory/inventory-grn.service.ts:167-218`; `apps/api/src/modules/inventory/inventory-shipment.service.ts:128-191`), but their `recordAudit` calls reach a repository that imports and writes through the global `prisma` client, not the callback’s `t` client (`apps/api/src/modules/inventory/inventory-grn.service.ts:220-230`; `apps/api/src/modules/inventory/inventory-shipment.service.ts:193-203`; `apps/api/src/modules/common/audit/audit-log.repository.ts:25-39`). Separately, sales confirmation updates status, writes audit, and only then creates a DP invoice as separate operations (`apps/api/src/modules/sales/sales-order.service.ts:254-291`).

**Impact.** If a later operation fails, an order can remain `CONFIRMED` without its required DP invoice. An audit row can commit even if the business transaction rolls back, or can fail independently due to connection/RLS state. The exact failure frequency is **inferred**, but the separate clients and calls are verified.

**Recommendation.** Make audit recording explicitly transaction-aware: either pass `Prisma.TransactionClient` through the audit repository or intentionally record business intent before a separately tracked saga. For status-plus-invoice workflows, use one transaction with idempotency and a clear retry policy. Add fault-injection tests that fail after each side effect and assert the intended atomic outcome.

### DB-06 — Fulfillment numbers and average cost are race-prone

**Verified fact.** `generateFulfillmentNumber` counts all fulfillments for a company/type and returns `count + 1`; it computes a year but does not filter the count by year/date (`apps/api/src/modules/inventory/inventory.repository.ts:177-198`). `Fulfillment.number` has no unique constraint (`packages/database/prisma/schema.prisma:928-951`). This bypasses the otherwise stronger atomic `DocumentSequence` upsert (`apps/api/src/modules/common/services/document-number.service.ts:109-153`; `schema.prisma:815-825`).

For weighted average cost, `createStockMovement` reads `stockQty`/`averageCost`, computes a new value, and later writes it; no product row lock or optimistic predicate is visible (`apps/api/src/modules/inventory/inventory.repository.ts:55-84`). GRN posting calls this within a transaction, but concurrent GRNs for the same product are not serialized (`apps/api/src/modules/inventory/inventory-grn.service.ts:179-197`).

**Impact.** Concurrent receipts can produce duplicate fulfillment numbers, and the current count also prevents a true year reset. Concurrent inbound movements can atomically increment quantity while the last stale average-cost write wins, causing inventory valuation/accounting drift. These are high-confidence code-level risks; occurrence under the production workload is **unknown**.

**Recommendation.** Replace count-based numbering with the atomic sequence service or a database sequence/upsert keyed by company/type/period, and enforce uniqueness on the resulting business number. Lock the product row with `FOR UPDATE` in the same transaction, or use an atomic weighted-average update with serializable/retry semantics. Add two-session concurrency tests for same-company same-product GRNs and same-type fulfillments.

### DB-07 — Database constraints leave material invariants to application code

**Verified fact.** No `CHECK`/`EXCLUDE` declarations were found in the canonical schema or tracked Prisma/Supabase migration SQL. The schema explicitly documents bundle component presence as application-enforced (`packages/database/prisma/schema.prisma:1049-1080`); `RentalOrderItem` permits both `rentalItemId` and `rentalBundleId` to be null or both set, with no one-of constraint (`:1265-1282`). `SystemConfig` has only a company index, while seed/company-service code does `findFirst` then create/update (`schema.prisma:803-813`; `packages/database/prisma/seed.ts:651-669`; `apps/api/src/modules/company/company.service.ts:219-240`). `Attachment.entityId` is polymorphic and has no foreign key to the declared entity (`schema.prisma:614-634`).

**Impact.** Retries or concurrent requests can create duplicate configuration rows; malformed rental items, negative values, orphan attachments, or mismatched polymorphic targets can survive a service bug or backfill. Existing application validation is useful but is not a concurrency-safe integrity boundary.

**Recommendation.** Add targeted database constraints after a data audit: unique `(companyId,key)` for `SystemConfig`, positive quantity/amount checks, exactly-one rental item/bundle checks, and tenant-consistent composite references where feasible. For attachments, use typed join tables or a transactionally validated target registry. Keep service validation for user-facing errors.

### DB-08 — Multiple schema sources and ignored generated output can drift

**Verified fact.** The tracked `deploy/api-mcp/prisma/schema.prisma` is materially different from the canonical schema: `git diff --no-index --stat` reports 317 changed lines (110 insertions, 207 deletions). It retains a `starter` subscription default while canonical schema uses `free`, and omits canonical relations/models such as attachments in the corresponding sections. CI mitigates its own artifact path by copying the canonical schema and migrations (`.github/workflows/ci-cd.yml:111-119`), but the duplicate remains a manual-deploy and review hazard.

The generated Prisma client directory is ignored (`.gitignore:48-49`), while `packages/database/src/index.ts:1-6` imports it directly. CI copies it only if it exists (`.github/workflows/ci-cd.yml:130-136`); root postinstall/Turbo regenerate it (`package.json:18-19`; `turbo.json:16-18`, `:46-48`).

**Impact.** A non-CI build, partial artifact, or stale local generated client can compile/run against a schema different from the migrations. The current CI path is better controlled, but no schema/generated-client hash gate proves that all release paths agree.

**Recommendation.** Establish one schema source of truth, remove or mechanically verify the tracked deployment duplicate, and add CI checks for schema equality plus generated-client freshness. Make release assembly fail if generated output is absent or stale rather than conditionally copying it.

### DB-09 — Backup and restore are roadmap items, not an evidenced capability

**Verified fact.** The repository contains no checked-in `pg_dump`, `pg_restore`, snapshot/PITR job, retention policy, restore script, or restore verification. The launch checklist still marks daily backup, RPO/RTO, staging restore runbook, full restore drill, and post-restore integrity checks as incomplete (`docs/saas-go-live-checklist.md:68-84`); the launch tasks say the same (`docs/saas-launch-tasks.md:90-112`).

**Impact.** Production data-loss exposure, recovery point, recovery time, ownership, and evidence of a usable restore are unknown. Provider-native backups may exist outside this checkout, but they are not documented or verifiable here.

**Recommendation.** Before production reliance, document encrypted backups, retention, access controls, RPO/RTO, and alert ownership; automate or schedule them through the provider; and perform a staging restore drill. Validate row counts, foreign keys, tenant mismatch queries, journal balance, inventory non-negativity, and application startup from the restored database.

### DB-10 — Seed behavior can duplicate keys or install unsafe defaults

**Verified fact.** The Prisma seed hashes a fixed API-key literal with a new bcrypt salt on every run, then uses the resulting hash as the unique upsert key (`packages/database/prisma/seed.ts:576-607`; `schema.prisma:224-252`). Because a new bcrypt hash is different each run, the normal upsert path does not identify the prior key; repeated runs can create additional keys. The seed also has a default admin password and non-empty development/placeholder API/webhook credential fallbacks (`seed.ts:241-249`, `:576-636`). The Santi Living seeder repeats the salted-hash pattern and test webhook secret (`apps/api/src/integrations/santi-living/seed.ts:30-100`). A separate finance seeder still targets `demo-company-001`, while the main seed creates `demo-company-rental` and `demo-company-retail` (`apps/api/scripts/seed-finance-accounts.ts:26-35`; `packages/database/prisma/seed.ts:265-277`).

**Impact.** Re-running seeds can accumulate active API keys, and a missing production secret can silently create a known/default credential. The stale company ID makes operational seeding incomplete or misleading. This is a verified code risk; whether production seeds have been run with fallback values is **unknown**.

**Recommendation.** Split disposable fixtures from production bootstrap. Require explicit production secrets and fail closed; identify an existing key by a stable company/integration/name or securely supplied key ID, not by a fresh bcrypt hash; make the operation transactional and idempotent. Align demo IDs or remove stale scripts, and add a seed repeatability test.

## Strengths

- The canonical schema has useful company-scoped indexes and uniqueness for many core aggregates: company membership, product SKU, account code, warehouse code, document sequences, rental unit code, and rental order numbers (`schema.prisma:393-405`, `:439-465`, `:693-716`, `:815-843`, `:1095-1140`, `:1142-1208`).
- Authentication resolves and checks the selected company membership before exposing the request context (`apps/api/src/middlewares/auth.ts:55-105`), and many repositories consistently include `companyId` in their primary lookups.
- High-value inventory/order posting paths use interactive transactions and explicit order-state locking (`apps/api/src/modules/sales/sales-order.service.ts:297-398`; `apps/api/src/modules/procurement/purchase-order.service.ts:382-488`; GRN/shipment paths cited above).
- Idempotency and optimistic-locking infrastructure exists, including a company/scope index and dedicated integration tests for concurrent idempotency and stale versions (`schema.prisma:873-887`; `apps/api/test/integration/idempotency.test.ts`; `optimistic-lock.test.ts`).
- CI verifies required deployment secrets/project identity and runs `migrate deploy` before stopping the old API process (`.github/workflows/ci-cd.yml:260-277`, `:435-437`), which limits downtime on migration failure.
- The current Prisma schema passes `prisma validate` under the test environment. Multi-company isolation tests and accounting/inventory invariant tests are present (`apps/api/test/integration/data-isolation.test.ts:18-180`; `apps/api/test/invariants/accounting.test.ts:1-34`; `inventory.test.ts:1-29`).

## Gaps/unknowns

- The applied migration state, database contents, actual indexes/constraints, RLS policy catalog, table ownership, and runtime role `rolbypassrls` were not inspected; these require a read-only connection to each environment.
- No evidence confirms whether the malformed pre-init migration is already recorded as applied in staging/production or whether a legacy baseline differs from this checkout.
- No backup provider configuration, retention logs, restore artifact, RPO/RTO owner, or completed restore drill is present in the repository.
- CI integration setup uses `db:push`, not `migrate deploy` (`.github/workflows/ci-cd.yml:92-105`), so normal CI does not exercise migration ordering. The E2E job also treats a missing suite as a successful placeholder and has `continue-on-error: true` (`.github/workflows/e2e-playwright.yml:52-68`).
- Existing isolation tests cover list/create behavior for products, partners, purchase orders, and accounts, but do not cover foreign-ID creation, the two quantity procedures, RLS with the production role, concurrent weighted-average updates, duplicate fulfillment numbering, or restored-database integrity.
- During the audit, a concurrent/unrelated modification to `apps/web/playwright-report/index.html` was observed, along with other audit-directory content. Those changes were preserved and are not attributed to this report.

## Prioritized recommendations

1. **P1 release gate — reconcile migrations.** Inspect `_prisma_migrations` in every environment; reproduce fresh and upgrade deploys; document a baseline/forward-only repair; make both scenarios mandatory CI checks.
2. **P1 tenant boundary — close the two direct leaks first.** Pass `ctx.companyId` through quantity procedures and validate all order partner/product IDs by company in a transaction. Then inventory-scan all scalar child references and add composite constraints or centralized guards.
3. **P1 isolation design — make RLS either real or explicitly non-authoritative.** Verify runtime role/policies, use transaction-local context on the exact Prisma transaction client, cover new tables, and test cross-company reads/writes with the deployed role.
4. **P1 transaction/inventory correctness.** Make audit semantics transaction-aware; atomically couple status and invoice side effects; replace fulfillment `count + 1`; serialize weighted-average updates; add fault-injection and two-session concurrency tests.
5. **P1 recovery readiness.** Establish backup/retention/RPO/RTO ownership, a restore runbook, and a successful staging restore drill with financial/inventory/tenant integrity checks.
6. **P2 constraints and seed hardening.** Add `SystemConfig` uniqueness and targeted checks, remove polymorphic integrity gaps where practical, fail closed for production seed secrets, and make repeated seeding deterministic.
7. **P2 source-of-truth/build hygiene.** Remove or continuously diff the deployment schema, validate Supabase history against the canonical Prisma history, and fail artifact assembly when generated client output is absent or stale.

## Suggested verification commands

Run the following against an isolated/test database or read-only replica unless explicitly marked as a disposable migration test; do not point mutation commands at production.

```sh
# Repository and source-of-truth checks
git status --short --branch
git ls-files packages/database/prisma supabase/migrations deploy/api-mcp/prisma
git diff --no-index --stat -- packages/database/prisma/schema.prisma deploy/api-mcp/prisma/schema.prisma || true
rg -n -i 'check|exclude|deferrable|constraint' packages/database/prisma supabase/migrations

# Prisma validation/status (status should use an isolated/read-only connection)
NODE_ENV=test npx prisma validate --config packages/database/prisma.config.ts
NODE_ENV=test npx prisma migrate status --config packages/database/prisma.config.ts

# Applied migration and RLS catalog checks; do not print DATABASE_URL itself
psql "$DATABASE_URL" -XAtc \
  'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at;'
psql "$DATABASE_URL" -XAtc \
  'SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname = '\''public'\'' ORDER BY c.relname;'
psql "$DATABASE_URL" -XAtc \
  'SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = '\''public'\'' ORDER BY tablename, policyname;'
psql "$DATABASE_URL" -XAtc \
  'SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;'

# Data-integrity reconnaissance
psql "$DATABASE_URL" -XAtc \
  'SELECT o.id, o."companyId", p."companyId" FROM "Order" o JOIN "Partner" p ON p.id=o."partnerId" WHERE o."companyId" <> p."companyId" LIMIT 100;'
psql "$DATABASE_URL" -XAtc \
  'SELECT "companyId", "key", count(*) FROM "SystemConfig" GROUP BY "companyId", "key" HAVING count(*) > 1;'
psql "$DATABASE_URL" -XAtc \
  'SELECT f."companyId", f."type", f."number", count(*) FROM "Fulfillment" f GROUP BY f."companyId", f."type", f."number" HAVING count(*) > 1;'

# Tests that should be expanded/verified
npm run test:integration --workspace=@sync-erp/api -- --run data-isolation.test.ts idempotency.test.ts optimistic-lock.test.ts

# Disposable empty-database migration smoke test only:
# create a fresh PostgreSQL database, set DATABASE_URL to it, then run:
DATABASE_URL="$EMPTY_DATABASE_URL" npx prisma migrate deploy --config packages/database/prisma.config.ts
```
