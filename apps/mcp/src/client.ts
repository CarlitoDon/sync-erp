/**
 * Type-Safe tRPC HTTP Client
 *
 * Handles authentication and provides typed query/mutation methods.
 * All responses are returned as `unknown` — callers must validate if needed.
 */
import { getConfig } from './config.js';

let sessionId: string | null = null;
let loginPromise: Promise<void> | null = null;

/**
 * Extract nested result from tRPC response structure.
 * tRPC responses follow: { result: { data: { json: <actual_data> } } }
 */
function extractResult(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data;

  const record = data as Record<string, unknown>;

  // Batch response: array format
  if (Array.isArray(data)) {
    const first = data[0] as Record<string, unknown> | undefined;
    const nested = first?.result as Record<string, unknown> | undefined;
    const nestedData = nested?.data as Record<string, unknown> | undefined;
    return nestedData?.json ?? data;
  }

  // Single response
  const result = record.result as Record<string, unknown> | undefined;
  const resultData = result?.data as Record<string, unknown> | undefined;
  return resultData?.json ?? data;
}

/**
 * Authenticate with the API and store session ID.
 */
async function login(): Promise<void> {
  const config = getConfig();
  const response = await fetch(`${config.apiUrl}/auth.login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      json: { email: config.email, password: config.password },
    }),
  });

  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}`);
  }

  const raw: unknown = await response.json();
  const data = extractResult(raw);

  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>;
    const session = record.session as Record<string, unknown> | undefined;
    if (session?.id && typeof session.id === 'string') {
      sessionId = session.id;
      return;
    }
  }

  throw new Error('Login failed: no session ID in response');
}

/**
 * Ensure we have a valid session.
 */
async function ensureAuth(): Promise<string> {
  if (!sessionId) {
    if (!loginPromise) {
      loginPromise = login().finally(() => {
        loginPromise = null;
      });
    }
    await loginPromise;
  }
  if (!sessionId) {
    throw new Error('Authentication failed');
  }
  return sessionId;
}

/**
 * Build headers with auth cookie and company header.
 */
function buildHeaders(
  sid: string,
  companyId?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    Cookie: `sessionId=${sid}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (companyId) {
    headers['X-Company-Id'] = companyId;
  }

  return headers;
}

/**
 * Execute a tRPC query (HTTP GET).
 */
export async function apiQuery(
  path: string,
  input?: Record<string, unknown>,
  companyId?: string
): Promise<string> {
  return withRetryOnUnauthorized(async () => {
    const sid = await ensureAuth();
    const config = getConfig();

    const hasInput = input && Object.keys(input).length > 0;
    const queryPart = hasInput
      ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
      : '';

    const url = `${config.apiUrl}/${path}${queryPart}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(sid, companyId),
    });

    return handleApiResponse(response);
  });
}

/**
 * Execute a tRPC mutation (HTTP POST).
 */
export async function apiMutation(
  path: string,
  input?: Record<string, unknown>,
  companyId?: string
): Promise<string> {
  return withRetryOnUnauthorized(async () => {
    const sid = await ensureAuth();
    const config = getConfig();

    const url = `${config.apiUrl}/${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(sid, companyId),
      body: JSON.stringify({ json: input ?? {} }),
    });

    return handleApiResponse(response);
  });
}

async function withRetryOnUnauthorized(
  fn: () => Promise<string>
): Promise<string> {
  try {
    return await fn();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('API unauthorized')
    ) {
      sessionId = null;
      return fn();
    }
    throw error;
  }
}

async function handleApiResponse(response: Response): Promise<string> {
  const raw: unknown = await response.json();

  if (response.status === 401) {
    throw new Error('API unauthorized');
  }

  if (!response.ok) {
    const errMsg =
      typeof raw === 'object' && raw !== null
        ? JSON.stringify(raw, null, 2)
        : String(raw);
    throw new Error(`API error (${response.status}): ${errMsg}`);
  }

  const result = extractResult(raw);
  return JSON.stringify(result, null, 2);
}
