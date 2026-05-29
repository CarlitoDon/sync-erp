# Security Hardening: Rate Limiting, CSRF, Session Policy

## Overview

This document describes the security hardening implemented for the Sync ERP API.

---

## 1. Redis-Backed Rate Limiting

### Problem
In-memory rate limiting (`Map`-based) does not persist across API restarts and doesn't work with multiple API instances.

### Solution
Replaced with Redis-backed rate limiting using `ioredis`. Falls back to in-memory if Redis is unavailable.

### Configuration

Add `REDIS_URL` to your environment:

```env
# Production (Hostinger/Railway)
REDIS_URL=redis://:password@redis-host:6379

# Local development (default)
REDIS_URL=redis://localhost:6379

# Optional: key prefix for shared Redis instances
REDIS_KEY_PREFIX=sync-erp:api:
```

### Rate Limits

| Endpoint | Max Attempts | Window | Notes |
|----------|-------------|--------|-------|
| `auth.register` | 5 | 15 min | Per IP+UserAgent |
| `auth.login` | 10 | 15 min | Per IP+UserAgent |
| `auth.resendVerification` | 3 | 15 min | Per IP+UserAgent |
| `auth.verifyEmail` | 10 | 15 min | Per IP+UserAgent |
| API Key requests | 1000/hour | 1 hour | Per API key (configurable) |

### Architecture

```
Request → AdaptiveRateLimitService
              ↓
         Redis available?
           ├─ Yes → RedisRateLimitService (Lua script, atomic)
           └─ No  → PublicRateLimitService (in-memory fallback)
```

### Verification

To verify rate limits persist across restarts:

```bash
# 1. Make 10 login attempts
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/trpc/auth.login \
    -H "Content-Type: application/json" \
    -d '{"json":{"email":"test@test.com","password":"wrong"}}'
done

# 2. Restart API
# 3. Try again - should still be blocked
curl -X POST http://localhost:3001/api/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"json":{"email":"test@test.com","password":"wrong"}}'
# Expected: 429 Too Many Requests
```

---

## 2. CSRF Protection

### Problem
Cookie-based session auth is vulnerable to Cross-Site Request Forgery attacks.

### Solution
Double-submit cookie pattern:

1. Server sets `csrf-token` cookie (readable by JS)
2. Client sends `X-CSRF-Token` header on mutating requests
3. Server validates header matches cookie

### Client Integration

```typescript
// 1. Get CSRF token on app load
const { csrfToken } = await fetch('/api/csrf-token').then(r => r.json());

// 2. Include in all mutation requests
fetch('/api/trpc/auth.login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,  // From cookie or /api/csrf-token
  },
  credentials: 'include',  // Send cookies
  body: JSON.stringify({ ... }),
});
```

### Exemptions

- GET/HEAD/OPTIONS requests (safe methods)
- Bearer token auth (API keys aren't auto-sent by browsers)
- Bot service auth (internal)

---

## 3. Session Expiry Policy

### Current Configuration

```typescript
// auth.router.ts
{
  httpOnly: true,
  secure: isSecureEnv,
  sameSite: isSecureEnv ? 'none' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
}
```

### Recommendation

| Tier | Session Duration | Rationale |
|------|-----------------|-----------|
| Free | 7 days | User convenience for free tier |
| Starter | 7 days | Standard |
| Growth | 3 days | More sensitive business data |
| Scale | 1 day | Enterprise security |
| Enterprise | 8 hours | Maximum security |

**Current**: 7 days for all tiers (acceptable for launch).

**Future**: Implement tier-based session expiry when billing tiers are active.

---

## 4. API Key Scope & Expiry Defaults

### Current Defaults

```typescript
// api-key.service.ts
{
  permissions: ['rental:read', 'rental:write'],  // Default scope
  rateLimit: 1000,  // Requests per hour
  expiresAt: null,   // No expiry by default
}
```

### Recommendations

| Setting | Current | Recommended | Notes |
|---------|---------|-------------|-------|
| Default permissions | `rental:read`, `rental:write` | Keep as-is | Sensible default for rental business |
| Default rate limit | 1000/hour | Keep as-is | Good for most integrations |
| Default expiry | None | 90 days | Force key rotation |
| Max keys per company | Unlimited | 5 (Free), 15 (Scale) | Prevent abuse |

**Current**: No expiry (acceptable for launch, add rotation reminders post-launch).

---

## Files Changed

| File | Change |
|------|--------|
| `apps/api/src/modules/common/services/redis.ts` | New: Redis client singleton |
| `apps/api/src/modules/common/services/redis-rate-limit.service.ts` | New: Redis-backed rate limiter |
| `apps/api/src/modules/common/services/adaptive-rate-limit.service.ts` | New: Hybrid Redis/in-memory limiter |
| `apps/api/src/middlewares/csrf.ts` | New: CSRF protection middleware |
| `apps/api/src/app.ts` | Updated: Wire CSRF middleware |
| `apps/api/src/trpc/trpc.ts` | Updated: Use Redis rate limiting |
| `apps/api/src/trpc/routers/auth.router.ts` | Updated: resendVerification limit 5→3 |
| `apps/api/package.json` | Updated: Add ioredis dependency |
| `apps/api/test/unit/redis-rate-limit.service.test.ts` | New: Redis rate limiter tests |
| `apps/api/test/unit/csrf.test.ts` | New: CSRF token tests |

---

## Deployment Checklist

- [ ] Provision Redis instance (Hostinger managed or external)
- [ ] Add `REDIS_URL` to API environment variables
- [ ] Run `npm install` in API package
- [ ] Verify rate limits persist across restarts
- [ ] Update web client to send `X-CSRF-Token` header
- [ ] Test CSRF protection with browser DevTools
