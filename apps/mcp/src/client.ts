/**
 * Type-Safe tRPC HTTP Client
 *
 * Handles authentication and provides typed query/mutation methods.
 * All responses are returned as `unknown` — callers must validate if needed.
 */
import { config } from './config.js';

let sessionId: string | null = null;

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
    await login();
  }
  if (!sessionId) {
    throw new Error('Authentication failed');
  }
  return sessionId;
}

/**
 * Build headers with auth cookies.
 */
function buildHeaders(sid: string, companyId?: string): Record<string, string> {
  const cookies = [`sessionId=${sid}`];
  if (companyId) {
    cookies.push(`companyId=${companyId}`);
  }
  return {
    Cookie: cookies.join('; '),
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

/**
 * Execute a tRPC query (HTTP GET).
 */
export async function apiQuery(
  path: string,
  input?: Record<string, unknown>,
  companyId?: string
): Promise<string> {
  const sid = await ensureAuth();

  const hasInput = input && Object.keys(input).length > 0;
  const queryPart = hasInput
    ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : '';

  const url = `${config.apiUrl}/${path}${queryPart}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(sid, companyId),
  });

  const raw: unknown = await response.json();

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

/**
 * Execute a tRPC mutation (HTTP POST).
 */
export async function apiMutation(
  path: string,
  input?: Record<string, unknown>,
  companyId?: string
): Promise<string> {
  const sid = await ensureAuth();

  const url = `${config.apiUrl}/${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(sid, companyId),
    body: JSON.stringify({ json: input ?? {} }),
  });

  const raw: unknown = await response.json();

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
