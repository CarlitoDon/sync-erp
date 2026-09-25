import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Request } from 'express';
import {
  resolveCookieDomain,
  getSessionCookieOptions,
  getCsrfCookieOptions,
  getClearSessionCookieOptions,
} from '../../src/modules/auth/cookie';

describe('Cookie domain & options resolution', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.COOKIE_DOMAIN;
    delete process.env.SYNC_ERP_WEB_URL;
    delete process.env.SECURE_COOKIES;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('resolveCookieDomain', () => {
    it('returns explicit COOKIE_DOMAIN if set', () => {
      process.env.COOKIE_DOMAIN = 'khusnudhoni.online';
      expect(resolveCookieDomain('localhost')).toBe('.khusnudhoni.online');

      process.env.COOKIE_DOMAIN = '.santiliving.com';
      expect(resolveCookieDomain('example.com')).toBe('.santiliving.com');
    });

    it('returns undefined for localhost and loopback addresses', () => {
      expect(resolveCookieDomain('localhost')).toBeUndefined();
      expect(resolveCookieDomain('localhost:3000')).toBeUndefined();
      expect(resolveCookieDomain('127.0.0.1')).toBeUndefined();
      expect(resolveCookieDomain('127.0.0.1:5173')).toBeUndefined();
      expect(resolveCookieDomain('192.168.1.10')).toBeUndefined();
    });

    it('returns undefined for vercel preview domains', () => {
      expect(
        resolveCookieDomain('sync-erp-git-dev-doncarlo31s-projects.vercel.app')
      ).toBeUndefined();
      expect(resolveCookieDomain('sync-erp.vercel.app')).toBeUndefined();
    });

    it('extracts apex domain for custom multi-subdomain configurations', () => {
      expect(
        resolveCookieDomain('api-sync-erp.khusnudhoni.online')
      ).toBe('.khusnudhoni.online');
      expect(
        resolveCookieDomain('sync-erp.khusnudhoni.online')
      ).toBe('.khusnudhoni.online');
      expect(
        resolveCookieDomain('api-staging-sync-erp.khusnudhoni.online')
      ).toBe('.khusnudhoni.online');
      expect(
        resolveCookieDomain('sync-erp.santiliving.com')
      ).toBe('.santiliving.com');
    });

    it('extracts hostname from express Request object', () => {
      const mockReq = {
        hostname: 'api-sync-erp.khusnudhoni.online',
      } as unknown as Request;

      expect(resolveCookieDomain(mockReq)).toBe('.khusnudhoni.online');
    });

    it('falls back to SYNC_ERP_WEB_URL if no request or host provided', () => {
      process.env.SYNC_ERP_WEB_URL = 'https://sync-erp.khusnudhoni.online';
      expect(resolveCookieDomain()).toBe('.khusnudhoni.online');
    });
  });

  describe('getSessionCookieOptions', () => {
    it('sets secure and sameSite: none in production/staging', () => {
      process.env.NODE_ENV = 'production';
      const options = getSessionCookieOptions('api-sync-erp.khusnudhoni.online');

      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('none');
      expect(options.path).toBe('/');
      expect(options.domain).toBe('.khusnudhoni.online');
      expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('omits domain for localhost', () => {
      process.env.NODE_ENV = 'development';
      const options = getSessionCookieOptions('localhost');

      expect(options.domain).toBeUndefined();
      expect(options.secure).toBe(false);
      expect(options.sameSite).toBe('lax');
    });
  });

  describe('getCsrfCookieOptions', () => {
    it('keeps httpOnly false so client JavaScript can read the token', () => {
      process.env.NODE_ENV = 'production';
      const options = getCsrfCookieOptions('sync-erp.khusnudhoni.online');

      expect(options.httpOnly).toBe(false);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('none');
      expect(options.domain).toBe('.khusnudhoni.online');
      expect(options.maxAge).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('getClearSessionCookieOptions', () => {
    it('returns matching path and domain for cookie invalidation', () => {
      const options = getClearSessionCookieOptions('api-sync-erp.khusnudhoni.online');

      expect(options.path).toBe('/');
      expect(options.domain).toBe('.khusnudhoni.online');
    });
  });
});
