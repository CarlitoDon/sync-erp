# Subreport 10 — Bot, MCP, Integrations, Webhooks, dan Operational Scripts

Tanggal audit: 2026-08-09  
Scope: `apps/bot`, `apps/mcp`, API integration/webhook/MCP surfaces, deployment copies, `scripts/customer-data`, dan script operasional terkait.

## Batasan dan metode

Audit ini read-only terhadap repository dan runtime metadata. Satu-satunya file yang ditulis adalah subreport ini. Saya tidak menjalankan bot, MCP, seed/migration, build, test, atau koneksi database; tidak membuka nilai secret, ignored live session, WhatsApp state, atau customer-data storage. Nilai environment yang sensitif hanya diperiksa sebagai nama field/mode/keberadaan metadata.

Bukti utama dikumpulkan dengan perintah bounded berikut dan pembacaan bernomor baris:

```text
git rev-parse --show-toplevel
git status --short --branch
rg --files apps/bot apps/mcp apps/api/src/modules/mcp apps/api/src/services scripts/customer-data deploy
git ls-files -s -- apps/bot/.env.production apps/bot/.env.staging deploy/api.zip deploy/bot.zip
zipinfo -1 deploy/api.zip
zipinfo -1 deploy/bot.zip
nl -ba <file> | sed -n '<range>p'
```

Status awal menunjukkan branch berada satu commit di depan remote dan terdapat perubahan/untracked audit dari pekerjaan paralel. Tidak ada perubahan paralel yang saya edit atau hapus.

## Ringkasan eksekutif

Tidak ada P0 yang dapat dibuktikan dari source statis ini, tetapi terdapat beberapa P1 yang perlu diperlakukan sebagai containment segera:

1. Endpoint bot `/status` tidak diautentikasi dan mengembalikan QR WhatsApp yang dibuat oleh Baileys; siapa pun yang dapat mencapai port bot berpotensi memasangkan ulang akun.
2. File `.env.production`/`.env.staging` bot tercatat di Git dan `deploy/api.zip`/`deploy/bot.zip` tercatat sebagai artifact yang berisi `.env`. Nilai aktual tidak saya buka; jika berisi credential aktif, paparan dan rotasi harus dianggap insiden.
3. `protectedProcedure` API hanya memastikan user dan company context. Router API-key/integration kemudian mengizinkan member biasa membuat, merotasi, dan mengonfigurasi key integrasi dengan permission rental read/write.
4. URL webhook/API yang dikendalikan user dikirim dengan `fetch` tanpa policy scheme, DNS/IP private-range, atau redirect. Permukaan ini memberi jalur SSRF/egress dan exfiltration PII.
5. Script koreksi ledger/finalisasi customer langsung melakukan mutation tanpa gate `--apply`, confirmation, atau transaksi end-to-end. Partial failure dapat meninggalkan ledger, inventory, payment, dan attachment dalam keadaan campuran.

Arsitektur saat ini juga memiliki dua transport MCP (standalone Streamable HTTP dan legacy API SSE), session in-memory, auth account-level pada client MCP, retry mutation tanpa idempotency key, serta runtime/deployment yang tidak seragam. Strengths yang sudah ada—API-key hashing, MCP constant-time comparison, company scoping pada integration v1, atomic outbox claim, HMAC/idempotency header, dan dry-run pada sebagian import—belum menutup temuan di atas.

## Current-state map

| Area | Flow dan entry point | Authn/authz | State/data movement | Deploy/test state |
|---|---|---|---|---|
| Bot | Express di `apps/bot/src/server.ts`, REST `/send-*`, `/ping`, `/logout`, tRPC `/api/trpc`; Baileys di `apps/bot/src/bot/baileys.ts` | Static `SYNC_ERP_BOT_SECRET`; plain string comparison pada REST dan tRPC. `/health`, `/`, `/status` public | WhatsApp credentials/Signal keys di Redis; QR disimpan di bot state/API tRPC dan dikembalikan oleh `/status`; pesan/order dapat dikirim ke nomor yang diberikan caller | `apps/bot/package.json` tidak memiliki test script. `.env.production` dan `.env.staging` tercatat. Reconnect dilakukan dari process global. |
| Standalone MCP | `apps/mcp/src/index.ts` Streamable HTTP `/mcp`, `/health`; `stdio.ts` untuk desktop/CLI | Bearer token, safe comparison, fingerprint per session; satu konfigurasi token/account, bukan identity tenant per session | Session dan transport hanya `Map` process; client MCP login ke API dengan email/password, cookie session, CSRF, dan `X-Company-Id` | Docker Node 20 menjalankan source melalui `tsx`; `run-mcp.sh` lokal hard-code Node 22.21.1. Tidak ada unit test; hanya smoke/e2e script. |
| Legacy MCP API | `apps/api/src/modules/mcp/router.ts` menyediakan SSE `/sse`, `/messages`, DELETE | Bearer token dan session ownership, juga in-memory | Jalur transport kedua memakai server/tool set MCP; state hilang ketika process mati dan tidak cocok untuk multi-instance tanpa sticky/shared state | CI mendeteksi perubahan `apps/mcp`, tetapi jalur API dan standalone tetap berpotensi drift. |
| API integration v1 | REST `apps/api/src/routes/integration-v1.router.ts` dan tRPC router | API key bearer, permission check pada integration-v1, company scope, sebagian idempotency | Rental order/payment mengalir ke DB dan webhook outbox; public-token order endpoint adalah capability URL | Ada integration test API, tetapi tidak ada bukti kontrak end-to-end yang mencakup bot/standalone MCP. |
| Webhook | `webhook.service.ts`, `tenant-webhook-outbox.service.ts`, legacy rental outbox | Endpoint/secret disimpan dari API key; delivery diberi HMAC atau bearer secret dan idempotency header | Payload mencakup nama/telepon customer, order, amount, payment/reference; outbox process in-process | Atomic claim dan backoff ada, tetapi stale `PROCESSING` recovery serta selection endpoint perlu diperkuat. |
| Customer-data scripts | Sheet import via MCP; `import-accessories.ts`, `correct-gl.ts`, `finalize-sync-erp.ts` via Prisma/service | Guard berbeda-beda; beberapa langsung DB dengan company name | Membaca CSV/evidence/WhatsApp-derived data, membuat partner/order/ledger/payment/inventory, dan upload attachment | Sebagian output berada di ignored `storage`; retention/encryption tidak dibuktikan. |
| Operational/deploy scripts | `seed-via-api.sh`, API backfills/seeds, `run-mcp.sh`, `local-dev-service.sh`, CI artifact packaging | Banyak default local/dev atau secret dari environment; tidak selalu ada environment guard | Dapat mutate API/DB atau menulis archive/runtime env di luar source tree | CI/Hostinger menggunakan Node 20; local pins dan Docker/zip copies tidak konsisten. |

## Temuan prioritas

Severity mengikuti P0–P3. Confidence menunjukkan kekuatan bukti source/config, bukan apakah kondisi production saat ini sudah dieksploitasi.

### F-01 — QR WhatsApp tersedia melalui endpoint public

**Severity:** P1  
**Confidence:** High  
**Status fakta:** Terverifikasi dari source; exposure jaringan production belum diuji.

**Evidence:** `apps/bot/src/server.ts:46` mendaftarkan `GET /status` tanpa middleware auth. Handler `apps/bot/src/api/status.ts:7-11` mengembalikan `qrCode: getQrDataUrl()`. Baileys membuat QR dan menyimpan/mengirim data URL pada `apps/bot/src/bot/baileys.ts:54-61,112-123`. API router mengambil status itu melalui secret pada `apps/api/src/trpc/routers/bot.router.ts:19-46`, tetapi tidak mengubah endpoint bot yang public.

**Impact:** QR WhatsApp adalah pairing credential jangka pendek. Caller yang dapat menjangkau port bot dapat memindai QR atau memonitor QR baru, berpotensi mengambil alih sesi dan akun bisnis. `/health` dan `/status` juga menjadi discovery surface.

**Recommendation:** Pisahkan liveness dari pairing status; jadikan QR endpoint admin-only dengan auth/permission terpisah, TTL sangat pendek, single-use, audit log, dan jangan mengembalikan QR dari generic status. Bila QR memang harus ditampilkan di UI, proxy melalui API yang sudah terautorisasi dan redaksi log.

**Acceptance criteria:** request tanpa credential ke `/status` mendapat 401/404 dan tidak mengandung QR; member non-admin mendapat 403; QR tidak masuk response health/log umum; test mencakup rotasi dan expiry QR.

### F-02 — Secret-bearing env files dan deployment zip tercatat di Git

**Severity:** P1  
**Confidence:** High untuk keberadaan artifact; Unknown apakah setiap nilai masih valid.

**Evidence:** `git ls-files -s -- apps/bot/.env.production apps/bot/.env.staging deploy/api.zip deploy/bot.zip` menunjukkan keempat path tracked. Safe metadata scan menunjukkan env bot memuat field credential seperti `SYNC_ERP_BOT_SECRET`, `SYNC_ERP_API_SECRET`, dan `REDIS_URL`, dengan mode file 0644. `zipinfo -1 deploy/api.zip` dan `zipinfo -1 deploy/bot.zip` menunjukkan entry `.env`. Runtime bot memang memuat file environment spesifik pada `apps/bot/src/env.ts:16-54`.

Nilai tidak saya tampilkan atau buka. Karena artifact dan env tracked dapat masuk clone, CI artifact, backup, dan history, nilai harus dianggap berpotensi compromised sampai dibuktikan sebaliknya.

**Impact:** Credential bot/API/Redis dapat terekspos melalui Git history atau archive distribution. Menghapus file pada working tree saja tidak menghapus history atau salinan artifact.

**Recommendation:** Contain dan rotate semua credential yang pernah nyata; purge history/artifact sesuai prosedur incident response; ubah deployment menjadi secret injection; tambahkan secret scanner/pre-commit/CI; pastikan archive build menolak `.env*`; mode lokal secret minimal 0600.

**Acceptance criteria:** `git ls-files` tidak lagi menemukan env/secret-bearing archive; `zipinfo` pada artifact release tidak menemukan `.env`; scanner CI bersih; seluruh credential yang pernah aktif sudah rotated dan deployment memakai secret manager/CI secret tanpa menulisnya ke tracked archive.

### F-03 — Member biasa dapat membuat atau merotasi integration key berpermission tinggi

**Severity:** P1  
**Confidence:** High  
**Status fakta:** Terverifikasi dari authorization path.

**Evidence:** `protectedProcedure` hanya memeriksa `ctx.userId` dan `ctx.companyId` pada `apps/api/src/trpc/trpc.ts:149-169`; tidak ada role/permission requirement di sana. `apps/api/src/trpc/routers/api-key.router.ts:13-65,71-188` menggunakan protected procedure untuk create/update webhook/test webhook. `apps/api/src/trpc/routers/integration.router.ts:7-55,59-93,130-155` juga memakai protected procedure untuk install/create custom/rotate key, dan instalasi dapat membuat permission `rental:read` serta `rental:write`.

**Impact:** Compromised atau low-privilege company member dapat mint/rotate credential yang dipakai sistem eksternal, reconfigure callback, dan mendapatkan capability yang lebih luas daripada privilege UI. Ini juga memperbesar F-04.

**Recommendation:** Pisahkan `company member` dari `integration admin`; wajibkan role/permission eksplisit untuk create/revoke/rotate/configure/test. Batasi permission key dengan allowlist per app, default deny, approval/audit event, dan jangan gunakan satu key untuk semua integration. Validasi webhook ownership/policy sebelum menyimpan.

**Acceptance criteria:** user tanpa integration-admin mendapat 403 untuk seluruh lifecycle key/integration; key hanya menerima scope yang diizinkan manifest; rotate/revoke tercatat dengan actor/company/integration; test mencakup privilege escalation dan cross-company denial.

### F-04 — Webhook dan order-link fetch tidak memiliki SSRF/egress policy

**Severity:** P1  
**Confidence:** High untuk arbitrary URL fetch; medium untuk exploitability jaringan production.

**Evidence:** API-key router menerima `webhookUrl: z.string().url()` pada `apps/api/src/trpc/routers/api-key.router.ts:24-31,93-117,163-187`; valid URL belum berarti aman. `apps/api/src/services/webhook.service.ts:130-177` melakukan test fetch. Delivery melakukan `fetch(entry.webhookUrl)` pada `apps/api/src/services/tenant-webhook-outbox.service.ts:521-582`. Legacy rental outbox juga membangun dan fetch URL pada `apps/api/src/modules/rental/webhook-outbox.service.ts:492-583`. Di bot, `apps/bot/src/api/send-order.ts:79-96` meneruskan `payload.orderUrl` ke `getUrlInfo`; schema hanya memastikan URL valid pada `apps/bot/src/types/order.ts:40`.

**Impact:** URL dapat diarahkan ke loopback, private/link-local range, cloud metadata, service admin, atau endpoint yang mengembalikan data sensitif. Webhook membawa PII dan financial data; order URL memberi SSRF tambahan dari process bot. Redirect/DNS rebinding belum terlihat dibatasi.

**Recommendation:** Terapkan policy terpusat: HTTPS saja kecuali allowlist lokal eksplisit, resolve DNS lalu blok loopback/private/link-local/metadata IPv4/IPv6, revalidasi setiap redirect, batasi egress lewat proxy, timeout dan response/body limit, audit destination changes. Untuk `orderUrl`, allowlist host atau hilangkan server-side preview.

**Acceptance criteria:** unit/integration test menolak localhost, RFC1918, link-local, IPv6 local, metadata IP, dan redirect menuju range tersebut; public HTTPS allowlisted tetap bekerja; DNS rebinding dan oversized/slow response tidak menyebabkan hang; destination, actor, dan reason tercatat tanpa membocorkan payload.

### F-05 — Script koreksi/finalisasi customer dapat melakukan mutation destruktif tanpa safety gate end-to-end

**Severity:** P1  
**Confidence:** High  
**Status fakta:** Source menunjukkan mutation langsung; tidak ada eksekusi.

**Evidence:** `scripts/customer-data/santi-living/correct-gl.ts:248-255` memanggil `deleteMany`; `:570-632` menjalankan rangkaian update/create tanpa `--apply`, confirmation, atau transaction end-to-end. `scripts/customer-data/santi-living/finalize-sync-erp.ts:1300-1381` membaca evidence dan mengunggah attachment; `:1554-1599` langsung menjalankan rangkaian mutation, upload, dan verification tanpa global apply gate/rollback. Sebagai pembanding, `import-accessories.ts:53,973-1023` memiliki `--apply` dan rollback transaction, sedangkan sheet import memiliki dry-run/apply guard pada `import-rental-sheet-orders.mjs:7-10,641-679`.

**Impact:** Salah company/name match, koneksi ke environment yang keliru, atau failure di tengah jalan dapat merusak ledger dan meninggalkan order/inventory/payment/attachment setengah terproses. `correct-gl` khususnya menghapus data legacy tanpa backup/confirmation.

**Recommendation:** Satukan runner mutation dengan default dry-run; wajib `--apply --confirm-company-id <exact-id>`, environment allowlist, explicit production refusal, preflight counts/amounts, transaction per business unit atau compensating plan, backup/checkpoint, dan immutable audit record. Pisahkan evidence upload dari ledger mutation dan buat resume/idempotency key.

**Acceptance criteria:** tanpa flag lengkap tidak ada write/delete/upload; company mismatch hard fail; production memerlukan explicit approval; injected failure membuktikan rollback/compensation; rerun menghasilkan no-op; pre/post totals dan affected IDs tersimpan dalam audit tanpa data sensitif berlebihan.

### F-06 — MCP memiliki dua transport, session process-local, dan beberapa jalur protocol/auth mismatch

**Severity:** P2  
**Confidence:** High  
**Impact:** High untuk deployment multi-process dan automation.

**Evidence:** Standalone Streamable HTTP membuat `Map` session/transport, health, auth, dan listener pada `apps/mcp/src/index.ts:18-30,32-126,170-262`; listener bind ke `0.0.0.0`. Legacy API SSE/messages/cleanup berada terpisah pada `apps/api/src/modules/mcp/router.ts:31-205`. Keduanya menyimpan session di memory dan memiliki lifecycle sendiri. `apps/mcp/src/client.ts:245-293` tidak memasang timeout/AbortSignal pada query/mutation; `:296-311` me-retry sekali setelah error unauthorized tanpa idempotency key. `apps/mcp/src/server.ts:44-58` menerima raw tool args lalu cast ke record; schema runtime MCP tidak menegakkan seluruh tipe/constraint. Script customer sheet membuat Streamable HTTP client tanpa auth header pada `scripts/customer-data/santi-living/import-rental-sheet-orders.mjs:581-582`, sementara standalone server mewajibkan bearer pada `apps/mcp/src/index.ts:192-210`.

**Impact:** Session hilang atau salah process saat scale/restart; health 200 tidak membuktikan protocol/auth/API dependency siap; script dapat gagal auth. Retry pada mutation setelah respons ambiguous dapat membuat duplicate order/payment. Account/password yang dikonfigurasi di client juga menjadi satu identity bersama untuk banyak tool/company; `companyId` input bukan pengganti tenant authorization.

**Recommendation:** Pilih satu transport canonical dan satu auth contract; jika multi-instance diperlukan, gunakan shared session store atau sticky routing dengan expiry/lease. Tambahkan body-size/rate limit, request timeout/cancellation, per-request correlation, idempotency key untuk semua mutation, runtime schema Zod per tool, dan explicit user/company binding. Perbaiki script sheet agar mengirim token dari environment melalui TLS.

**Acceptance criteria:** contract test menjalankan `initialize`, `listTools`, `callTool`, GET/DELETE session pada topology deployment; request tanpa token 401 dan disabled mode 503; session behavior terdokumentasi saat restart/scale; mutation retry tidak menggandakan record; sheet import dry-run dapat login tanpa menampilkan secret.

### F-07 — Reconnect Baileys dapat membuat parallel initialization dan Redis auth-state tidak memiliki isolation policy yang kuat

**Severity:** P2  
**Confidence:** High  
**Impact:** High untuk account stability dan credential integrity.

**Evidence:** Pada close/error, `apps/bot/src/bot/baileys.ts:63-99` memanggil `initializeBaileys()` lagi tanpa single-flight guard, backoff, atau max retry. Logout melakukan pola serupa pada `:140-174`. Startup memanggil initialize tanpa await/catch pada `apps/bot/src/index.ts:10-13`. Redis auth state membuat client dari `REDIS_URL` default dan prefix default pada `apps/bot/src/bot/use-redis-auth-state.ts:17-29`; credentials/Signal keys disimpan tanpa TTL pada `:71-83`, dan clear menggunakan `KEYS` pada `:158-168`. TLS/ACL/namespace wajib tidak terlihat.

**Impact:** Disconnect beruntun atau logout race dapat menghasilkan lebih dari satu socket, saling menulis state, reconnect storm, atau WhatsApp ban. Default prefix/Redis endpoint meningkatkan risiko staging/production collision bila environment salah. `KEYS` dapat mengganggu Redis saat key banyak.

**Recommendation:** Implementasikan state machine/single-flight initialization, close socket lama sebelum replacement, exponential backoff/jitter/circuit breaker, dan shutdown drain. Wajibkan Redis URL/prefix per environment, `rediss`/ACL bila remote, health/readiness, retention policy, dan gunakan `SCAN`/set index untuk clear.

**Acceptance criteria:** reconnect chaos test membuktikan maksimal satu active socket; duplicate initialize dan unhandled rejection tidak terjadi; key staging/prod tidak overlap; Redis outage menghasilkan degraded readiness dan alarm; logout/reconnect idempotent.

### F-08 — Bot API menggunakan bearer global tanpa rate limit/idempotency, dan log/response membawa data operasional

**Severity:** P2  
**Confidence:** High  
**Evidence:** CORS dan JSON parser unrestricted berada pada `apps/bot/src/server.ts:12-13`; REST mutation endpoints dipasang pada `:53-58`. Auth membandingkan token secara plain pada `apps/bot/src/middleware/auth.ts:3-23`. `send-message.ts:25-80` mengizinkan target/message caller; `send-order.ts:61-70,105` log nomor tujuan; tRPC `sendMessage`/`sendOrder` pada `apps/bot/src/trpc/routers/bot.router.ts:181-252` mengulang kemampuan yang sama dan melakukan retry initialization sampai 15 kali. `ping.ts:64` mengembalikan nomor admin kepada caller terautentikasi.

**Impact:** Satu bearer yang bocor dapat mengirim spam/pesan arbitrer dan mengulang order karena tidak ada request identity/idempotency. Log menjadi PII dan target abuse. Tidak ada quota per company/integration atau audit actor yang kuat.

**Recommendation:** Gunakan credential scoped/rotatable per integration, constant-time comparison, rate limit/quota dan circuit breaker, max length/allowlist content, correlation/idempotency key, abuse audit, serta redaksi phone/message/QR dari log. Satukan REST dan tRPC policy agar tidak ada bypass.

**Acceptance criteria:** per-role/company quota enforced; duplicate request ID tidak mengirim dua pesan/order; logs tidak memuat full phone/message/QR; credential rotation tanpa downtime; unauthorized and over-limit tests pass.

### F-09 — Webhook outbox rentan stuck state dan endpoint selection yang ambigu

**Severity:** P2  
**Confidence:** High  
**Evidence:** Tenant outbox memilih active API key pertama berdasarkan `createdAt` pada `apps/api/src/services/tenant-webhook-outbox.service.ts:72-103`. Claim memang atomic pada `:474-510`, tetapi tidak ada lease/expiry recovery untuk entry yang tertinggal `PROCESSING`; worker loop berada di `:594-629`. `requeueDeliveries` memperbarui berdasarkan ID pada `:321-371`, bukan conditional status yang sama dengan selection. Legacy rental outbox memiliki pola serupa pada `apps/api/src/modules/rental/webhook-outbox.service.ts:81-130,328-367,431-460`; explicit integration lookup di `:93-96` perlu memastikan company scope di setiap path.

**Impact:** Process crash dapat meninggalkan delivery tidak pernah dicoba lagi; concurrent requeue/worker dapat mengubah state setelah delivery berhasil; beberapa key/integration dapat mengirim ke endpoint yang salah. PII dan event order bisa hilang, terlambat, atau duplicate.

**Recommendation:** Tambahkan lease timestamp/worker ID dan reclaim stale processing; semua transition harus conditional pada status/version; pilih endpoint berdasarkan `integrationId + companyId`, bukan first key; simpan delivery idempotency yang immutable; monitor dead-letter/age/attempts.

**Acceptance criteria:** crash simulation memulihkan `PROCESSING`; dua worker hanya satu yang claim; delivered tidak dapat direqueue oleh race; endpoint test membuktikan isolation antar integration/company; duplicate receiver memakai delivery idempotency.

### F-10 — Public order-token API mengembalikan DTO PII/financial yang luas

**Severity:** P2  
**Confidence:** Medium  
**Status fakta:** Public route dan DTO terverifikasi; apakah token sengaja diperlakukan sebagai bearer capability adalah inference desain.

**Evidence:** REST public route `getByToken` berada pada `apps/api/src/routes/integration-v1.router.ts:230-241`, dan tRPC public path pada `apps/api/src/trpc/routers/integration-v1.router.ts:85-89`. DTO `apps/api/src/modules/rental/rental-integration.dto.ts:141-198` memuat `publicToken`, dates, amounts, notes/address, coordinates, payment status/reference/failure, partner name/phone/address, dan items. Service query menggunakan token pada `apps/api/src/modules/rental/rental-external-order.service.ts:179-229`.

**Impact:** URL/token yang bocor dari browser, log, referrer, chat, atau webhook menjadi akses ke customer PII dan status pembayaran. Coordinates, payment reference, dan internal notes mungkin tidak diperlukan oleh public consumer.

**Recommendation:** Bentuk public DTO minimum terpisah dari internal DTO; token expiry/revocation/rotation, rate limit, no-store/cache policy, referrer protection, dan audit access. Jangan mengembalikan coordinates/payment reference/internal notes kecuali ada kebutuhan bisnis yang terdokumentasi.

**Acceptance criteria:** schema contract public mengandung allowlist field; token expired/revoked mendapat 404/401; rate limit dan audit aktif; security test memastikan token tidak membuka order lain dan tidak mengembalikan field internal.

### F-11 — Runtime dan deployment copies drift

**Severity:** P2  
**Confidence:** High  
**Evidence:** `apps/mcp/Dockerfile:1-18` memakai `node:20-alpine`, `npm install`, source `tsx`, bind 0.0.0.0, dan tidak membuat non-root user. `apps/mcp/run-mcp.sh:8-10` hard-code Node `22.21.1`; repository `.node-version`/`.nvmrc` pin Node `22.12.0`. CI memakai Node 20 dan `npm install` pada `.github/workflows/ci-cd.yml:83-90`; artifact API dibuat dari copy dist/package/schema dan dependency install terpisah pada `:111-143`. Hostinger remote path juga mengeksekusi Node 20 pada `:306-360`. Tracked `deploy/api.zip` dan `deploy/bot.zip` menyimpan package/dist snapshot yang terpisah dari workspace source.

**Impact:** Dependency resolution, TLS/fetch behavior, Prisma/native binaries, dan startup behavior berbeda antara local, Docker, CI, Hostinger, dan zip deployment. Source `tsx` pada image meningkatkan startup/runtime drift dan supply-chain surface.

**Recommendation:** Satu Node/npm version matrix; gunakan `npm ci` dari root lockfile; build immutable compiled artifact untuk bot/MCP/API; hilangkan deployment zip tracked; generate artifact hanya CI; non-root container, read-only filesystem, explicit health/readiness; checksum/version manifest untuk deployed release.

**Acceptance criteria:** local/CI/Docker/Hostinger report versi yang sama; artifact reproducibly dibangun dari commit+lockfile; no source `tsx` in production image; deploy smoke uses same protocol and dependency versions; drift check fails on mismatch.

### F-12 — Seed/backfill scripts dapat menarget environment/database yang salah dan tidak selalu fail closed

**Severity:** P2  
**Confidence:** High  
**Evidence:** `scripts/seed-via-api.sh:21-23` memiliki default API URL local tetapi dapat dioverride; `:40-54` memakai credential dev hard-coded dan menulis cookie; `:61-79,100-302` melakukan banyak POST tanpa idempotency/transaction; cleanup cookie berada di `:307-350`. API backfill `apps/api/scripts/backfill-dp-flags.ts:7-21` melakukan broad `updateMany` berdasarkan notes/type tanpa dry-run atau company scope. Finance seed `apps/api/scripts/seed-finance-accounts.ts:26-47` langsung upsert ke fixed demo company. `scripts/local-dev-service.sh:12-26` default `NODE_ENV=production`, hard-code Node path, dan menjalankan source via `tsx`.

**Impact:** Operator dapat tanpa sengaja mengisi data ke remote API/DB, partial seed dapat meninggalkan state tidak lengkap, dan broad backfill dapat mengubah tenant yang tidak dimaksud. Cookie temporary tetap merupakan credential material bila error/interrupt terjadi.

**Recommendation:** Default harus fail closed: require explicit environment name/allowlist, refuse non-loopback tanpa `--allow-remote`, require confirmation and exact company/database identity, `curl --fail-with-body`/status handling, trap cleanup, file mode 0600, idempotency markers, dry-run/count preview, and transaction where possible.

**Acceptance criteria:** script tanpa flag berhenti sebelum network/write; target mismatch hard fail; HTTP 4xx/5xx menghentikan flow dan tidak menelan partial errors; rerun no-op; no hard-coded credential in source; backfill prints affected count and requires approval.

### F-13 — Customer/WhatsApp-derived data dan evidence masuk source/script output path tanpa retention proof

**Severity:** P2  
**Confidence:** High untuk hard-coded/source movement; Medium untuk actual external retention.

**Evidence:** `scripts/customer-data/README.md:1-5` mendefinisikan tooling khusus customer. `import-accessories.ts:78-143` berisi notes/products/purchases yang berasal dari WhatsApp. `finalize-sync-erp.ts:1300-1381` membaca local evidence dan meng-upload attachment. Sheet importer membaca CSV di storage pada `import-rental-sheet-orders.mjs:12-19`, lalu menulis result JSON/Markdown termasuk input/customer data pada `:101-108,738-788`. MCP source tidak menunjukkan encryption, retention/deletion, atau redaction policy untuk path tersebut.

**Impact:** PII, financial evidence, phone/address, dan raw source data dapat bertahan di ignored storage, backup, logs, DB attachment storage, atau artifact lokal. `.gitignore`/ignored path bukan access control maupun deletion guarantee. Remote MCP target dari environment juga memperluas data movement.

**Recommendation:** Gunakan protected encrypted evidence store atau redacted fixtures; jangan hard-code customer literals bila tidak diperlukan; local path allowlist; retention/secure deletion; redact reports/logs; require authenticated TLS MCP; document data processor/destination and access audit.

**Acceptance criteria:** privacy scan menemukan tidak ada raw customer data di tracked source/artifact; generated output mempunyai TTL dan permission; attachment access company-scoped and audited; dry-run report tidak menyimpan raw input secara default; deletion/backup policy diuji.

### F-14 — Coverage bot/MCP dan readiness observability tidak memadai

**Severity:** P3  
**Confidence:** High  
**Evidence:** `apps/bot/package.json:6-11` tidak memiliki test script; `apps/mcp/package.json:6-16` menyediakan `smoke`/`e2e` tetapi bukan test suite. `apps/mcp/src/smoke.ts:136-326` menaikkan stock lalu membuat sales order, invoice, dan payment; cleanup hanya `transport.close()` pada `:355-363`, sehingga smoke bukan read-only. E2E memiliki pola mutation dan tidak menunjukkan cleanup data. Health standalone MCP hanya melaporkan process/session metadata pada `apps/mcp/src/index.ts:32-55`; bot health hanya process status pada `apps/bot/src/server.ts:24-31`.

**Impact:** CI dapat hijau tanpa contract test untuk auth, session ownership, tool schema, reconnect, Redis, SSRF, idempotency, dan webhook recovery. HTTP 200 dapat terjadi ketika API/Redis/WhatsApp dependency tidak usable. Smoke/e2e dapat mencemari tenant bila operator menjalankannya pada data nyata.

**Recommendation:** Tambahkan unit/contract test bot dan MCP, protocol test untuk kedua transport atau hapus salah satunya, isolated disposable tenant/database, deterministic cleanup, dan negative security tests. Pisahkan liveness dari readiness; expose dependency state, outbox age/dead-letter, reconnect count, auth failures, latency, dan correlation ID tanpa PII/secret.

**Acceptance criteria:** CI menjalankan test bot/MCP pada Node versi release; smoke default read-only dan e2e wajib ephemeral environment; cleanup diverifikasi; readiness gagal bila dependency wajib down; dashboard/alert mencakup stuck delivery, QR exposure attempt, reconnect storm, dan 401 spike.

## Fakta, inferensi, dan unknowns

### Fakta terverifikasi

- Dua implementasi transport MCP dan dua session registry process-local ada di source.
- Bot `/status` public mengembalikan QR data URL.
- Tracked bot env files dan tracked deployment zip berisi `.env` entry/credential field metadata.
- API key/integration lifecycle hanya memakai `protectedProcedure` pada router yang disebut di F-03.
- URL webhook dan `orderUrl` masuk ke `fetch`/URL preview tanpa policy private-IP yang terlihat.
- Script `correct-gl` dan `finalize-sync-erp` memiliki mutation langsung tanpa global dry-run/apply gate.
- Bot/MCP package tidak menyediakan first-party unit-test script; smoke/e2e MCP melakukan mutation.

### Inferensi yang perlu diperlakukan sebagai risiko, bukan fakta incident

- Apakah bot port atau `/status` benar-benar public dari internet belum diuji.
- Apakah secret di env/zip masih aktif, dummy, atau sudah rotated belum diketahui.
- SSRF impact bergantung pada network egress, DNS resolver, redirect behavior, dan cloud metadata controls di runtime.
- Public order token mungkin merupakan desain capability yang disengaja; cakupan DTO tetap lebih luas daripada minimum public disclosure.

### Unknowns yang harus diverifikasi oleh owner dengan akses aman

- Process manager/port exposure production bot, standalone MCP, dan legacy API SSE; apakah salah satu transport sudah deprecated.
- Redis TLS/ACL, key namespace aktual, backup/retention, dan apakah auth state pernah overlap antar environment.
- Secret rotation/history purge, CI artifact retention, Git hosting access, dan deployment zip provenance.
- Database/attachment encryption at rest, object-storage ACL, log retention, webhook receiver trust, dan actual public-token expiry.
- Runtime tests pada disposable environment: MCP `initialize/listTools/callTool`, QR endpoint auth, SSRF block, webhook crash recovery, concurrent claims, Baileys reconnect, dan script fail-closed behavior.

## Strengths yang sudah ada

1. API memakai Helmet, CORS policy, CSRF middleware, dan JSON limit pada application layer; ini menjadi baseline yang baik untuk endpoint non-MCP.
2. MCP auth menggunakan bearer token, safe comparison, token fingerprint, dan session-owner checks pada standalone maupun legacy path (`apps/mcp/src/index.ts:192-238`; `apps/api/src/modules/mcp/auth.ts:13-75`).
3. API key disimpan sebagai hash dan raw key hanya dikembalikan saat create/rotate; `apiKeyProcedure` memiliki rate-limit path melalui Redis (`apps/api/src/services/api-key.service.ts:39-82`; `apps/api/src/trpc/trpc.ts:203-257`).
4. Integration-v1 sudah memiliki API-key permission dan company-scope checks serta idempotency untuk operasi order/payment tertentu (`apps/api/src/routes/integration-v1.router.ts:104-139,211-221,388-397`).
5. Outbox memakai atomic claim/update dan delivery membawa signature/idempotency header, timeout, retry/backoff, serta dead-letter status (`apps/api/src/services/tenant-webhook-outbox.service.ts:431-582`). Ini fondasi yang tepat untuk ditambah lease/recovery dan endpoint policy.
6. `import-accessories.ts` memiliki apply guard, transaction rollback saat dry-run, dan dedupe marker; sheet importer juga memisahkan dry-run dari apply dan memvalidasi total/duplicate sebelum mutation.
7. Banyak MCP tool meneruskan `companyId` secara eksplisit dan API tetap menjadi enforcement boundary. Ini harus dipertahankan, tetapi tidak boleh dianggap menggantikan identity/permission binding.

## Quick wins berurutan

1. Segera cabut route public QR; rotate credential yang pernah berada di env/zip; block release bila archive memuat `.env` atau secret pattern.
2. Tambah integration-admin authorization dan audit event untuk seluruh API-key/integration lifecycle.
3. Implementasikan shared SSRF validator/egress proxy sebelum menerima webhook URL, test URL, atau order preview URL.
4. Beri global safety wrapper pada customer-data scripts: default dry-run, `--apply --confirm-company-id`, environment allowlist, no implicit production, dan failure checkpoint.
5. Perbaiki sheet importer dengan bearer token dari environment dan timeout; tambahkan idempotency key pada MCP mutation client.
6. Tetapkan MCP canonical transport, lalu hapus/deprecate path lain atau beri contract test dan routing policy yang eksplisit.
7. Tambahkan size/rate limits, AbortSignal, structured correlation logging, dan redaction pada bot/MCP; jangan log QR/full phone/message.
8. Pin Node/npm/lockfile dan build compiled immutable artifact; stop tracking deployment zip snapshot.

## Roadmap bertahap

### Fase 0 — containment, 0–48 jam

- Nonaktifkan `/status` public dan audit akses/log/QR pairing.
- Rotate bot/API/Redis/integration credentials yang pernah berada dalam tracked env/archive; purge history/artifact yang relevan.
- Freeze `correct-gl`/`finalize-sync-erp` pada production sampai safety wrapper dan owner approval tersedia.
- Batasi webhook destination dan order preview ke allowlist/egress policy sementara; review existing stored URLs.

### Fase 1 — hardening, 1–2 minggu

- Selesaikan authorization model integration-admin, scoped API keys, key rotation/revocation audit, and company/integration binding.
- Buat SSRF validator, timeout/body limit, redirect revalidation, idempotency, and outbox stale-lease recovery.
- Satukan MCP auth/tenant context; add runtime tool schemas, request limits, protocol contract tests, dan script auth fix.
- Tambahkan bot state machine/reconnect backoff/Redis isolation serta rate limit and PII-redacted logs.

### Fase 2 — convergence, 2–6 minggu

- Satu transport MCP canonical dengan topology/session design yang didukung deployment.
- Reproducible Node/npm build dari lockfile, compiled production images, non-root runtime, release checksum, dan no tracked zip/env.
- First-party bot/MCP tests, isolated mutating e2e, public DTO allowlist/token lifecycle, dependency readiness, metrics/alerts.
- Migrasikan customer evidence ke encrypted/retained store dan refactor hard-coded scripts menjadi reviewed migration packages.

## Kesimpulan handoff

Prioritas tertinggi adalah containment QR dan credential artifacts, authorization lifecycle integration key, SSRF egress, lalu safety gate script finansial. Setelah itu, konvergensikan MCP transport/session dan samakan runtime artifact; tanpa langkah tersebut status health/CI saat ini belum cukup untuk menyatakan bot, MCP, atau integration delivery aman dan reproducible.

**Assigned report:** `docs/audits/2026-08-09-full-repository-audit/subreports/10-bot-mcp-integrations-scripts.md`  
**Key findings:** P1 QR WhatsApp public; tracked env/zip secret exposure risk; member-to-integration-key privilege escalation; webhook/order URL SSRF; destructive customer scripts without end-to-end safety gate; MCP transport/session/auth drift; Baileys/Redis reconnect risk; outbox recovery ambiguity; customer-data retention risk; bot/MCP test/readiness gaps.
