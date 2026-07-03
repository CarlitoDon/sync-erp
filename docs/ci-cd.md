# CI/CD

## Target Flow

Alur utama sekarang:

1. `git commit`
2. `git push`
3. GitHub Actions menjalankan `CI/CD`
4. Jika quality gates lolos:
   - backend API deploy ke Hostinger
   - frontend web deploy ke Vercel

## Branch Strategy

- `main`
  - menjalankan CI
  - deploy backend ke production Hostinger: `~/public_html/apps/api`
  - deploy frontend ke Vercel production
- `dev`
  - menjalankan CI
  - deploy backend ke staging Hostinger: `~/public_html/apps/api-staging`
  - deploy frontend ke Vercel preview
- `pull_request` ke `main` atau `dev`
  - hanya menjalankan CI
  - tidak deploy

## Workflow

### `CI/CD`

<<<<<<< HEAD
File: `.github/workflows/ci-cd.yml`
=======
File: `.github/workflows/ci.yml`
>>>>>>> origin/dev

Jobs:

- `changes`
  - mendeteksi area yang berubah agar deploy hanya jalan saat relevan
<<<<<<< HEAD
- `ci-api`
=======
- `ci`
>>>>>>> origin/dev
  - install dependencies
  - setup test database
  - lint
  - typecheck
<<<<<<< HEAD
  - unit test
  - **integration test** — `test:integration` API
  - build API (selective: `npm run build:api`)
- `ci-web`
  - install dependencies
  - lint
  - typecheck
  - build Web (selective: `npm run build:web`)
  - **berjalan paralel** dengan `ci-api`
- `deploy_api`
  - hanya jalan pada `push` ke `main` atau `dev`
  - hanya jalan jika area backend berubah
  - menunggu `changes` + `ci-api` selesai
  - build dan package artifact production
=======
  - test
  - build
- `deploy_api`
  - hanya jalan pada `push` ke `main` atau `dev`
  - hanya jalan jika area backend berubah
  - build API
  - package artifact production
>>>>>>> origin/dev
  - rsync ke Hostinger
  - install dependency production
  - generate Prisma client
  - restart Passenger
  - verifikasi `/health` dan `/mcp/health`
- `deploy_web`
  - hanya jalan pada `push` ke `main` atau `dev`
  - hanya jalan jika area frontend berubah
<<<<<<< HEAD
  - menunggu `changes` + `ci-web` selesai
=======
>>>>>>> origin/dev
  - prioritas deploy via Vercel deploy hook
  - fallback ke Vercel CLI jika hook belum dikonfigurasi atau hook tetap kena `429`
  - retry otomatis untuk rate limit / kegagalan sementara

<<<<<<< HEAD
### Deploy Bot (otomatis — terpisah)

File: `.github/workflows/deploy-bot-hostinger.yml`

- trigger: push ke `main`/`dev` (jika path `apps/bot` berubah)
- CD standalone — tidak depend pada CI/CD utama
- build, package, rsync/scp ke Hostinger
- fingerprint-based dependency caching
- restart Passenger (`tmp/restart.txt`)

### Deploy MCP (otomatis — terpisah)

File: `.github/workflows/deploy-mcp-hostinger.yml`

- trigger: push ke `main`/`dev` (jika path `apps/mcp` berubah)
- CD standalone — tidak depend pada CI/CD utama
- build, package, scp ke Hostinger
- fingerprint-based dependency caching
- health check `/health` dan `/mcp/health` setelah deploy
- restart Passenger (`tmp/restart.txt`)

=======
>>>>>>> origin/dev
### Manual Fallback

File: `.github/workflows/deploy-api-hostinger.yml`

- hanya untuk `workflow_dispatch`
- dipakai jika butuh redeploy backend manual saat darurat

<<<<<<< HEAD
### E2E (Playwright) — Non-blocking

File: `.github/workflows/e2e-playwright.yml`

- trigger: push ke `main`/`dev`, PR ke `main`/`dev`
- **berjalan paralel** dan **independen** dari CI/CD
- tidak memblokir deploy
- menjalankan Playwright E2E test di apps/web
- menyimpan report sebagai artifact

=======
>>>>>>> origin/dev
## Required GitHub Secrets

### Backend / Hostinger

- `HOSTINGER_HOST`
- `HOSTINGER_USER`
- `HOSTINGER_SSH_KEY`

### Frontend / Vercel

- Default deploy frontend memakai Vercel Git integration yang sudah terhubung ke repo.
- `VERCEL_ORG_ID` dan `VERCEL_PROJECT_ID_WEB` hanya dibutuhkan jika ingin memaksa deploy dari GitHub Actions.

Jika ingin override dan deploy langsung dari GitHub Actions, set `VERCEL_DEPLOY_VIA_CI=true` lalu pilih minimal salah satu jalur berikut:

- `VERCEL_DEPLOY_HOOK_PRODUCTION_WEB` dan `VERCEL_DEPLOY_HOOK_PREVIEW_WEB`
- `VERCEL_TOKEN`

Recommended:

- `VERCEL_DEPLOY_HOOK_PRODUCTION_WEB`
- `VERCEL_DEPLOY_HOOK_PREVIEW_WEB`

## Notes

- CI dan CD sekarang dipusatkan di satu workflow utama agar status branch lebih mudah dibaca.
- Deploy otomatis hanya terjadi setelah push ke branch deploy.
- Deploy frontend dan backend dipisah per area perubahan agar lebih cepat dan lebih hemat runner time.
- Untuk frontend, mode default adalah hand-off ke Vercel Git integration agar tidak perlu menjaga token CLI di GitHub.
- Jika override CI diaktifkan, deploy hook lebih disarankan daripada full CLI login flow karena lebih ringan dan lebih tahan rate limit.
- Jika deploy hook terus menerima `429`, workflow akan fallback ke Vercel CLI selama `VERCEL_TOKEN` tersedia.
- Untuk branch protection, disarankan mewajibkan workflow `CI/CD` lulus sebelum merge ke `main` atau `dev`.
