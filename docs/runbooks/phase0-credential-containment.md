# Phase 0 — Credential Containment Runbook

**Priority:** P0 security containment
**Scope:** Sync ERP repository, CI/CD, runtime deployments, integrations, and operator workstations
**Runtime baseline:** Node `22.12.0`
**Rule:** This runbook is value-free. Never copy a credential, cookie, session identifier, connection string, QR payload, or raw log line containing one into Git, chat, tickets, screenshots, or evidence.

This runbook is for the current exposure described in the [repository audit](../audits/2026-08-09-full-repository-audit/FULL-REPOSITORY-AUDIT.md): the public Git tree/history contains tracked environment files and credential-like deployment artifacts. Treat every non-placeholder value in those locations as compromised until its owner proves otherwise. Deleting the current file does not revoke a credential and does not remove historical blobs.

## 1. Stop conditions and operating rules

Stop and escalate to the Incident Lead if any of these are true:

- the owner of a credential, production database, WhatsApp account, payment account, OAuth client, or deployment account is unknown;
- a rotation would destroy queued work, WhatsApp auth state, sessions, webhook deliveries, or database access without a tested replacement;
- an operator cannot identify production versus staging with an authoritative provider-side identifier;
- an old credential still authenticates after revocation, or access logs show unexplained use;
- a proposed cleanup would rewrite shared history, delete provider artifacts, flush Redis, delete sessions, or remove evidence.

Use a restricted incident case for evidence. Record timestamps in UTC and use role names rather than credential values.

Safe shell preamble for operator sessions:

```sh
set +x
set -euo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0
EVIDENCE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/sync-erp-containment.XXXXXX")"
chmod 700 "$EVIDENCE_DIR"
```

Never run `set -x`, `env`, `printenv`, `cat`/`less` on an environment file, `git show`/`git log -p` over suspect files, `unzip -p`, verbose HTTP tracing, or a command that places a credential in an argument, URL, process title, shell history, or CI output. Use the provider secret manager, masked CI variables, an interactive hidden prompt, or a 0600 file outside the repository. Do not use `ps eww` or equivalent on a host handling secrets. Do not use service configuration diagnostics that print secret suffixes (a masked suffix is still sensitive); redact any such existing output before retaining evidence.

## 2. Ownership matrix

The Incident Lead assigns named people to these roles before rotation begins. One person may hold more than one role only if the case records the conflict.

| Workstream | Accountable owner | Required operator | Required evidence / approval |
|---|---|---|---|
| Incident command, severity, timeline, decisions | Security / Incident Lead | Incident coordinator | Case ID, UTC timeline, go/no-go decisions |
| Repository, GitHub settings, branch protection, history remediation | Repository owner / GitHub administrator | Git operator | Written history-rewrite approval; collaborator acknowledgements |
| Hostinger, Vercel, CI/CD, SSH/deploy credentials | Platform / deployment owner | Platform operator | Secret-version references, deployment SHA, smoke results |
| PostgreSQL/Supabase, backups, roles, migrations | Database owner | DBA or platform operator | Backup/restore evidence, old-role denial, connection audit |
| Redis, namespaces, queues, Baileys persistence | API/platform owner | Redis operator | ACL rotation, namespace decision, no unintended flush |
| API, MCP, internal service credentials, API keys | API owner | API operator | Key inventory, revocation result, least-privilege smoke |
| WhatsApp/Baileys bot and linked devices | Bot/integration owner | Bot operator | Logout/re-pair record, linked-device review, QR access review |
| Web, session/cookie behavior, Google OAuth | Web/auth owner | Web/auth operator | OAuth callback test, session invalidation result, cookie checks |
| Billing, tenant webhooks, external storefront, email | Integrations owner | Provider operator | Provider rotation and signed/invalid webhook tests |
| Customer, legal, regulatory, and support communications | Business / communications owner | Communications operator | Approved message, recipient list, disclosure decision |
| Evidence custody and redaction QA | Evidence custodian | Security operator | Hashes, access list, redacted reports, retention decision |

## 3. Phase gates

Do not mark a gate complete from a configuration-file edit alone. Each gate needs provider-side or runtime evidence.

| Gate | Required before proceeding | Evidence |
|---|---|---|
| G0 — Contain | Deploy/push freeze announced; owners assigned; evidence location created; exposure window defined | Case entry and acknowledgement from Incident Lead |
| G1 — Inventory | Every key/path/consumer has an owner and environment; no value captured | Value-free inventory and owner sign-off |
| G2 — Rotate | Replacement credentials exist in the approved secret store; deploy window and rollback plan approved | Secret-version references, not values |
| G3 — Verify | New credentials work; old credentials fail; access logs are reviewed; staging then production smoke passes | Provider events, status codes, timestamps, deployment SHA |
| G4 — Clean | Only after G3: current-tree/artifact cleanup, CI/provider artifact cleanup, and scanner configuration | Cleanup manifest and scan report |
| G5 — Rewrite | Only after written approval in §10; collaborators are frozen and have a re-clone plan | Approval record, mirror SHA map, post-rewrite scan |

## 4. Value-free inventory

The following is the known repository/runtime inventory. Extend it from provider dashboards and deployment manifests without recording values.

### 4.1 Files, archives, and runtime locations

| Location | Exposure/consumer | Action |
|---|---|---|
| `apps/api/.env.production`, `apps/api/.env.staging` | API runtime configuration | Treat all secret-looking values as compromised; rotate before removal |
| `apps/bot/.env.production`, `apps/bot/.env.staging` | Bot runtime configuration | Rotate bot/API/Redis consumers before removal |
| `apps/web/.env.production`, `apps/web/.env.staging` | Vite/Vercel public build configuration | Verify only public `VITE_*` values are present; never put a secret in a `VITE_*` variable |
| `packages/database/.env.production`, `packages/database/.env.staging` | Prisma/scripts/database tooling | Rotate database and seed-admin credentials; do not run data scripts as a substitute for rotation |
| `apps/*/.env.example`, `packages/database/.env.example` | Templates | Keep names only and placeholders only; scan before publishing |
| `cookies.txt` | Browser/WhatsApp web artifact | Treat as session compromise; revoke affected sessions/accounts before cleanup |
| `deploy/api.zip`, `deploy/bot.zip` | Tracked deployment archives; each contains an `.env` member | Treat archive contents as exposed; remove the archives only after rotation and evidence capture |
| Hostinger `public_html/apps/api/.env`, `public_html/apps/api-staging/.env` | API runtime secrets | Rotate in the host secret store/file with mode `0600`; never print the file |
| Hostinger `public_html/apps/mcp/.env`, `public_html/apps/mcp-staging/.env` | MCP runtime bearer token | Rotate and verify MCP clients before cleanup |
| GitHub Actions repository/environment secrets and artifacts | CI/CD and deployment | Inventory names, retention, access, and logs; rotate affected secrets and delete only after evidence retention is approved |
| Vercel project/environment variables and deployment logs | Web build/deployment | Audit environment changes and logs; confirm no secret was embedded in a build |
| Local clones, worktrees, shell history, editor caches, CI workspaces | Human/operator copies | Quarantine; do not share or push; use fresh clones after any history rewrite |

### 4.2 Key names and secret-bearing data fields

Values are intentionally omitted. A key may be public configuration in one environment and sensitive in another; the owner decides, but the following groups are the minimum review set.

| Group | Key names / fields to inventory |
|---|---|
| Database and seed access | `DATABASE_URL`; `SEED_ADMIN_EMAIL`; `SEED_ADMIN_PASSWORD`; provider database roles, service keys, pooler credentials, backups, and connection profiles |
| Redis and bot persistence | `REDIS_URL`; `REDIS_KEY_PREFIX`; Redis ACL users/tokens; the Baileys `${REDIS_KEY_PREFIX}*` namespace, including the `creds` key |
| API and internal service authentication | `SYNC_ERP_API_SECRET`; `SYNC_ERP_BOT_SECRET`; `SYNC_ERP_AUTH_STATE_SECRET`; `SYNC_ERP_MCP_BEARER_TOKEN`; `SYNC_ERP_MCP_BEARER_TOKENS`; `MCP_BEARER_TOKEN`; `PROXY_API_KEY`; `PROXY_API_SECRET`; `SYNC_ERP_MCP_PASSWORD`; `NINE_ROUTER_TUNNEL_API_KEY` |
| External API and email | `RESEND_API_KEY`; `MIDTRANS_CLIENT_KEY`; `MIDTRANS_SERVER_KEY`; any provider API keys in CI, Vercel, Hostinger, or dashboards |
| Billing and inbound integration webhooks | `BILLING_WEBHOOK_SECRET`; `SANTI_LIVING_WEBHOOK_API_KEY`; provider webhook signing secrets; payment notification credentials; `ApiKey.webhookSecret`; `TenantWebhookOutbox.webhookSecret` |
| OAuth | `GOOGLE_OAUTH_CLIENT_ID`; `GOOGLE_OAUTH_CLIENT_SECRET`; `GOOGLE_OAUTH_REDIRECT_URI`; provider-side client versions, refresh/access tokens, consent grants, and callback registrations |
| Session and browser security | API cookie `sessionId`; CSRF cookie/header `csrf-token` / `x-csrf-token`; `Session` rows; auth-state material governed by `SYNC_ERP_AUTH_STATE_SECRET`; browser profiles and `cookies.txt` |
| Deployment access | GitHub Actions secret names `DATABASE_URL`, `DATABASE_URL_STAGING`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `HOSTINGER_HOST`, `HOSTINGER_SSH_KEY`, `HOSTINGER_SSH_PASSPHRASE`, `HOSTINGER_USER`, `SYNC_ERP_AUTH_STATE_SECRET`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_WEB`, and `GITHUB_TOKEN` permissions |
| Public web configuration | `VITE_SYNC_ERP_API_URL`, `VITE_SENTRY_DSN`, and other `VITE_*` values are build-visible, not a secret store. Rotate only if a provider confirms misuse; never place a private credential there |

Repository-specific loading paths are documented in [`apps/api/src/env.ts`](../../apps/api/src/env.ts) and [`apps/bot/src/env.ts`](../../apps/bot/src/env.ts). Database/session/webhook field names are in [`packages/database/prisma/schema.prisma`](../../packages/database/prisma/schema.prisma).

## 5. Containment and evidence capture

1. Announce **G0**. Freeze merges, pushes, automated deploys, ad-hoc production scripts, and provider credential changes that are not part of this incident. Keep public service availability decisions with the Incident Lead.
2. Preserve the first evidence snapshot outside the repository. These commands print names, refs, and metadata only:

   ```sh
   git rev-parse --show-toplevel > "$EVIDENCE_DIR/repository-root.txt"
   git status --short --untracked-files=all > "$EVIDENCE_DIR/worktree-status.txt"
   git ls-files > "$EVIDENCE_DIR/tracked-paths.txt"
   git ls-files | rg -i '(^|/)(\.env($|\.)|cookies|deploy/.*\.(zip|tgz)|.*(secret|credential|token|private|\.key|\.pem|\.p12))' > "$EVIDENCE_DIR/suspect-paths.txt" || true
   git log --all --date=iso-strict --format='%H %cI' -- \
     apps/api/.env.production apps/api/.env.staging \
     apps/bot/.env.production apps/bot/.env.staging \
     apps/web/.env.production apps/web/.env.staging \
     packages/database/.env.production packages/database/.env.staging \
     cookies.txt deploy/api.zip deploy/bot.zip > "$EVIDENCE_DIR/suspect-history-metadata.txt"
   git rev-list --objects --all -- \
     apps/api/.env.production apps/api/.env.staging \
     apps/bot/.env.production apps/bot/.env.staging \
     apps/web/.env.production apps/web/.env.staging \
     packages/database/.env.production packages/database/.env.staging \
     cookies.txt deploy/api.zip deploy/bot.zip > "$EVIDENCE_DIR/suspect-objects.txt"
   ```

3. Record the earliest known exposure commit, current public ref, deployment versions, provider project IDs, and first/last log timestamps. Record hashes and IDs, never payloads.
4. Capture provider audit exports through their redacted/export controls. Restrict the case directory and record who accessed it. If a raw export contains a credential, quarantine it and do not attach it to the ticket.
5. Disable or restrict the minimum exposed public surface if the owner can do so safely: QR/status exposure, credential-test endpoints, webhook replay/test endpoints, and administrative routes. This is a containment decision, not a code change in this runbook.

## 6. Rotation order

The order below prevents a replacement from being deployed against a dead dependency. For every value, prepare or enable the replacement and test it with an isolated client, update and restart every consumer, run positive and negative checks, then revoke the old value. If a provider has no dual-credential overlap, use a declared maintenance window and an owner-approved, tested backout path; never revoke first and discover an unupdated consumer afterward. Use separate staging and production records. Do not rely on a green file diff as proof of rotation.

### 6.1 Database first

1. DBA identifies every production/staging role, pooler, service key, backup/export credential, CI secret, Hostinger variable, Vercel variable, and local operator connection profile that can reach the database.
2. Create a new least-privilege credential and store it in the approved secret manager. Confirm backup/restore access separately; do not reuse an application credential for backups.
3. Update all consumers atomically or during a declared maintenance window: API, bot if it uses the database, MCP/API deployment package, CI migration job, and approved operator profiles. Keep the old value only for the minimum overlap required by the provider.
4. Run a read-only connection test through a service name or secret-manager injection; do not put the connection string in a shell argument or log. Check application startup, migrations, and a synthetic tenant read/write flow.
5. Revoke the old role/password/service key and verify an old-credential denial from a controlled test. Review database connection/audit logs from first exposure through the test.

Do not run `DROP ROLE`, broad `REVOKE`, destructive SQL, or a migration rollback from this runbook without DBA and Incident Lead approval and a tested restore point.

### 6.2 Redis second

1. Create or enable the replacement Redis ACL password/token or provider credential, and test it with an isolated client. Do not remove or disable the old credential yet. Update `REDIS_URL` and, where applicable, the ACL user in the secret manager for every API/bot/MCP consumer.
2. Restart consumers in a controlled order. If overlap is unavailable, pause the affected queues and use the declared maintenance window so all consumers switch together. Verify API rate limiting, queue/outbox processing, bot startup, and Redis TLS/authentication without printing connection details.
3. Because the bot stores Baileys auth state in Redis, decide explicitly whether the namespace is trusted. If compromise is possible, use the bot’s controlled logout/re-pair operation or delete only the exact environment namespace after approval. Never use `FLUSHALL` or an unscoped `FLUSHDB`.
4. Verify the old Redis credential fails, the new client sees only its expected namespace, and the bot has either retained a trusted session or completed a private re-pair.

### 6.3 API and integration credentials third

Rotate and redeploy the server-side values below, using independent values per environment and consumer:

- `SYNC_ERP_API_SECRET`, `SYNC_ERP_BOT_SECRET`, and `SYNC_ERP_AUTH_STATE_SECRET`;
- `SYNC_ERP_MCP_BEARER_TOKEN`, `SYNC_ERP_MCP_BEARER_TOKENS`, `MCP_BEARER_TOKEN`, `PROXY_API_KEY`, and `PROXY_API_SECRET`;
- `RESEND_API_KEY`, `NINE_ROUTER_TUNNEL_API_KEY`, and any provider API keys found during inventory;
- GitHub deploy/SSH credentials and Vercel credentials if they were present in the exposed scope.

Deploy the API/MCP/bot consumers before revoking old service credentials where dual-key overlap is supported. `SYNC_ERP_API_SECRET` is the bot-to-API credential, while `SYNC_ERP_BOT_SECRET` is the API-to-bot and bot inbound credential; prepare matching replacements on both sides and verify both directions. If either side has no overlap support, update/restart both services in one approved maintenance window before revocation. For database-backed client API keys, issue replacement keys, test the least-privilege operation, then call the normal revoke path so the old `ApiKey.isActive` state is false. Never attempt to recover a key from `keyHash`; the raw key is not supposed to be retrievable.

### 6.4 Bot and WhatsApp session fourth

1. Complete the paired `SYNC_ERP_API_SECRET`/`SYNC_ERP_BOT_SECRET` change described in §6.3, deploy/restart both API and bot as one coordinated change when overlap is unavailable, and verify authenticated status/ping/send/logout behavior with a synthetic test recipient. Keep the old pair active until both directions pass, then revoke it.
2. Review bot access logs and linked WhatsApp devices. Log out unknown devices and use the controlled bot logout/re-pair flow if the Redis auth state may have been exposed.
3. Generate a new QR only in a private, authenticated operator channel. Confirm an unauthenticated status request cannot return a QR, auth state, or internal configuration.
4. Record the new linked-device identity and the old-session invalidation result without recording QR data or cookies.

### 6.5 Webhook and billing secrets fifth

Cover both environment-level secrets and tenant/provider records:

- `BILLING_WEBHOOK_SECRET`, `MIDTRANS_SERVER_KEY`, and related payment notification credentials;
- `SANTI_LIVING_WEBHOOK_API_KEY` and external storefront credentials;
- `ApiKey.webhookSecret`, `TenantWebhookOutbox.webhookSecret`, integration webhook secrets, and any provider-side signing secret.

Before switching or removing a tenant webhook secret, pause the delivery worker and inventory `PENDING`, `FAILED`, and `PROCESSING` rows. `TenantWebhookOutbox` stores the URL and secret snapshot per delivery, so either let queued old-secret deliveries drain while the receiver accepts both values, or have the owner approve a bounded update of only the affected pending/failed rows before resuming; never discard the outbox or rewrite all rows. Record queue counts, redrive/dead-letter results, and the final `ApiKey.webhookSecret`/outbox state.

For a provider that supports overlap, make the receiver accept the new secret, switch the provider sender, send a signed test, then remove the old secret. If overlap is not supported, schedule the provider switch and receiver deployment as one window; pause/retry queues rather than accepting unsigned traffic. Verify a valid signature succeeds and an altered/old signature fails. Do not replay production payment/webhook events unless the Integrations owner approves the exact event IDs.

### 6.6 OAuth sixth

1. Create a new Google OAuth client secret for each environment or rotate the existing secret through the provider. Update `GOOGLE_OAUTH_CLIENT_SECRET` and verify `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_REDIRECT_URI` still point to the correct environment.
2. Test a new login and callback in staging, then production. Check state validation, account linking, failure handling, and that no callback URL or authorization code is logged.
3. Revoke exposed refresh/access tokens and review consent/audit events if provider evidence indicates use. Do not delete `OAuthAccount` rows merely to force re-login without Web/Auth owner and Incident Lead approval.

### 6.7 Sessions and cookies last

1. Deploy the new auth-state/session configuration and force reauthentication for all existing sessions. Use the application’s session deletion path or a reviewed, bounded database operation; do not copy session IDs into evidence.
2. Invalidate `sessionId` cookies and issue fresh `csrf-token` values. Confirm `x-csrf-token` enforcement on mutating requests and that `Secure`, `HttpOnly`, `SameSite`, domain, and expiry attributes match the environment.
3. Treat every session in `cookies.txt`, browser profiles, CI artifacts, screenshots, and support exports as revoked. Rotate operator SSO/PAT/SSH credentials if those stores were in scope.
4. Verify old session cookies fail, new login works, logout removes the server-side session, and no cookie value appears in responses, logs, traces, or analytics.

## 7. Access-log and misuse review

Review from the first commit or artifact containing the material through at least 24 hours after final revocation; extend to the full provider retention period when available. Preserve the query definition and result hash, not raw tokens or unnecessary personal data.

| Surface | Review for | Evidence to retain |
|---|---|---|
| GitHub repository and audit log | Clone/fetch/download of exposed refs, secret alerts, pushes, branch changes, collaborator/team access, token/key changes, workflow runs, artifact downloads | Actor, action, repository/ref, source IP where available, UTC time, alert number |
| GitHub Actions | Secret access, workflow runs after exposure, artifact downloads, logs containing masked/unmasked values, forks/PRs executing CI | Workflow/job/run IDs, retention/deletion event, redacted finding count |
| Hostinger/SSH/web server | SSH logins, file reads/transfers, deploys, process restarts, API request paths, admin routes, unusual user agents/IPs | Account, source, path/route, status, time, deployment SHA |
| Vercel | Environment-variable changes, deployment/build logs, preview access, function requests, project-member activity | Deployment ID, actor, environment, request/time metadata |
| Supabase/PostgreSQL | Role login failures/successes, client addresses, unusual query volume, exports, admin/service-key use, schema/migration activity | Role class, client address, time, event IDs; no SQL payload containing customer data unless approved |
| Redis provider | ACL changes, connection sources, auth failures, commands/namespace access where audited | User, source, namespace, time, count; never capture values or `MONITOR` output in production |
| API/web/bot | Auth failures, session creation/logout, API-key use, QR/status access, bot send/logout, webhook replay/test, CSRF failures, error traces | Route class, actor/key prefix or hash, status, source, time; never bearer/cookie/header values |
| Google OAuth | Client-secret changes, authorization/token activity, new consent, callback errors, redirect changes, refresh-token use | Client/environment, account class, event/time, result |
| Billing/integrations/email | Payment key use, webhook delivery/signature failures, tenant webhook changes, email API activity | Provider event/delivery ID, status, source/time; no signed payload or secret |
| WhatsApp provider/account | Linked-device additions/removals, QR generation, disconnects, message sends, unknown devices | Device label/ID, actor, time, action; no QR or message content unless separately approved |

Flag: successful access from an unexpected source, access after revocation, a new linked device, bulk export/read activity, repeated signature failures, or a credential used by a consumer that was not listed in the inventory. Preserve the original log source and escalate before deleting or redacting provider logs.

## 8. Deployment and smoke verification

Use staging first, then production. Build from a clean, reviewed commit after rotation; do not use the old artifact as a rollback target if it contains exposed material. The deployment pipeline must inject secrets at runtime and exclude `.env` files from archives. The linked CI workflow currently uses remote `set -exuo pipefail` while decoding and writing secret values; do not rerun that path until shell tracing is disabled around secret operations. Treat logs from an affected run as exposed, record the run/job IDs, and retain or purge them only through the approved evidence process.

### 8.1 Pre-deploy artifact checks

These checks list names only and must fail closed:

```sh
set -euo pipefail
git diff --check
tracked_paths="$(git ls-files)"
if printf '%s\n' "$tracked_paths" | rg --pcre2 -i '(^|/)(\.env($|\.(?!example$))|cookies\.txt$|.*\.(pem|key|p12|zip|tgz)$)'; then
  printf '%s\n' 'secret-like tracked path found; stop before deployment' >&2
  exit 1
fi
for archive in deploy/api.zip deploy/bot.zip; do
  test -e "$archive" || continue
  test -r "$archive"
  archive_members="$(unzip -Z1 "$archive")"
  if printf '%s\n' "$archive_members" | rg --pcre2 -qi '(^|/)(\.env($|\.(?!example$))|cookies|.*(secret|credential|token|private|\.pem|\.key))'; then
    printf 'secret-like member found in %s\n' "$archive" >&2
    exit 1
  fi
done
```

`git ls-files` and `unzip -Z1` are path-only checks; the former checks tracked path names and the latter archive member names. Never replace them with a command that prints matching file contents. Verify the archive manifest also contains the expected compiled entrypoint, Prisma schema/migrations where required, and no local workspace or secret file.

For a deterministic local preflight, use the repository validator. It is a **metadata-only blocker**, does not rotate or revoke credentials, and never performs cleanup or history rewriting:

```sh
npm run security:artifact-preflight -- --mode current-tree
npm run security:artifact-preflight -- --mode history-rewrite
npm run test:security:artifact-preflight
```

The validator always returns `BLOCKED` and `HISTORY_REWRITE_ELIGIBLE: NO`. It accepts no manifest, local file, environment variable, boolean, owner assertion, timestamp, or evidence string as authorization: `--manifest` and other approval-like arguments are rejected before Git or filesystem metadata is queried. External proof must be verified through the incident process outside this tool.

The validator runs only fixed-argument Git metadata commands with optional locks, pager, hooks, external diff, system/global Git configuration, prompts, and inherited environment disabled. It reports a status-entry count but never prints status paths; `history-rewrite` mode blocks when any worktree entry exists. It intentionally reports `GIT_DIFF_CHECK: NOT_RUN_METADATA_ONLY`; run `git diff --check` only as a separate external verification step and do not interpret it as a validator result.

ZIP inspection is restricted to member names after `lstat` and `realpath` prove a regular non-symlink archive remains below the real repository root. Tracked `.tgz` and `.tar.gz` files are never opened or decompressed and are emitted as `ARCHIVE_NEEDS_REVIEW`; every tracked `deploy/` archive is blocked even when its listed names look clean. `.env.example` is reported as `ENV_EXAMPLE_NEEDS_REVIEW`, not declared safe. Output is limited to escaped metadata names, counts, static out-of-band approval states, `HISTORY_REWRITE_ACTION: NOT_PERFORMED`, and `CONTENT_READ: NONE`.

Preserve the G0–G5 sequence: independently rotate and verify credentials first; record G3 evidence and cleanup authorization in the restricted incident system; then obtain the written §10 approvals before any separate history-remediation procedure is considered. This validator is not an approver, a rewrite-preparation tool, or a substitute for that external evidence.

### 8.2 Runtime smoke matrix

Record only status, timestamp, deployment/version ID, and redacted error class.

| Check | Expected result |
|---|---|
| Public API health/readiness | 200, correct environment/version, no secret/config dump |
| Web origin and API CORS | Correct origin only; no wildcard credentialed access; public pages load |
| `/api/csrf-token` | 200; cookie is present with safe attributes; value is not captured |
| Synthetic login/session | New login succeeds; old session cookie fails; logout invalidates server session |
| CSRF | Valid token/header succeeds; missing or mismatched token is rejected |
| Database | Read-only connectivity, migration state, and a disposable/synthetic tenant flow succeed; no cross-environment connection |
| Redis | Authenticated connection succeeds; rate limit/outbox/bot persistence behave normally; no cross-environment namespace access |
| API/MCP | New service credential succeeds for intended scope; old credential returns 401/403; no token in response/log |
| Bot | Authenticated health/ping/send/logout works; unauthenticated status never returns QR or auth state; linked device is expected |
| Webhooks/billing | Valid new signature is accepted, altered/old signature rejected, delivery is idempotent; no unapproved live payment replay |
| OAuth | New Google login/callback works per environment; old client secret/token is rejected or revoked; state/code is not logged |
| Web build | No private value is present in generated JS/source maps; `VITE_*` values are treated as public |
| Observability | Logs, traces, error reports, analytics, and headers do not contain secrets, cookies, QR payloads, or authorization values |

Do not call a deployment healthy because a process is running. Require the runtime version marker, dependency connectivity, negative old-credential tests, and the smoke matrix.

## 9. Cleanup and artifact handling — only after rotation

Cleanup starts only after **G3** is signed off. Rotation and revocation are the control; deletion is not.

1. Remove exposed environment files and deployment archives from the current tree in a separate approved remediation change. Retain only redacted examples and documented key names. Update ignore rules and CI checks so the same paths cannot return.
2. Delete or expire GitHub Actions artifacts, logs, caches, releases, and attachments that contain exposed material after the Evidence Custodian records their IDs, retention status, and redacted finding. Do not delete the only copy of an incident log before evidence custody is complete.
3. Remove exposed Vercel deployments/build outputs, Hostinger release directories/backups, local CI workspaces, and browser/cookie artifacts only by the exact provider IDs or filesystem paths recorded in the approved cleanup manifest, according to each owner’s retention policy. Never target an entire project, home/workspace directory, or all Redis data. Confirm the provider’s purge/retention result.
4. Re-scan the current tree, all Git refs, archives, CI artifacts, deployment outputs, and source maps. A scan that finds a revoked value is still a failure: record it and continue containment.
5. Keep an immutable, access-restricted cleanup manifest containing path/artifact IDs, owner, action, UTC time, approval, and result—never the content.

## 10. History rewrite approval and procedure

History rewriting is destructive to collaborators and remote refs. It is **not authorized by this document**. Do not run `git filter-repo`, a force push, ref deletion, reflog expiry, garbage collection, or object pruning until all of the following written approvals are attached to the incident case:

- Incident/Security Lead confirms all exposed credentials have been rotated/revoked and misuse review is complete or actively monitored;
- Repository owner/GitHub administrator approves rewriting the public repository and the temporary branch-protection procedure;
- Platform and Database owners confirm current deployments, backups, provider artifacts, and rollback references do not depend on old commit IDs or old secret values;
- every active collaborator and automation owner acknowledges the freeze and fresh-clone/reclone plan;
- Business/Legal/Communications owner approves any required customer, provider, or public disclosure;
- Evidence Custodian confirms the pre-rewrite mirror, object manifest, approvals, and redacted scan are retained outside the repository.

After approval, use a disposable mirror and keep the original mirror immutable:

```sh
set +x
set -euo pipefail
umask 077
export GIT_TERMINAL_PROMPT=0
MIRROR_DIR="$(mktemp -d "${TMPDIR:-/tmp}/sync-erp-history-mirror.XXXXXX")"
test -n "${EVIDENCE_DIR:-}"
test -d "$EVIDENCE_DIR"
test -w "$EVIDENCE_DIR"
test -n "${REPO_URL:-}"
case "$REPO_URL" in
  http://*@*|https://*@*)
    printf '%s\n' 'REPO_URL must not contain embedded HTTP(S) credentials.' >&2
    exit 1
    ;;
esac
# Set HISTORY_REWRITE_APPROVED manually only after verifying every §10 approval in the case.
test "${HISTORY_REWRITE_APPROVED:-}" = yes
git clone --mirror "$REPO_URL" "$MIRROR_DIR/repo.git"
git -C "$MIRROR_DIR/repo.git" show-ref > "$EVIDENCE_DIR/pre-rewrite-refs.txt"
git -C "$MIRROR_DIR/repo.git" fsck --full --no-reflogs --no-progress > "$EVIDENCE_DIR/pre-rewrite-fsck.txt" 2>&1 || true
# Extend the --path list with every additional approved suspect path found during G1.
git -C "$MIRROR_DIR/repo.git" filter-repo --path apps/api/.env.production --path apps/api/.env.staging --path apps/bot/.env.production --path apps/bot/.env.staging --path apps/web/.env.production --path apps/web/.env.staging --path packages/database/.env.production --path packages/database/.env.staging --path cookies.txt --path deploy/api.zip --path deploy/bot.zip --invert-paths
git -C "$MIRROR_DIR/repo.git" fsck --full --no-reflogs --no-progress > "$EVIDENCE_DIR/post-rewrite-fsck.txt" 2>&1 || true
git -C "$MIRROR_DIR/repo.git" show-ref > "$EVIDENCE_DIR/post-rewrite-refs.txt"
```

Before any remote update, verify the rewritten mirror contains no suspect paths or findings, all required branches/tags are present, and the new current-tree remediation commit is included. Have the GitHub administrator perform the approved remote update using the repository’s documented protected-branch exception. Record old-to-new ref mapping and the exact maintenance window.

The final force-update is intentionally not a copy-paste command here. It requires a second confirmation immediately before execution, because `git push --force`/`--mirror` can overwrite remote refs. Never force-push from a developer clone. Do not prune local objects until the post-rewrite clone, GitHub scan, deployment, and collaborator verification all pass.

## 11. Collaborator and re-clone coordination

Before the rewrite:

- announce the freeze window, affected refs, exposure class, expected interruption, support contact, and the rule that old clones must not push;
- ask every collaborator, CI owner, release bot, deploy key owner, and integration owner to stop fetch/push/deploy activity and acknowledge in the case;
- tell operators not to copy old files or credentials into the new clone; quarantine old clones and worktrees;
- preserve uncommitted work as a value-free patch or secure handoff only after checking that it contains no exposed values.

After the rewrite:

- collaborators create fresh clones from the rewritten remote; they must not repair an old clone with `reset --hard` or reuse old refs as a shortcut;
- invalidate and reissue any GitHub PAT, deploy key, webhook, or automation token that may have been present in an old clone, URL, log, or archive;
- verify branch protection, required checks, CODEOWNERS/ownership policy, secret scanning, and push protection before unfreezing pushes;
- require each owner to record a successful clean-clone scan and one successful authenticated smoke result.

## 12. GitHub scanning and push protection

Enable and verify, at repository and organization scope where available:

1. Secret scanning for the full repository/history, including non-default branches where supported.
2. Push protection for contributors and automation, with bypass restricted to named security administrators and a recorded reason.
3. Code scanning and dependency alerts as separate controls; they do not replace secret scanning.
4. Required branch checks for scan results, artifact hygiene, and truthful deployment/smoke checks. A source-branch check alone is insufficient.
5. GitHub Actions artifact/log retention and environment approval rules appropriate to production.

Value-free verification examples:

```sh
set +x
REPO="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
DEFAULT_BRANCH="$(gh api "repos/$REPO" --jq '.default_branch')"
gh secret list --repo "$REPO" --json name,updatedAt --jq '.[] | [.name, .updatedAt] | @tsv'
gh api --paginate "repos/$REPO/secret-scanning/alerts?state=open&per_page=100" \
  --jq '.[] | [.number, .secret_type_display_name, .state, .created_at] | @tsv'
gh api --paginate "repos/$REPO/code-scanning/alerts?state=open&per_page=100" \
  --jq '.[] | [.number, .rule.id, .state, .created_at] | @tsv'
gh api "repos/$REPO" --jq '.security_and_analysis'
gh api "repos/$REPO/branches/$DEFAULT_BRANCH/protection/required_status_checks" --jq '.contexts[]?'
```

If settings are changed by API/UI, record the setting state and actor, not an access token. Test push protection with GitHub’s approved synthetic canary procedure in a disposable branch or repository; never use a live credential as a test string. Do not dismiss an alert as a false positive merely because the credential has since been revoked.

## 13. Rollback, communications, and evidence checklist

### Rollback rules

- Roll back code only to a clean, scanned build that can run with the new credential versions. Never roll back to an artifact containing the exposed values.
- Prefer forward-fixing a broken rotation. Do not restore a compromised database password, OAuth secret, webhook secret, bot session, or cookie/session secret just to make an old build start.
- For a failed deploy, retain the current working runtime, correct the secret/config injection, and redeploy. If a clean previous build is needed, switch code/runtime atomically while keeping the new secret set.
- Do not roll back irreversible provider revocations, session invalidation, WhatsApp logout, or history rewrites without an owner-approved recovery plan. Database migrations require a backup/restore decision, not an improvised down migration.
- Exit rollback only after the smoke matrix, old-credential denial, and log review are green again.

### Communications checklist

- [ ] Incident Lead opened a restricted case and set severity/UTC timeline.
- [ ] Internal owners, on-call, support, and leadership know the freeze and next update time.
- [ ] Provider support tickets contain IDs, timestamps, and redacted evidence only.
- [ ] Customer/legal disclosure decision is recorded; no speculative claim of compromise is sent without evidence review.
- [ ] Customer/support guidance says users may need to log in again and does not request or transmit passwords, cookies, QR data, or tokens.
- [ ] Resolution message states what was rotated/revoked, what was verified, remaining uncertainty, and the next preventive action—without values.

### Evidence checklist

- [ ] Case ID, owners, approvals, freeze/release windows, and UTC timeline.
- [ ] Pre-rotation path/key inventory and exposure window, values omitted.
- [ ] Git refs/commit IDs, artifact member lists, and scan report hashes.
- [ ] Provider rotation/revocation event IDs and old-credential denial results.
- [ ] Access-log query windows, finding counts, anomalies, and escalation decisions.
- [ ] Staging/production deployment SHAs and smoke-matrix results.
- [ ] Session/cookie, Redis namespace, bot linked-device, OAuth, webhook, and API-key invalidation evidence.
- [ ] Cleanup manifest for current files, archives, CI logs/artifacts, provider deployments, and local copies.
- [ ] History-rewrite approvals, pre/post mirror refs, collaborator acknowledgements, and fresh-clone checks.
- [ ] Post-cleanup full-history scan, GitHub alert/push-protection state, and residual-risk owner/date.

Hash evidence files without printing them:

```sh
find "$EVIDENCE_DIR" -maxdepth 1 -type f ! -name manifest.sha256 -exec shasum -a 256 {} \; > "$EVIDENCE_DIR/manifest.sha256"
chmod 600 "$EVIDENCE_DIR/manifest.sha256"
```

## 14. References and completion criteria

Repository evidence and implementation paths:

- [Repository snapshot](../audits/2026-08-09-full-repository-audit/00-repository-snapshot.md)
- [Consolidated risk register](../audits/2026-08-09-full-repository-audit/RISK-REGISTER.md)
- [Git governance audit](../audits/2026-08-09-full-repository-audit/subreports/09-git-branches-governance.md)
- [CI/CD workflow](../../.github/workflows/ci-cd.yml)
- [Repository ignore policy](../../.gitignore)
- [Security hardening notes](../security-hardening.md)

Operational references:

- [GitHub secret scanning](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning)
- [GitHub push protection](https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection)
- [git-filter-repo](https://github.com/newren/git-filter-repo)

Phase 0 is complete only when **G0–G5** are signed off, all known old credentials fail, the access-log review has an owner for every anomaly, staging and production smoke pass, current tree/history/artifacts scan clean or have an explicitly accepted residual finding, and the communications/evidence checklist is complete.
