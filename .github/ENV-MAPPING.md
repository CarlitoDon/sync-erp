# 🔐 Environment Variables Mapping - Analisis & Setup

**Last Updated**: January 2026  
**Status**: Dokumentasi lengkap untuk semua services

---

## ⚠️ Problem Statement

Environment variables tersebar di banyak tempat dengan dokumentasi yang tidak konsisten:
- ❌ `.env.example` files di 3 tempat berbeda
- ❌ Dokumentasi terpisah: `ENVIRONMENT_SETUP.md`, `ENV_DEEP_SCAN_REPORT.md`, `santi-living-integration-analysis.md`
- ❌ Nama variable yang confusing: `BOT_SECRET` vs `SYNC_ERP_API_KEY` vs `API_KEY`
- ❌ Priority fallback tidak jelas: variable mana yang diprioritaskan?
- ❌ Webhook configuration terpencar

---

## ✅ Complete .env Mapping Table

### Core Variables (WAJIB untuk semua services)

| Variable | Tujuan | Dev Value | Prod Value | Services Pakai |
|----------|--------|-----------|-----------|---|
| **BOT_SECRET** | Auth shared untuk service-to-service | `dev_bot_secret_key_2026` | Generate strong random key | ALL |
| **SYNC_ERP_API_URL** | URL API backend sync-erp | `http://localhost:3001/api/trpc` | `https://sync-erp-api-production.up.railway.app/api/trpc` | bot, erp-service |
| **NODE_ENV** | Environment mode | `development` | `production` | ALL |

---

## 📦 Service-by-Service Configuration

### 1️⃣ sync-erp/apps/api (Main API Backend)

**Location**: `apps/api/.env`  
**Port**: 3001  
**Purpose**: Core ERP API + tRPC endpoint

```env
# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Authentication
BOT_SECRET=dev_bot_secret_key_2026

# Webhooks (untuk kirim update ke external services)
SANTI_LIVING_WEBHOOK_URL=http://localhost:3002
SANTI_LIVING_WEBHOOK_API_KEY=erp_sync_secret_2026

# Database (dimanage by @sync-erp/database)
# DATABASE_URL di packages/database/.env
```

**Priority Fallback**:
- `BOT_SECRET` → required, no fallback
- `SANTI_LIVING_WEBHOOK_URL` → optional, tidak akan notify jika kosong
- `SANTI_LIVING_WEBHOOK_API_KEY` → harus match API_KEY di santi-living jika webhook aktif

**⚠️ Issues Ditemukan**:
- ✅ Setup benar, tapi dokumentasi di `.env.example` terlalu minimal
- ⚠️ Webhook tidak di-validate saat startup

**✅ Production Checklist**:
- [ ] Set `BOT_SECRET` di Railway dashboard
- [ ] Update `SANTI_LIVING_WEBHOOK_URL` ke domain production santi-living
- [ ] Ensure `SANTI_LIVING_WEBHOOK_API_KEY` matches dengan santi-living's `API_KEY`

---

### 2️⃣ sync-erp/packages/database (Prisma + DB)

**Location**: `packages/database/.env`  
**Purpose**: Database connection untuk all services

```env
# WAJIB set untuk local dev + production
DATABASE_URL="postgresql://postgres:password@localhost:5432/sync_erp?schema=public"
```

**⚠️ CRITICAL ISSUES DITEMUKAN**:

1. **`.env.example` terlalu minimal** - hanya 1 line
   ```env
   # Current:
   DATABASE_URL="postgresql://postgres:password@localhost:5432/sync_erp?schema=public"
   
   # Should include:
   DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
   NODE_ENV=development
   ```

2. **Production setup tidak clear** 
   - Di Railway, env var di-set otomatis
   - Tapi tidak ada dokumentasi bagaimana

**✅ Production Checklist**:
- [ ] Set `DATABASE_URL` di Railway (auto-configured)
- [ ] Verify connection: `railway exec psql $DATABASE_URL -c "SELECT 1"`

---

### 3️⃣ sync-erp/apps/bot (WhatsApp Bot Service)

**Location**: `apps/bot/.env`  
**Port**: 3010  
**Purpose**: Kirim message via WhatsApp + update order status

```env
# Server
PORT=3010
NODE_ENV=development

# Connect ke sync-erp API
SYNC_ERP_API_URL=http://localhost:3001/api/trpc
BOT_SECRET=dev_bot_secret_key_2026

# Legacy fallback (deprecated - use BOT_SECRET)
SYNC_ERP_API_KEY=dev_bot_secret_key_2026

# Redis (untuk Baileys WhatsApp auth state)
REDIS_URL=redis://localhost:6379

# Admin WhatsApp number (untuk test/notify)
ADMIN_PHONE=6281234567890
```

**Priority Fallback**:
```
BOT_SECRET (primary) > SYNC_ERP_API_KEY (fallback, deprecated) > error
```

**⚠️ ISSUES DITEMUKAN**:

1. **`.env.example` tidak ada** - file kosong atau tidak exist
   - Bot users bingung apa variable yang diperlukan
   - Port default tidak documented

2. **Redis config not documented**
   - REDIS_URL tidak ada di `.env.example`
   - Diperlukan untuk store WhatsApp session
   - Tidak jelas apa happen jika Redis tidak connect

3. **Legacy variable confusion**
   - `SYNC_ERP_API_KEY` masih bisa dipakai tapi deprecated
   - Code fallback logic ada tapi dokumentasi tidak mention

**⚠️ Di kode (`apps/bot/src/lib/trpc.ts`)**:
```typescript
const API_KEY = EnvironmentValidator.getAuthSecret('dev_bot_secret_key_2026');
```
✅ Benar, tapi variable masih bisa fallback ke `SYNC_ERP_API_KEY`

**✅ Production Checklist**:
- [ ] Set `BOT_SECRET` di Railway (same as API)
- [ ] Set `SYNC_ERP_API_URL` ke production URL
- [ ] Set `REDIS_URL` di Railway (managed Redis instance)
- [ ] Remove atau kosongkan `SYNC_ERP_API_KEY` (use BOT_SECRET only)

---

### 4️⃣ santi-living/apps/erp-service (ERP Sync Service)

**Location**: `apps/erp-service/.env`  
**Port**: 3002  
**Purpose**: Sync rental orders dengan sync-erp API + webhook handler

```env
# Server
PORT=3002
NODE_ENV=development
CORS_ORIGINS=http://localhost:4321,http://localhost:3000

# Company ID di sync-erp (hard-coded untuk santi-living)
SANTI_LIVING_COMPANY_ID=demo-company-rental

# Frontend config
PUBLIC_BASE_URL=http://localhost:4321
ADMIN_WHATSAPP=6281234567890

# Connect ke sync-erp API (CRITICAL)
SYNC_ERP_API_URL=http://localhost:3001/api/trpc
BOT_SECRET=dev_bot_secret_key_2026

# Connect ke bot-service (optional, untuk WhatsApp)
BOT_SERVICE_URL=http://localhost:3000
BOT_SERVICE_API_KEY=your_bot_api_secret_here

# Local API auth (untuk santi-living frontend)
API_KEY=erp_sync_secret_2026

# Payment gateway (Midtrans)
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
MIDTRANS_IS_PRODUCTION=false
```

**⚠️ CRITICAL ISSUES DITEMUKAN**:

1. **BOT_SECRET vs SYNC_ERP_API_KEY confusion**
   - `.env.example` use `BOT_SECRET` ✅
   - Tapi older code might use `SYNC_ERP_API_KEY`
   - File: `src/pages/sewa-kasur/pesanan/[token].astro` line 29:
     ```typescript
     const apiKey = import.meta.env.ERP_SYNC_API_KEY || "santi_secret_auth_token_2026";
     ```
   - ❌ **BUG**: Menggunakan `ERP_SYNC_API_KEY` (wrong var name)
   - Seharusnya: `BOT_SECRET` atau env var yang correct

2. **API_KEY naming conflict**
   - santi-living pakai: `API_KEY=erp_sync_secret_2026` (lokal auth)
   - sync-erp interpret: `API_KEY` untuk santi-living's local endpoints
   - Tapi dokumentasi di `.env.example` tidak explain ini

3. **Missing variables in current code**
   - File: `apps/erp-service/src/server.ts` atau auth middleware
   - Tidak ada dokumentasi apa variable mana yang wajib vs optional

4. **Bot Service integration unclear**
   - `BOT_SERVICE_URL` dan `BOT_SERVICE_API_KEY` ada di contoh
   - Tapi tidak documented apakah wajib atau optional
   - Jika optional, apa behavior jika kosong?

**✅ Production Checklist**:
- [ ] Set `SYNC_ERP_API_URL` ke production sync-erp
- [ ] Set `BOT_SECRET` (SAMA dengan sync-erp)
- [ ] Set `API_KEY` strong random key (untuk frontend auth)
- [ ] Set Midtrans keys dari payment provider
- [ ] Update `SANTI_LIVING_WEBHOOK_URL` di sync-erp API
- [ ] Update `SANTI_LIVING_WEBHOOK_API_KEY` (SAMA dengan API_KEY)

---

## 🔗 Service Interaction & Environment Variables

```
┌──────────────────────┐
│  Santi Living        │
│  Frontend (Astro)    │
└──────────┬───────────┘
           │ calls: /api/* endpoints
           ▼
┌──────────────────────┐
│  erp-service         │
│  PORT=3002           │
│  API_KEY (auth)      │
│  BOT_SECRET (→API)   │
│  SYNC_ERP_API_URL    │
└──────────┬───────────┘
           │ calls: tRPC endpoints via BOT_SECRET
           ▼
┌──────────────────────┐
│  sync-erp API        │
│  PORT=3001           │
│  BOT_SECRET (validate)
│  SANTI_LIVING_       │
│  WEBHOOK_* (notify)  │
└──────────┬───────────┘
           │ sends webhook: order updated
           ▼
┌──────────────────────┐
│  erp-service         │
│  (webhook handler)   │
└──────────────────────┘
```

### Variable Propagation:

```
Development:
BOT_SECRET = "dev_bot_secret_key_2026"
  ├─ sync-erp/API expects this in Authorization header
  ├─ sync-erp/Bot sends this in Bearer token
  ├─ santi-living/erp-service sends this
  └─ ALL must use SAMA value

SYNC_ERP_API_URL = "http://localhost:3001/api/trpc"
  ├─ sync-erp/Bot calls this
  └─ santi-living/erp-service calls this

API_KEY (santi-living) = "erp_sync_secret_2026"
  ├─ santi-living frontend sends this
  ├─ santi-living/erp-service validates this
  ├─ sync-erp/API webhook expects this as SANTI_LIVING_WEBHOOK_API_KEY
  └─ WAJIB SAMA di sync-erp dan santi-living

Production:
- BOT_SECRET: Change to strong random (must sync across all services)
- SYNC_ERP_API_URL: Change ke production domain
- API_KEY: Change to strong random
```

---

## ❌ ERRORS & FIXES FOUND

### Error 1: Astro File Using Wrong Variable Name

**File**: `santi-living/src/pages/sewa-kasur/pesanan/[token].astro` line 29

```typescript
❌ WRONG:
const apiKey = import.meta.env.ERP_SYNC_API_KEY || "santi_secret_auth_token_2026";

✅ SHOULD BE:
const apiKey = import.meta.env.BOT_SECRET || "dev_bot_secret_key_2026";

Atau jika ingin explicit untuk santi-living local auth:
const apiKey = import.meta.env.API_KEY || "santi_secret_auth_token_2026";
```

**Impact**: Order tracking page authentication mungkin fail jika env var tidak set correctly.

---

### Error 2: Missing `.env.example` in bot service

**Current**: File ada tapi empty atau tidak complete

```bash
# Should be at: sync-erp/apps/bot/.env.example

# Server
PORT=3010
NODE_ENV=development

# API Connection
SYNC_ERP_API_URL=http://localhost:3001/api/trpc
BOT_SECRET=dev_bot_secret_key_2026

# Data Persistence
REDIS_URL=redis://localhost:6379

# Optional
SYNC_ERP_API_KEY=dev_bot_secret_key_2026  # Legacy - deprecated
```

---

### Error 3: Webhook Configuration Not Validated

**File**: `sync-erp/apps/api/src/server.ts` atau startup

```typescript
// Should validate webhook config on startup:
const webhookUrl = process.env.SANTI_LIVING_WEBHOOK_URL;
const webhookKey = process.env.SANTI_LIVING_WEBHOOK_API_KEY;

if (webhookUrl && !webhookKey) {
  console.warn('⚠️ SANTI_LIVING_WEBHOOK_URL set but API_KEY missing');
}

if (webhookKey && !webhookUrl) {
  console.warn('⚠️ SANTI_LIVING_WEBHOOK_API_KEY set but URL missing');
}
```

**Current**: No validation = silent failures when webhook misconfigured.

---

### Error 4: `.env.example` in santi-living incomplete

**Current**: Ada `BOT_SERVICE_API_KEY=your_bot_api_secret_here`

```bash
❌ PROBLEM: tidak clear apa ini dan apakah wajib
✅ SHOULD BE documented:
# Optional: for WhatsApp notifications via bot-service
# If set, erp-service can send order updates via WhatsApp
# Must match bot-service API_KEY if using
BOT_SERVICE_URL=http://localhost:3000
BOT_SERVICE_API_KEY=your_bot_api_secret_here
```

---

## 📋 Complete Setup Checklist

### Development Setup (Local)

```bash
# 1. sync-erp/packages/database/.env
DATABASE_URL="postgresql://postgres:password@localhost:5432/sync_erp?schema=public"

# 2. sync-erp/apps/api/.env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
BOT_SECRET=dev_bot_secret_key_2026
SANTI_LIVING_WEBHOOK_URL=http://localhost:3002
SANTI_LIVING_WEBHOOK_API_KEY=erp_sync_secret_2026

# 3. sync-erp/apps/bot/.env
PORT=3010
NODE_ENV=development
SYNC_ERP_API_URL=http://localhost:3001/api/trpc
BOT_SECRET=dev_bot_secret_key_2026
REDIS_URL=redis://localhost:6379

# 4. santi-living/apps/erp-service/.env
PORT=3002
NODE_ENV=development
SYNC_ERP_API_URL=http://localhost:3001/api/trpc
BOT_SECRET=dev_bot_secret_key_2026
API_KEY=erp_sync_secret_2026
SANTI_LIVING_COMPANY_ID=demo-company-rental
PUBLIC_BASE_URL=http://localhost:4321
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_SERVER_KEY=SB-Mid-server-test
MIDTRANS_CLIENT_KEY=SB-Mid-client-test
```

### Production Deployment (Railway/Vercel)

#### Railway - sync-erp/apps/api
```
BOT_SECRET = {strong-random-key-A}
SANTI_LIVING_WEBHOOK_URL = https://santi-living-prod.vercel.app/api/webhooks/erp
SANTI_LIVING_WEBHOOK_API_KEY = {strong-random-key-B}
```

#### Railway - sync-erp/apps/bot
```
BOT_SECRET = {same-as-API: strong-random-key-A}
SYNC_ERP_API_URL = https://sync-erp-api-prod.up.railway.app/api/trpc
REDIS_URL = {Railway Redis URL}
```

#### Vercel - santi-living/apps/erp-service
```
SYNC_ERP_API_URL = https://sync-erp-api-prod.up.railway.app/api/trpc
BOT_SECRET = {same-as-sync-erp: strong-random-key-A}
API_KEY = {strong-random-key-B}
SANTI_LIVING_COMPANY_ID = {production-company-uuid}
SANTI_LIVING_WEBHOOK_API_KEY = {same-as-sync-erp: strong-random-key-B}
MIDTRANS_IS_PRODUCTION = true
MIDTRANS_SERVER_KEY = {production-key}
MIDTRANS_CLIENT_KEY = {production-key}
```

---

## 🔍 Verification Commands

```bash
# Local: Check if services can communicate
curl -H "Authorization: Bearer dev_bot_secret_key_2026" \
  http://localhost:3001/api/trpc/health

# Production: Check Railway variables
railway variables | grep -E "BOT_SECRET|WEBHOOK"

# Production: Check Vercel variables
vercel env ls

# Production: Test webhook
curl -X POST https://sync-erp-api-prod.up.railway.app/api/webhooks/test \
  -H "Authorization: Bearer {SANTI_LIVING_WEBHOOK_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## 📚 Documentation Files & Status

| File | Location | Status | Issue |
|------|----------|--------|-------|
| ENVIRONMENT_SETUP.md | docs/ | ✅ Lengkap | Tapi tersebar |
| ENV_DEEP_SCAN_REPORT.md | docs/ | ✅ Detail | Archive/historical |
| .env.example (API) | apps/api/ | ⚠️ Minimal | Terlalu singkat |
| .env.example (Database) | packages/database/ | ⚠️ Minimal | Hanya 1 line |
| .env.example (Bot) | apps/bot/ | ❌ Missing | Tidak ada |
| .env.example (erp-service) | apps/erp-service/ | ⚠️ Ada | Tapi ada bug di Astro |
| ENV-MAPPING.md | .github/ | ✨ NEW | File ini (complete) |

---

## 🚀 Next Steps (Recommendations)

1. **Fix immediate bugs**:
   - [ ] Fix Astro file menggunakan wrong variable name
   - [ ] Add missing `.env.example` di bot service
   - [ ] Add webhook validation di API startup

2. **Improve documentation**:
   - [ ] Update semua `.env.example` dengan comments lengkap
   - [ ] Konsistenkan naming: gunakan BOT_SECRET everywhere (deprecate SYNC_ERP_API_KEY)
   - [ ] Add variable purpose dan default di masing-masing `.env.example`

3. **Add validation**:
   - [ ] Call `EnvironmentValidator.logConfiguration()` di startup semua services
   - [ ] Validate webhook URL format di API
   - [ ] Add health check endpoints untuk verify env config

4. **Testing**:
   - [ ] Create integration test yang verify env var propagation
   - [ ] Test dengan missing variables untuk ensure clear error messages

---

## 📞 Quick Reference

**Mana variable yang harus sama di semua services?**
- `BOT_SECRET` ← CRITICAL, harus IDENTICAL di API, Bot, dan erp-service

**Mana variable yang unique per service?**
- `API_KEY` (santi-living lokal auth)
- `DATABASE_URL` (hanya di package/database)
- `MIDTRANS_*` (hanya di santi-living)
- `PORT` (unique per service)

**Priority order untuk authentication?**
1. BOT_SECRET (primary)
2. SYNC_ERP_API_KEY (legacy fallback)
3. Kosong (error)

