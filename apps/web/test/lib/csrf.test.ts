import { describe, expect, it, vi } from 'vitest';
import {
  CSRF_HEADER_NAME,
  NGROK_SKIP_BROWSER_WARNING_HEADER,
  buildApiRequestHeaders,
  buildCsrfTokenEndpoint,
  ensureCsrfToken,
  getCsrfTokenFromCookie,
} from '../../src/lib/csrf';
import { buildTrpcHeaders } from '../../src/lib/trpcProvider';
import type { Operation } from '@trpc/client';

function op(
  type: Operation['type'],
  headers: Record<string, string> = {}
): Operation {
  return {
    id: 1,
    type,
    input: undefined,
    path: 'user.getMe',
    context: { headers },
    signal: null,
  };
}

describe('web CSRF token helpers', () => {
  it('reads the csrf-token cookie safely', () => {
    expect(
      getCsrfTokenFromCookie('theme=dark; csrf-token=abc123; session=s1')
    ).toBe('abc123');
  });

  it('builds the API CSRF endpoint from the tRPC URL', () => {
    expect(buildCsrfTokenEndpoint('https://api.example.com/api/trpc')).toBe(
      'https://api.example.com/api/csrf-token'
    );
  });

  it('fetches a CSRF token with cookies when the cookie is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ csrfToken: 'server-token' }),
    });

    await expect(
      ensureCsrfToken('https://api.example.com/api/trpc', '', fetchMock)
    ).resolves.toBe('server-token');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/csrf-token',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
        headers: {},
      })
    );
  });

  it('adds ngrok browser warning bypass headers for temporary API tunnels', async () => {
    expect(
      buildApiRequestHeaders('https://demo.ngrok-free.dev/api/trpc')
    ).toEqual({
      [NGROK_SKIP_BROWSER_WARNING_HEADER]: 'true',
    });
  });

  it('fetches CSRF tokens through ngrok with the browser warning bypass header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ csrfToken: 'server-token' }),
    });

    await expect(
      ensureCsrfToken(
        'https://demo.ngrok-free.dev/api/trpc',
        '',
        fetchMock
      )
    ).resolves.toBe('server-token');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://demo.ngrok-free.dev/api/csrf-token',
      expect.objectContaining({
        headers: { [NGROK_SKIP_BROWSER_WARNING_HEADER]: 'true' },
      })
    );
  });

  it('uses the CSRF header name expected by the API middleware', () => {
    expect(CSRF_HEADER_NAME).toBe('x-csrf-token');
  });

  it('adds CSRF token to mutating tRPC requests while preserving existing headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ csrfToken: 'server-token' }),
    });

    await expect(
      buildTrpcHeaders({
        trpcUrl: 'https://api.example.com/api/trpc',
        opList: [op('mutation', { 'idempotency-key': 'idem-1' })],
        cookieString: '',
        fetchFn: fetchMock,
        storage: { getItem: () => 'company-1' },
      })
    ).resolves.toEqual({
      'idempotency-key': 'idem-1',
      'x-company-id': 'company-1',
      [CSRF_HEADER_NAME]: 'server-token',
    });
  });

  it('does not fetch a CSRF token for read-only tRPC queries', async () => {
    const fetchMock = vi.fn();

    await expect(
      buildTrpcHeaders({
        trpcUrl: 'https://api.example.com/api/trpc',
        opList: [op('query')],
        cookieString: '',
        fetchFn: fetchMock,
        storage: { getItem: () => null },
      })
    ).resolves.toEqual({});

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('adds ngrok bypass headers to read-only tRPC requests', async () => {
    const fetchMock = vi.fn();

    await expect(
      buildTrpcHeaders({
        trpcUrl: 'https://demo.ngrok-free.dev/api/trpc',
        opList: [op('query')],
        cookieString: '',
        fetchFn: fetchMock,
        storage: { getItem: () => null },
      })
    ).resolves.toEqual({
      [NGROK_SKIP_BROWSER_WARNING_HEADER]: 'true',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
