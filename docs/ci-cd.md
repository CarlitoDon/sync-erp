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
  - deploy ke Vercel via Vercel CLI

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

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID_WEB`

## Notes

- CI dan CD sekarang dipusatkan di satu workflow utama agar status branch lebih mudah dibaca.
- Deploy otomatis hanya terjadi setelah push ke branch deploy.
- Deploy frontend dan backend dipisah per area perubahan agar lebih cepat dan lebih hemat runner time.
- Untuk branch protection, disarankan mewajibkan workflow `CI/CD` lulus sebelum merge ke `main` atau `dev`.
