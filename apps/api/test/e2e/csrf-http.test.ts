import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../src/app';

function getSetCookies(header: string | string[] | undefined): string[] {
  if (!header) {
    return [];
  }
  return Array.isArray(header) ? header : [header];
}

describe('CSRF Protection (HTTP)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  it('GET /api/csrf-token returns a token and sets the matching cookie', async () => {
    const res = await request(app).get('/api/csrf-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('csrfToken');

    const cookies = getSetCookies(res.headers['set-cookie']);
    expect(cookies).toBeDefined();
    const csrfCookie = cookies?.find((cookie: string) =>
      cookie.startsWith('csrf-token=')
    );
    expect(csrfCookie).toBeDefined();

    if (!csrfCookie) {
      throw new Error('CSRF cookie not found in response');
    }

    const cookieToken = csrfCookie.split(';')[0].split('=')[1];
    expect(res.body.csrfToken).toBe(cookieToken);
  });

  it('POST to tRPC fails without a CSRF header for cookie auth', async () => {
    const res = await request(app).post('/api/trpc/user.getMe').send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_VALIDATION_FAILED');
  });

  it('POST to tRPC passes CSRF with a valid token from the cookie', async () => {
    const getRes = await request(app).get('/api/csrf-token');
    const cookies = getSetCookies(getRes.headers['set-cookie']);
    const csrfCookieLine = cookies?.find((cookie: string) =>
      cookie.startsWith('csrf-token=')
    );

    if (!csrfCookieLine) {
      throw new Error('CSRF cookie not found');
    }

    const csrfCookie = csrfCookieLine.split(';')[0];
    const token = csrfCookie.split('=')[1];

    const res = await request(app)
      .post('/api/trpc/user.getMe')
      .set('Cookie', [csrfCookie])
      .set('x-csrf-token', token)
      .send({});

    expect(res.status).not.toBe(403);
    if (res.body.error) {
      expect(res.body.error.code).not.toBe('CSRF_VALIDATION_FAILED');
    }
  });

  it('POST to tRPC still bypasses CSRF for Bearer auth without a CSRF header', async () => {
    const res = await request(app)
      .post('/api/trpc/user.getMe')
      .set('Authorization', 'Bearer some-token')
      .send({});

    expect(res.status).not.toBe(403);
    if (res.body.error) {
      expect(res.body.error.code).not.toBe('CSRF_VALIDATION_FAILED');
    }
  });
});
