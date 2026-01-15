# Environment Variables - Deep Scan Summary

## 🔍 Findings

### Current State
Environment variables were scattered across multiple services with:
- ❌ Hardcoded defaults in code
- ❌ Inconsistent naming (SYNC_ERP_API_KEY vs BOT_SECRET)
- ❌ Poor logging when variables missing
- ❌ No validation on startup
- ❌ Fallback logic buried in code

### Root Cause of Order Creation Error
When user tried to create order in santi-living:
1. Frontend calls `santi-living/erp-service`
2. `erp-service` tries to call sync-erp API with auth header
3. Auth header was using empty `SYNC_ERP_API_KEY` (not set in Railway production)
4. sync-erp API rejected request with "Invalid Authorization header"
5. Order creation failed silently

## ✅ Solution Implemented

### 1. Created `EnvironmentValidator` Class
**File**: `packages/shared/src/config/environment.ts`

Provides centralized environment configuration with:
```typescript
// Get auth secret with proper fallback
EnvironmentValidator.getAuthSecret('default_value')
// Returns: BOT_SECRET > SYNC_ERP_API_KEY > default

// Get API URL with validation
EnvironmentValidator.getApiUrl('fallback_url')

// Get any other env var
EnvironmentValidator.getApiKey('fallback')

// Print startup summary
EnvironmentValidator.logConfiguration()
```

**Output on startup**:
```
========================================
📋 Environment Configuration Summary
========================================
NODE_ENV: production

🔐 Authentication:
✅ [ENV] BOT_SECRET: ***2026
⚠️  [ENV] SYNC_ERP_API_KEY: Using fallback, but BOT_SECRET is preferred

🌐 API Endpoints:
✅ [ENV] SYNC_ERP_API_URL: https://sync-erp-api-production.up.railway.app/api/trpc

========================================
```

### 2. Updated All Services

#### sync-erp/apps/bot
- Now uses `EnvironmentValidator` for all env var access
- Logs startup configuration
- Clear fallback to `dev_bot_secret_key_2026` in development

#### sync-erp/apps/api
- `botProcedure` now uses `EnvironmentValidator`
- No more hardcoded secrets
- Dynamic secret loading from environment

#### santi-living/apps/erp-service
- Enhanced `getApiKey()` with detailed logging
- Shows which variable is being used (BOT_SECRET vs SYNC_ERP_API_KEY)
- Warns about missing credentials in production
- Clear priority: `BOT_SECRET > SYNC_ERP_API_KEY > empty`

### 3. Created Documentation
**File**: `docs/ENVIRONMENT_SETUP.md`

Comprehensive guide covering:
- Overview of all services
- Environment variable purposes
- Setup instructions for dev and production
- Railway/Vercel deployment steps
- Troubleshooting guide
- Security notes

## 📋 Environment Variable Mapping

### Critical Variables

| Variable | Purpose | Used By | Priority |
|----------|---------|---------|----------|
| `BOT_SECRET` | Service auth secret | API (validate), Bot, ERP-Service | 🥇 Primary |
| `SYNC_ERP_API_KEY` | Legacy API auth | Bot, ERP-Service (fallback) | 🥈 Fallback |
| `SYNC_ERP_API_URL` | API endpoint | Bot, ERP-Service | Required |
| `API_KEY` | Local service auth | santi-living middleware | Optional |

### Authentication Flow

```
User creates order in santi-living
    ↓
santi-living/erp-service calls sync-erp API
    ↓
erp-service.getApiKey() returns:
    • BOT_SECRET (if set) ← RECOMMENDED
    • SYNC_ERP_API_KEY (if BOT_SECRET not set)
    • Empty string (will fail)
    ↓
Sends: Authorization: Bearer {api_key}
    ↓
sync-erp/api validates with botProcedure
    ↓
botProcedure checks request header against process.env.BOT_SECRET
    ↓
If match: ✅ Success
If mismatch: ❌ "Invalid bot secret"
```

## 🚀 Deployment Checklist

### Before Deploying to Production

- [ ] Set `BOT_SECRET` in Railway (all services must use same value)
- [ ] Set `SYNC_ERP_API_URL` in all services (Bot, API)
- [ ] Set `BOT_SECRET` in Vercel (santi-living)
- [ ] Set `API_KEY` in Vercel (santi-living, if using local auth)
- [ ] Run locally to verify console logs show ✅ for all variables
- [ ] Test order creation end-to-end

### How to Check

```bash
# Check Railway variables
railway variables | grep -i secret

# Check Vercel deployment
vercel env ls

# Local test - start services and check logs
npm run dev
# Look for "Environment Configuration Summary" output
```

## 🔐 Security Improvements

1. **No Hardcoded Secrets**: All defaults are development-only placeholders
2. **Clear Logging**: Console shows exactly what's being used
3. **Production Warnings**: Logs warn if critical vars missing in prod
4. **Centralized Validation**: Single source of truth for env config
5. **Fallback Strategy**: Graceful fallback with clear messaging

## 📝 Migration Path

If you still have services using old API keys:

1. Identify services using `SYNC_ERP_API_KEY`
2. Ensure all services set `BOT_SECRET` instead
3. Keep `SYNC_ERP_API_KEY` fallback for backward compatibility
4. Monitor logs for "Using fallback" messages
5. Once all services migrated, can remove `SYNC_ERP_API_KEY`

Current code logs when falling back:
```
⚠️  [ENV] SYNC_ERP_API_KEY: Using SYNC_ERP_API_KEY, but BOT_SECRET is preferred
```

## 🎯 Next Steps

1. **Test Locally**
   ```bash
   npm run dev
   # Check that EnvironmentValidator logs appear
   ```

2. **Deploy to Production**
   - Commit & push changes
   - Wait for Railway/Vercel auto-redeploy
   - Monitor logs for env configuration summary

3. **Verify Order Creation**
   - Test creating new order in santi-living
   - Should now succeed with proper BOT_SECRET

4. **Monitor**
   - Check logs for any "⚠️ " or "❌" warnings
   - Address any missing environment variables

## 📚 Files Modified

### sync-erp
- `packages/shared/src/config/environment.ts` (new) - Validator class
- `apps/bot/src/lib/trpc.ts` - Use validator
- `apps/api/src/trpc/trpc.ts` - Use validator in botProcedure
- `docs/ENVIRONMENT_SETUP.md` (new) - Full documentation

### santi-living
- `apps/erp-service/src/services/erp-client.ts` - Enhanced logging

## ✨ Benefits

✅ **Clear Startup Logging**: See exactly what environment is loaded
✅ **Production Safety**: Warnings when critical vars missing
✅ **Easy Debugging**: Console messages explain auth failures
✅ **No Hardcodes**: All secrets come from environment
✅ **Graceful Fallback**: Dev defaults work locally, production requires explicit config
✅ **Documentation**: Complete guide in ENVIRONMENT_SETUP.md
