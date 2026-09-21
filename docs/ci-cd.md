# CI/CD

Last updated: 2026-09-21. Hostinger and Railway have been retired in favor of Coolify PaaS and Vercel.

## Ringkasan

Pipeline CI/CD Sync ERP dibagi menjadi:
- **Backend API**: Coolify (Staging & Production)
- **Backend MCP**: Coolify (Staging & Production)
- **Frontend Web**: Vercel (Preview & Production)

## Target Flow

1. `pull_request` ke `main` atau `dev`, `push` ke `main` atau `dev`, atau `workflow_dispatch` memulai quality workflow `CI/CD` (`.github/workflows/ci-cd.yml`).
2. Pada `push`, `deploy_api` menunggu `changes` + quality gate API (`ci-api` dan `ci-api-integration`). Jika lolos, deploy API ditrigger ke Coolify via webhook (`deploy-coolify.yml`).
3. Pada `push`, `deploy_web` menunggu `changes` + quality gate Web (`ci-web`). Jika output filter `web` bernilai `true`, frontend dideploy ke Vercel via Vercel CLI.
4. Pull request hanya menjalankan quality gates tanpa deployment.

## Branch Strategy

- `main`
  - Menjalankan CI quality gates.
  - Deploy backend API ke Coolify production environment.
  - Deploy frontend ke Vercel production bila filter Web bernilai `true`.
- `dev`
  - Menjalankan CI quality gates.
  - Deploy backend API ke Coolify staging environment.
  - Deploy frontend ke Vercel preview/staging bila filter Web bernilai `true`.
- `pull_request` ke `main` atau `dev`
  - Hanya menjalankan CI / test suite.
  - Tidak menjalankan deployment.

## Workflow Details

### 1. CI/CD Utama
File: `.github/workflows/ci-cd.yml`
- Quality Gates API (`lint`, `typecheck`, `test:unit`, `test:integration` dengan PostgreSQL container).
- Quality Gates Web (`lint`, `typecheck`, `test:unit`, `build`).
- Trigger deployment Coolify (`deploy_api`) dan Vercel (`deploy_web`).

### 2. Deploy Coolify API
File: `.github/workflows/deploy-coolify.yml`
- Reusable workflow untuk mentrigger webhook Coolify bagi service API.
- Mendukung staging dan production environment.

### 3. Deploy Coolify MCP
File: `.github/workflows/deploy-mcp-coolify.yml`
- Trigger path-filtered pada `apps/mcp/**` atau manual dispatch.
- Mentargetkan instance Coolify MCP container.

### 4. E2E (Playwright) — Non-blocking
File: `.github/workflows/e2e-playwright.yml`
- Trigger: push ke `main`/`dev`, PR ke `main`/`dev`, dan `workflow_dispatch`.
- Berjalan paralel dan independen dari pipeline deployment.

## Secrets yang Digunakan

### Coolify Deployments
- `COOLIFY_API_URL`
- `COOLIFY_API_TOKEN`
- `COOLIFY_WEBHOOK_API_STAGING`
- `COOLIFY_WEBHOOK_API_PROD`
- `COOLIFY_WEBHOOK_MCP_STAGING`
- `COOLIFY_WEBHOOK_MCP_PROD`

### Frontend / Vercel
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID_WEB`
- `VERCEL_TOKEN`

### API & Database Runtime
- `DATABASE_URL`
- `DATABASE_URL_STAGING`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `SYNC_ERP_AUTH_STATE_SECRET`
