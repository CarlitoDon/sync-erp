# Unified Deployment CI/CD (Coolify + Vercel)

Last updated: 2026-09-21. Hostinger and Railway deployments have been retired in favor of Coolify PaaS and Vercel.

## Overview

The deployment architecture is split across two primary providers:
1. **Frontend**: Vercel (Production & Preview) via Vercel CLI.
2. **Backend Services (API & MCP)**: Coolify PaaS on Docker via automated webhook triggers.

## Architecture & Workflows

### 1. Frontend (Vercel)
- **Workflow**: `.github/workflows/ci-cd.yml` (`deploy_web` job)
- **Trigger**: Automatic on `push` to `main` (production) and `dev` (staging/preview) when web changes are detected.
- **Mechanism**: Deployed using Vercel CLI with prebuilt assets and custom alias domain checks.

### 2. Backend API (Coolify)
- **Workflow**: `.github/workflows/deploy-coolify.yml` invoked from `.github/workflows/ci-cd.yml` (`deploy_api` job).
- **Trigger**: Automatic on `push` to `main` (production) and `dev` (staging) after quality gates (`ci-api`, `ci-api-integration`) pass, or manual `workflow_dispatch`.
- **Mechanism**: Coolify deployment webhook triggered via `scripts/trigger-coolify-deploy.sh` with authorization headers and deployment verification.

### 3. Standalone MCP (Coolify)
- **Workflow**: `.github/workflows/deploy-mcp-coolify.yml`
- **Trigger**: Push to `main`/`dev` matching `apps/mcp/**` or manual `workflow_dispatch`.
- **Mechanism**: Calls Coolify deployment webhook for the MCP container service.

## Security & Secrets
- All deployments authenticate via GitHub Secrets:
  - `COOLIFY_API_URL`, `COOLIFY_API_TOKEN`
  - `COOLIFY_WEBHOOK_API_STAGING`, `COOLIFY_WEBHOOK_API_PROD`
  - `COOLIFY_WEBHOOK_MCP_STAGING`, `COOLIFY_WEBHOOK_MCP_PROD`
  - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_WEB`
- No SSH keys or host pinning required on GitHub runners for deployment.
