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

File: `.github/workflows/ci.yml`

Jobs:

- `changes`
  - mendeteksi area yang berubah agar deploy hanya jalan saat relevan
- `ci`
  - install dependencies
  - setup test database
  - lint
  - typecheck
  - test
  - build
- `deploy_api`
  - hanya jalan pada `push` ke `main` atau `dev`
  - hanya jalan jika area backend berubah
  - build API
  - package artifact production
  - rsync ke Hostinger
  - install dependency production
  - generate Prisma client
  - restart Passenger
  - verifikasi `/health` dan `/mcp/health`
- `deploy_web`
  - hanya jalan pada `push` ke `main` atau `dev`
  - hanya jalan jika area frontend berubah
  - deploy dijalankan penuh melalui Vercel CLI (token auth)
  - retry otomatis untuk rate limit / kegagalan sementara

### Manual Fallback

File: `.github/workflows/deploy-api-hostinger.yml`

- hanya untuk `workflow_dispatch`
- dipakai jika butuh redeploy backend manual saat darurat

## Required GitHub Secrets

### Backend / Hostinger

- `HOSTINGER_HOST`
- `HOSTINGER_USER`
- `HOSTINGER_SSH_KEY`

### Frontend / Vercel

- Default deploy frontend memakai secara penuh GitHub Actions (via Vercel CLI). Vercel Git integration dimatikan.
- Hal ini mencegah deploy otomatis yang berlebihan (deploy ganda) dari Vercel ketika hanya area backend yang berubah.
- Vercel Token (`VERCEL_TOKEN`), `VERCEL_ORG_ID`, dan `VERCEL_PROJECT_ID_WEB` WAJIB ada di dalam GitHub Secrets.

## Notes

- CI dan CD sekarang dipusatkan di satu workflow utama agar status branch lebih mudah dibaca.
- Deploy otomatis hanya terjadi setelah push ke branch deploy.
- Deploy frontend dan backend dipisah per area perubahan agar lebih cepat dan lebih hemat runner time.
- Untuk frontend, mode saat ini adalah full Vercel CLI via GitHub Actions.
- Karena sepenuhnya manual (by workflow changes), fitur Vercel deployment hook tidak dibutuhkan. Vercel akan diakses langsung dengan token.
- Untuk branch protection, disarankan mewajibkan workflow `CI/CD` lulus sebelum merge ke `main` atau `dev`.
