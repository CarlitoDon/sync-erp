import type { CookieOptions, Request } from 'express';

/**
 * Resolves the appropriate cookie domain based on the request host,
 * explicit environment configuration, or the web application URL.
 *
 * Scenarios:
 * 1. Explicit `COOKIE_DOMAIN` set in environment (e.g. `.khusnudhoni.online`) takes precedence.
 * 2. Localhost, 127.0.0.1, ::1, or raw IPv4 addresses return `undefined` (host-only cookie).
 * 3. Public suffix preview domains (e.g. `*.vercel.app`) return `undefined` (browsers reject PSL wildcards).
 * 4. Multi-subdomain setups (e.g. `api-sync-erp.khusnudhoni.online` + `sync-erp.khusnudhoni.online`):
 *    extracts the apex domain (e.g. `.khusnudhoni.online`) so both web and api subdomains share the session cookie.
 */
export function resolveCookieDomain(
  reqOrHost?: Request | string
): string | undefined {
  if (process.env.COOKIE_DOMAIN) {
    const custom = process.env.COOKIE_DOMAIN.trim();
    if (custom) {
      return custom.startsWith('.') ? custom : `.${custom}`;
    }
  }

  let hostname: string | undefined;
  if (typeof reqOrHost === 'string') {
    hostname = reqOrHost;
  } else if (reqOrHost && typeof reqOrHost.hostname === 'string') {
    hostname = reqOrHost.hostname;
  } else if (process.env.SYNC_ERP_WEB_URL) {
    try {
      hostname = new URL(process.env.SYNC_ERP_WEB_URL).hostname;
    } catch {
      // Invalid URL in env, fallback below
    }
  }

  if (!hostname) {
    return undefined;
  }

  // Strip port if present
  hostname = hostname.split(':')[0].toLowerCase();

  // Localhost, loopback, or IP address: must be host-only
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
    hostname === '::1'
  ) {
    return undefined;
  }

  // Vercel preview domains cannot receive wildcard cookies on *.vercel.app
  if (hostname.endsWith('.vercel.app')) {
    return undefined;
  }

  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return `.${parts.slice(-2).join('.')}`;
  }

  return undefined;
}

/**
 * Returns cookie options for session cookie authentication.
 */
export function getSessionCookieOptions(
  reqOrHost?: Request | string
): CookieOptions {
  const isSecureEnv =
    process.env.SECURE_COOKIES === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'staging';

  const domain = resolveCookieDomain(reqOrHost);

  return {
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: isSecureEnv ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    ...(domain ? { domain } : {}),
  };
}

/**
 * Returns cookie options for CSRF tokens (client-readable).
 */
export function getCsrfCookieOptions(
  reqOrHost?: Request | string
): CookieOptions {
  const isSecureEnv =
    process.env.SECURE_COOKIES === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'staging';

  const domain = resolveCookieDomain(reqOrHost);

  return {
    httpOnly: false, // JS must be able to read it
    secure: isSecureEnv,
    sameSite: isSecureEnv ? 'none' : 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    ...(domain ? { domain } : {}),
  };
}

/**
 * Returns cookie options for clearing authentication session cookies.
 */
export function getClearSessionCookieOptions(
  reqOrHost?: Request | string
): CookieOptions {
  const domain = resolveCookieDomain(reqOrHost);

  return {
    path: '/',
    ...(domain ? { domain } : {}),
  };
}
