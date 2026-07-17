import { afterEach, describe, expect, it } from 'vitest';
import { getCorsOrigin } from '../../src/cors';

const originalEnv = { ...process.env };

function resolveOrigin(origin: string | undefined) {
  const originHandler = getCorsOrigin();
  if (typeof originHandler !== 'function') {
    throw new Error('Expected function CORS origin handler');
  }

  let outcome:
    | { err: Error | null; allow: unknown }
    | undefined;

  originHandler(origin, (err, allow) => {
    outcome = { err, allow };
  });

  if (!outcome) {
    throw new Error('CORS origin callback was not called');
  }

  return outcome;
}

describe('CORS origin configuration', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows localhost and Vercel preview origins in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CORS_ALLOW_LOCALHOST;
    delete process.env.CORS_ALLOW_VERCEL_PREVIEWS;

    expect(resolveOrigin('http://localhost:5173')).toEqual({
      err: null,
      allow: true,
    });
    expect(resolveOrigin('https://feature-sync-erp.vercel.app')).toEqual(
      {
        err: null,
        allow: true,
      }
    );
  });

  it('blocks implicit localhost and Vercel preview origins in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.sync-erp.com';
    delete process.env.CORS_ALLOW_LOCALHOST;
    delete process.env.CORS_ALLOW_VERCEL_PREVIEWS;

    expect(resolveOrigin('http://localhost:5173').allow).toBeUndefined();
    expect(resolveOrigin('http://localhost:5173').err).toBeInstanceOf(
      Error
    );
    expect(
      resolveOrigin('https://feature-sync-erp.vercel.app').allow
    ).toBeUndefined();
    expect(
      resolveOrigin('https://feature-sync-erp.vercel.app').err
    ).toBeInstanceOf(Error);
  });

  it('allows configured production origins', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.sync-erp.com';

    expect(resolveOrigin('https://app.sync-erp.com')).toEqual({
      err: null,
      allow: true,
    });
  });

  it('allows production preview origins only when explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ALLOW_VERCEL_PREVIEWS = 'true';

    expect(resolveOrigin('https://feature-sync-erp.vercel.app')).toEqual(
      {
        err: null,
        allow: true,
      }
    );
  });
});
