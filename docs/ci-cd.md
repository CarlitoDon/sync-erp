# CI/CD

Source review/update: 2026-08-13. This page describes the checked-in workflow
contract; dated audit snapshots remain historical evidence and are not rewritten
here. Nothing below is production-closure evidence.

## Batasan bukti

Dokumen ini menjelaskan kontrak workflow yang tersimpan di repository. [PR
#84](https://github.com/CarlitoDon/sync-erp/pull/84) menambahkan hardening
SSH Hostinger. [CI/CD run #31693634711](https://github.com/CarlitoDon/sync-erp/actions/runs/31693634711)
memvalidasi hanya committed SHA `e1f3773`; run tersebut tidak membuktikan
commit atau diff sesudahnya. Setiap commit atau diff setelah SHA tersebut
memerlukan CI baru sebelum dapat dikutip sebagai tervalidasi; state yang belum
di-commit tidak dapat dikutip sebagai validasi dari run tersebut. [Playwright
E2E run #31693634657](https://github.com/CarlitoDon/sync-erp/actions/runs/31693634657)
berhasil untuk pull request tersebut, tetapi job deploy Hostinger di PR
berstatus `skipped`. Secret value, fingerprint/host-key value, koneksi live,
deployment, rollback, dan production closure tidak dibuktikan oleh checks itu.

Jangan menaruh host-key line, fingerprint, private key, passphrase, atau secret
value di Git, dokumentasi, log, artifact, issue, atau pull request. Untuk
rotasi host key, ikuti [runbook Hostinger SSH host-key
rotation](runbooks/hostinger-ssh-key-rotation.md).

## Target Flow

Alur yang didefinisikan oleh workflow saat ini:

1. `pull_request` ke `main` atau `dev`, `push` ke `main` atau `dev`, atau
   `workflow_dispatch` memulai quality workflow `CI/CD`.
2. Pada `push`, `deploy_api` menunggu `changes` + quality gate API dan dapat
   berjalan untuk setiap push ke `main`/`dev`; output filter `api` belum menjadi
   gate deploy.
3. Pada `push`, `deploy_web` menunggu `changes` + quality gate Web dan hanya
   berjalan bila output filter `web` bernilai `true`.
4. Pull request dan manual dispatch pada `ci-cd.yml` menjalankan quality jobs
   tanpa deploy API/Web; `workflow_dispatch` pada workflow ini tidak memiliki
   input environment.

## Branch Strategy

- `main`
  - menjalankan CI
  - deploy backend ke production Hostinger: `~/public_html/apps/api`
  - deploy frontend ke Vercel production bila filter Web bernilai `true`
- `dev`
  - menjalankan CI
  - deploy backend ke staging Hostinger: `~/public_html/apps/api-staging`
  - deploy frontend ke Vercel preview bila filter Web bernilai `true`
- `pull_request` ke `main` atau `dev`
  - hanya menjalankan CI
  - tidak deploy
- `workflow_dispatch` pada `.github/workflows/ci-cd.yml`
  - menjalankan quality jobs
  - tidak deploy karena job deploy mensyaratkan event `push`

## Workflow

### `CI/CD`

File: `.github/workflows/ci-cd.yml`

Jobs:

- `changes`
  - mendeteksi area yang berubah dan menghasilkan output `api`/`web`
  - output `web` dipakai untuk gate `deploy_web`; output `api` saat ini belum
    dipakai sebagai gate `deploy_api`
- `ci-api`
  - install dependencies
  - setup test database
  - lint
  - typecheck
  - unit test
  - **integration test** — `test:integration` API
  - build API (selective: `npm run build:api`), dengan output utama di
    `apps/api/dist`
  - pada event `push`, menyiapkan `deploy/api-mcp/` dari `apps/api/dist`,
    `apps/api/package.pro.json`, dan file Prisma yang diperlukan; production
    dependency tree dibuat di `deploy/api-mcp/` melalui
    `npm install --prefix deploy/api-mcp --omit=dev`, lalu artifact itu
    diunggah sebagai `api-mcp-build`
- `ci-web`
  - install dependencies
  - lint
  - typecheck
  - build Web (selective: `npm run build:web`)
  - **berjalan paralel** dengan `ci-api`
  - mengunggah output `apps/web/dist/` sebagai artifact Web
- `deploy_api`
  - hanya jalan pada event `push` ke `main` atau `dev`; `workflow_dispatch` pada
    `ci-cd.yml` tidak menjalankan job ini
  - menunggu `changes` + `ci-api` selesai
  - tidak memeriksa `needs.changes.outputs.api`, sehingga filter API saat ini
    bersifat informasional dan bukan gate deploy
  - download dan validasi artifact production terhadap `GITHUB_SHA`
  - menggunakan `HOSTINGER_SSH_KNOWN_HOSTS` sebagai design/required-input
    contract untuk helper; input yang hilang atau invalid membuat helper gagal
    secara fail-closed. Ini hanya kontrak source, bukan bukti secret terkonfigurasi, nilai
    disetujui provider/OOB, atau koneksi/deployment live
  - memakai `StrictHostKeyChecking=yes` dan `UserKnownHostsFile` untuk SSH/SCP
  - transfer dan aktivasi release melalui SSH, lalu memverifikasi release/health
- `deploy_web`
  - hanya jalan pada event `push` ke `main` atau `dev`
  - hanya jalan jika output `web` dari active web path filter bernilai `true`;
    filter ini mencakup frontend `apps/web/**` plus workflow
    `.github/workflows/ci-cd.yml`, shared `packages/shared/**`, root
    `package.json` dan `package-lock.json`, `turbo.json`, serta konfigurasi
    Vercel `vercel.json` dan `apps/web/vercel.json` — bukan hanya perubahan
    frontend
  - menunggu `changes` + `ci-web` selesai
  - output filter `web` adalah gate job; output filter `api` bukan gate
  - build dan deploy memakai Vercel CLI
  - retry otomatis untuk rate limit / kegagalan sementara

### Deploy Bot (historical reference only)

`.github/workflows/deploy-bot-hostinger.yml` tidak ada di checkout ini. Catatan
lama tentang deploy bot tidak menjadi kontrak workflow saat ini; jangan
menganggap alur bot atau pinning SSH bot sudah terverifikasi dari dokumentasi
historis.

### Deploy MCP (terpisah: push path-filtered dan manual)

File: `.github/workflows/deploy-mcp-hostinger.yml`

- trigger push ke `main`/`dev` bila salah satu path workflow, `apps/mcp/**`,
  `packages/shared/**`, atau helper release/pinning yang tercantum berubah
- trigger `workflow_dispatch` dengan input `environment` wajib: `staging` atau
  `production` (default `staging`)
- known `workflow_dispatch` routing residual, terpisah dari closure CICD-003:
  pada `main`, langkah `Resolve deployment target` memakai logika source-target
  yang mengutamakan `GITHUB_REF_NAME == main`, sehingga manual dispatch dengan
  label input `environment: staging` tetap resolve ke target production
  (`apps/mcp`, `sync-erp-mcp`, port `3006`). Label environment workflow dapat
  tetap `staging`, tetapi resolusi target source tetap production; ini bukan
  bukti closure CICD-003
- CD standalone — tidak depend pada CI/CD utama
- build `apps/mcp/dist`, package `deploy/mcp/`, dan production dependency tree
  `deploy/mcp/node_modules/` di runner
- menggunakan `HOSTINGER_SSH_KNOWN_HOSTS` sebagai design/required-input
  contract untuk helper; input yang hilang atau invalid membuat helper gagal
  secara fail-closed. Provider/OOB identity, secret configuration, dan live use tetap tidak
  terbukti
- memakai strict SSH/SCP host checking sebelum transfer atau remote mutation
- health/release verification setelah deploy

### Staging Rollback Drill

File: `.github/workflows/staging-api-rollback-drill.yml`

- hanya melalui `workflow_dispatch`
- environment workflow selalu `staging`; ref yang diterima hanya `dev` atau
  `codex/*`
- failure-injected dan memakai kontrak pinning Hostinger yang sama dengan
  `HOSTINGER_SSH_KNOWN_HOSTS` sebagai required design/input; helper gagal secara
  fail-closed
  bila input hilang atau invalid, dan workflow tetap bukan bukti provider/OOB
  activation atau rollback production
- bukan bukti bahwa rollback production sudah dilakukan

### E2E (Playwright) — Non-blocking

File: `.github/workflows/e2e-playwright.yml`

- trigger: push ke `main`/`dev`, PR ke `main`/`dev`, dan `workflow_dispatch`
- **berjalan paralel** dan **independen** dari CI/CD
- tidak memblokir deploy
- menjalankan Playwright E2E test di apps/web
- menyimpan report sebagai artifact

## Secret names referenced by the deployment workflows

Daftar berikut hanya nama yang direferensikan oleh
`.github/workflows/ci-cd.yml`, `.github/workflows/deploy-mcp-hostinger.yml`,
dan `.github/workflows/staging-api-rollback-drill.yml`. Ini bukan bukti bahwa
secret telah dikonfigurasi, berisi nilai yang benar, atau telah diverifikasi
terhadap provider/OOB.

### Backend / Hostinger

- `HOSTINGER_HOST`
- `HOSTINGER_USER`
- `HOSTINGER_SSH_KEY`
- `HOSTINGER_SSH_PASSPHRASE`
- `HOSTINGER_SSH_KNOWN_HOSTS` — hanya design/required workflow input
  `known_hosts` yang divalidasi helper sampai provider/OOB verification dan live
  deployment evidence tersedia; nilai, keberadaan, dan verifikasi provider/OOB
  belum dibuktikan

### API runtime

- `DATABASE_URL`
- `DATABASE_URL_STAGING`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `SYNC_ERP_AUTH_STATE_SECRET`

### Frontend / Vercel

- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID_WEB`
- `VERCEL_TOKEN`

## Notes

- API dan Web CI/CD dipusatkan di satu workflow utama agar status branch lebih mudah dibaca; MCP dan rollback drill tetap workflow terpisah.
- API deploy otomatis terjadi pada setiap `push` ke branch deploy setelah `ci-api`
  lulus; Web deploy tetap dibatasi oleh filter Web. API filter belum menjadi
  gate.
- MCP memiliki jalur push path-filtered dan manual dengan pilihan `staging` atau
  `production`; rollback drill hanya manual dan staging-only.
- Deploy frontend dibatasi oleh filter area Web; API saat ini tetap dapat
  dideploy pada setiap push branch deploy karena output filter API belum menjadi
  gate.
- API deploy saat ini menggunakan artifact runner-built dari `deploy/api-mcp/`
  dan SSH/SCP ke Hostinger; `HOSTINGER_SSH_KNOWN_HOSTS` adalah design/required
  input only sampai provider/OOB verification dan live deployment evidence
  tersedia, dan koneksi harus cocok dengan file pin yang dibuat helper.
  Konfigurasi secret, verifikasi provider/OOB, dan penggunaan live belum terbukti.
- MCP dan rollback drill adalah workflow terpisah, tetapi memakai kontrak pinning Hostinger yang sama.
- Untuk branch protection, disarankan mewajibkan workflow `CI/CD` lulus sebelum merge ke `main` atau `dev`.
