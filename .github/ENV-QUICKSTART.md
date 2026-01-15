# 🔐 Environment Variables - Quick Start Guide

## Single Source of Truth

👉 **Read this first**: [`.github/ENV-MAPPING.md`](.github/ENV-MAPPING.md)

---

## 3-Step Setup

### 1️⃣ Development (Local)

Copy-paste ke 4 files:

```bash
# sync-erp/packages/database/.env
DATABASE_URL="postgresql://postgres:password@localhost:5432/sync_erp?schema=public"

# sync-erp/apps/api/.env
PORT=3001
NODE_ENV=development
BOT_SECRET=dev_bot_secret_key_2026
SANTI_LIVING_WEBHOOK_URL=http://localhost:3002
SANTI_LIVING_WEBHOOK_API_KEY=erp_sync_secret_2026
CORS_ORIGIN=http://localhost:5173

# sync-erp/apps/bot/.env
PORT=3010
SYNC_ERP_API_URL=http://localhost:3001/api/trpc
BOT_SECRET=dev_bot_secret_key_2026
REDIS_URL=redis://localhost:6379

# santi-living/apps/erp-service/.env
PORT=3002
SYNC_ERP_API_URL=http://localhost:3001/api/trpc
BOT_SECRET=dev_bot_secret_key_2026
API_KEY=erp_sync_secret_2026
SANTI_LIVING_COMPANY_ID=demo-company-rental
PUBLIC_BASE_URL=http://localhost:4321
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_SERVER_KEY=SB-Mid-server-test
MIDTRANS_CLIENT_KEY=SB-Mid-client-test
```

Then:
```bash
npm run dev
# Check console untuk "Environment Configuration Summary" ✅
```

### 2️⃣ Production (Railway + Vercel)

#### Railway Console - sync-erp/API
```
BOT_SECRET = {strong-random-key}
SANTI_LIVING_WEBHOOK_URL = https://santi-living-prod.vercel.app/api/webhooks/erp
SANTI_LIVING_WEBHOOK_API_KEY = {strong-random-key-2}
```

#### Railway Console - sync-erp/Bot
```
BOT_SECRET = {same-as-API}
SYNC_ERP_API_URL = https://sync-erp-api-prod.up.railway.app/api/trpc
REDIS_URL = {Railway Redis URL}
```

#### Vercel Console - santi-living
```
BOT_SECRET = {same-as-sync-erp-API}
SYNC_ERP_API_URL = https://sync-erp-api-prod.up.railway.app/api/trpc
API_KEY = {strong-random-key-2}
SANTI_LIVING_COMPANY_ID = {prod-company-uuid}
SANTI_LIVING_WEBHOOK_API_KEY = {same-as-API}
MIDTRANS_IS_PRODUCTION = true
MIDTRANS_SERVER_KEY = {live-key}
MIDTRANS_CLIENT_KEY = {live-key}
```

### 3️⃣ Verify It Works

```bash
# Local
npm run dev
# Lihat console output dengan ✅ marks

# Production
curl https://sync-erp-api-prod.up.railway.app/health
# Should return 200 OK

# Test order flow
# 1. Create rental order di santi-living
# 2. Check sync-erp dashboard → order should appear
# 3. Check logs → webhook notification should log
```

---

## 🚨 Common Mistakes

| ❌ Wrong | ✅ Right | Issue |
|---------|---------|-------|
| `ERP_SYNC_API_KEY` in Astro | `BOT_SECRET` | Wrong env var name |
| BOT_SECRET berbeda di setiap service | BOT_SECRET SAMA | Auth fails |
| Lupa set REDIS_URL di production | Set it in Railway | Bot crashes |
| API_KEY kosong di production | Set random key | Webhook fails |
| Webhook URL tidak https | Use https in prod | Insecure |

---

## 📊 Variable Matrix

```
                    API    Bot   erp-service
BOT_SECRET         [✅] [✅]    [✅]   ← SAMA
SYNC_ERP_API_URL    ❌   [✅]    [✅]
API_KEY             ❌    ❌    [✅]
DATABASE_URL       [✅]   ❌     ❌
REDIS_URL           ❌   [✅]    ❌
PORT               [✅]  [✅]   [✅]
CORS_ORIGIN        [✅]   ❌    [✅]
```

---

## 🔍 Debug Commands

```bash
# Check env var is set (local)
echo $BOT_SECRET
echo $DATABASE_URL

# Check Railway variables
railway variables | grep BOT_SECRET

# Check Vercel variables
vercel env ls

# Test API authentication
curl -H "Authorization: Bearer dev_bot_secret_key_2026" \
  http://localhost:3001/api/trpc/health

# Test webhook
curl -X POST http://localhost:3002/api/webhooks/erp \
  -H "Authorization: Bearer erp_sync_secret_2026" \
  -H "Content-Type: application/json" \
  -d '{"event":"test"}'
```

---

## 📚 Full Documentation

| Document | Purpose |
|----------|---------|
| [ENV-MAPPING.md](ENV-MAPPING.md) | **Complete reference** - variable purposes, interactions, production checklist |
| [ENV-ANALYSIS-REPORT.md](ENV-ANALYSIS-REPORT.md) | Analysis of bugs found + fixes applied |
| [../docs/ENVIRONMENT_SETUP.md](../docs/ENVIRONMENT_SETUP.md) | Historical detailed guide (untuk reference) |

---

## ✨ Recent Fixes (Jan 15, 2026)

1. ✅ Fixed Astro file using wrong env variable
2. ✅ Added `.env.example` untuk bot service
3. ✅ Improved `.env.example` di semua services
4. ✅ Centralized documentation di ENV-MAPPING.md
5. ✅ Created this quick reference

---

## 🤔 Still Confused?

1. Start dengan **ENV-MAPPING.md** → complete reference
2. Follow **3-Step Setup** above
3. Check **Variable Matrix** → what goes where
4. Use **Debug Commands** → verify it works
5. Read **Full Documentation** → deep dive

**Questions?** Check ENV-MAPPING.md section "Troubleshooting" atau "Common Errors & Fixes Found"

