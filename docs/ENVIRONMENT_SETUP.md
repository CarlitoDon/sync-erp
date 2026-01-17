# Environment Variables Configuration Guide

## Overview

This document explains the environment variable setup for the Sync ERP ecosystem, which includes:

- **sync-erp**: Main ERP backend (API, Bot, Redis)
- **santi-living**: Rental platform (Frontend + ERP Sync Service)

## Critical Environment Variables

### 1. `BOT_SECRET` - Primary Authentication Secret

**Purpose**: Shared secret for service-to-service authentication

**Used By**:

- `sync-erp/apps/api`: Validates bot service connections via `botProcedure`
- `sync-erp/apps/bot`: Authenticates with API when updating status
- `santi-living/apps/proxy`: Authenticates with sync-erp API

**Setup**:

```bash
# Development (.env files)
BOT_SECRET=dev_bot_secret_key_2026

# Production (Railway/Vercel)
# Must be set manually in deployment platform
# Format: Any string (recommended: strong random key)
```

**Priority**:

```
BOT_SECRET (primary) > SYNC_ERP_API_KEY (fallback) > Empty (error)
```

### 2. `SYNC_ERP_API_URL` - API Endpoint

**Purpose**: URL to sync-erp backend API

**Format**: `https://{domain}/api/trpc`

**Values**:

```bash
# Development
SYNC_ERP_API_URL=http://localhost:3001/api/trpc

# Production (Railway)
SYNC_ERP_API_URL=https://sync-erp-api-production.up.railway.app/api/trpc
```

**Used By**:

- `sync-erp/apps/bot`
- `santi-living/apps/proxy`

### 3. `API_KEY` - Local Service Authentication

**Purpose**: Authentication for santi-living's own API

**Used By**:

- `santi-living/apps/proxy`: For middleware auth on `/api/*` endpoints

**Values**:

```bash
# Development
API_KEY=santi_secret_auth_token_2026

# Production - Set in Vercel/Railway
API_KEY={strong_random_key}
```

## Environment Variable Mapping

### sync-erp/apps/api

| Variable     | Source                 | Purpose                    |
| ------------ | ---------------------- | -------------------------- |
| `BOT_SECRET` | `.env` or Railway      | Validate bot service token |
| `PORT`       | Default: 3001          | API server port            |
| `NODE_ENV`   | production/development | Environment mode           |

### sync-erp/apps/bot

| Variable           | Source           | Purpose                                |
| ------------------ | ---------------- | -------------------------------------- |
| `SYNC_ERP_API_URL` | `.env` or Docker | Where to call API                      |
| `SYNC_ERP_API_KEY` | `.env` or Docker | (Legacy) API auth - use BOT_SECRET now |
| `BOT_SECRET`       | `.env` or Docker | Auth secret for API calls              |
| `PORT`             | Default: 3010    | Bot server port                        |

### santi-living/apps/proxy

| Variable           | Source           | Purpose                                   |
| ------------------ | ---------------- | ----------------------------------------- |
| `SYNC_ERP_API_URL` | `.env` or Vercel | Where to call sync-erp API                |
| `BOT_SECRET`       | `.env` or Vercel | Auth secret for sync-erp API              |
| `SYNC_ERP_API_KEY` | `.env` or Vercel | (Legacy) Falls back if BOT_SECRET not set |
| `API_KEY`          | `.env` or Vercel | Local service auth for /api endpoints     |
| `MIDTRANS_*`       | `.env` or Vercel | Payment gateway configs                   |

## Setup Instructions

### Local Development

#### sync-erp

1. Create `.env` files:

```bash
# apps/bot/.env
SYNC_ERP_API_URL=http://localhost:3001/api/trpc
BOT_SECRET=dev_bot_secret_key_2026

# packages/database/.env
DATABASE_URL=postgresql://...
```

2. Start services:

```bash
npm run dev  # Starts API on 3001, Bot on 3010
```

#### santi-living

1. Create `.env`:

```bash
# apps/proxy/.env
SYNC_ERP_API_URL=http://localhost:3001/api/trpc
BOT_SECRET=dev_bot_secret_key_2026
API_KEY=santi_secret_auth_token_2026
MIDTRANS_SERVER_KEY=...
MIDTRANS_CLIENT_KEY=...
```

2. Start services:

```bash
npm run dev
```

### Production Deployment (Railway)

#### sync-erp API Service

Set in Railway dashboard:

```
BOT_SECRET = {generate-strong-random-key}
```

#### sync-erp Bot Service

Set in Railway dashboard:

```
BOT_SECRET = {same-as-API}
SYNC_ERP_API_URL = https://sync-erp-api-production.up.railway.app/api/trpc
```

#### santi-living Proxy Service (Vercel)

Set in Vercel project settings:

```
BOT_SECRET = {same-as-sync-erp}
SYNC_ERP_API_URL = https://sync-erp-api-production.up.railway.app/api/trpc
API_KEY = {generate-strong-random-key}
MIDTRANS_SERVER_KEY = {from-payment-gateway}
MIDTRANS_CLIENT_KEY = {from-payment-gateway}
```

## Validation & Logging

The `EnvironmentValidator` class automatically logs:

- ✅ When variables are properly set
- ⚠️ When using fallback values
- ❌ When critical variables are missing in production

Example output on startup:

```
========================================
📋 Environment Configuration Summary
========================================
NODE_ENV: production

🔐 Authentication:
✅ [ENV] BOT_SECRET: ***2026
✅ [ENV] API_KEY: ***2026

🌐 API Endpoints:
✅ [ENV] SYNC_ERP_API_URL: https://sync-erp-api-production.up.railway.app/api/trpc

========================================
```

## Troubleshooting

### "Missing or invalid Authorization header"

**Solution**: Ensure `BOT_SECRET` is set and matches across services

```bash
# Check env var in container
railway exec printenv | grep BOT_SECRET

# Or for local development
echo $BOT_SECRET
```

### "Invalid bot secret"

**Solution**: `BOT_SECRET` values must match exactly:

- sync-erp API: Expects `BOT_SECRET` from request header
- sync-erp Bot: Sends `BOT_SECRET` in `Authorization: Bearer` header
- santi-living: Sends `BOT_SECRET` (or fallback `SYNC_ERP_API_KEY`)

### Service can't reach API

**Solution**: Verify `SYNC_ERP_API_URL` is accessible

```bash
# Test from bot container
railway exec curl -I https://sync-erp-api-production.up.railway.app/health

# Local test
curl http://localhost:3001/health
```

## Security Notes

⚠️ **Never commit `.env` files** - They contain secrets

✅ **Use `.env.example`** - Document required variables without values

✅ **Rotate secrets regularly** - In production, regenerate auth keys quarterly

✅ **Use Railway/Vercel dashboard** - Never paste secrets in code or git history

✅ **Environment validation** - Services log missing variables to help debugging

## Migration Path

### From `SYNC_ERP_API_KEY` to `BOT_SECRET`

If upgrading from old API key system:

1. Generate new `BOT_SECRET`
2. Update all services to set `BOT_SECRET`
3. Keep `SYNC_ERP_API_KEY` as fallback for backward compatibility
4. Monitor logs for fallback usage
5. Remove `SYNC_ERP_API_KEY` once all services migrated

Current code automatically logs when falling back:

```
⚠️  [ENV] SYNC_ERP_API_KEY: Using SYNC_ERP_API_KEY, but BOT_SECRET is preferred
```
