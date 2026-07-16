/**
 * Type-Safe tRPC HTTP Client
 *
 * Handles authentication and provides typed query/mutation methods.
 * All responses are returned as `unknown` — callers must validate if needed.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';

let sessionId: string | null = null;
let csrfToken: string | null = null;
let loginPromise: Promise<void> | null = null;
let apiStartPromise: Promise<void> | null = null;

const CSRF_COOKIE = 'csrf-token';
const CSRF_HEADER = 'X-CSRF-Token';

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
  await ensureLocalApiAvailable();
  const config = getConfig();
  const csrfHeaders = await getCsrfHeaders(config.apiUrl);
  const response = await fetch(`${config.apiUrl}/auth.login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders },
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
      csrfToken = csrfHeaders[CSRF_HEADER] || null;
      return;
    }
  }

  throw new Error('Login failed: no session ID in response');
}

function extractCookieValue(
  setCookieHeader: string | null,
  cookieName: string
): string | null {
  if (!setCookieHeader) return null;

  const match = setCookieHeader.match(
    new RegExp(`(?:^|[,;]\\s*)${cookieName}=([^;,]+)`)
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function getCsrfHeaders(
  apiUrl: string
): Promise<Record<string, string>> {
  const response = await fetch(getLocalApiHealthUrl(apiUrl), {
    method: 'GET',
  });
  const csrfToken = extractCookieValue(
    response.headers.get('set-cookie'),
    CSRF_COOKIE
  );

  if (!csrfToken) {
    throw new Error(
      `Login failed: ${CSRF_COOKIE} cookie missing from API health response`
    );
  }

  return {
    Cookie: `${CSRF_COOKIE}=${csrfToken}`,
    [CSRF_HEADER]: csrfToken,
  };
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
  companyId?: string,
  csrf?: string | null
): Record<string, string> {
  const cookies = [`sessionId=${sid}`];
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (csrf) {
    cookies.push(`${CSRF_COOKIE}=${csrf}`);
    headers[CSRF_HEADER] = csrf;
  }

  headers['Cookie'] = cookies.join('; ');

  if (companyId) {
    headers['X-Company-Id'] = companyId;
  }

  return headers;
}

function isLocalApiUrl(apiUrl: string): boolean {
  return (
    apiUrl.startsWith('http://localhost:3001/') ||
    apiUrl.startsWith('http://127.0.0.1:3001/') ||
    apiUrl.startsWith('http://host.docker.internal:3001/')
  );
}

function getLocalApiHealthUrl(apiUrl: string): string {
  const url = new URL(apiUrl);
  return `${url.origin}/health`;
}

async function localApiIsHealthy(apiUrl: string): Promise<boolean> {
  try {
    const response = await fetch(getLocalApiHealthUrl(apiUrl), {
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureLocalApiAvailable(): Promise<void> {
  const config = getConfig();
  if (!isLocalApiUrl(config.apiUrl)) {
    return;
  }

  if (await localApiIsHealthy(config.apiUrl)) {
    return;
  }

  if (!apiStartPromise) {
    apiStartPromise = startLocalApi().finally(() => {
      apiStartPromise = null;
    });
  }

  await apiStartPromise;

  if (!(await localApiIsHealthy(config.apiUrl))) {
    throw new Error(
      'Local Sync ERP API is not healthy after auto-start. ' +
        `Checked ${getLocalApiHealthUrl(config.apiUrl)}. ` +
        'Check ~/.hermes/run/sync-erp/api.err.log.'
    );
  }
}

async function startLocalApi(): Promise<void> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const runnerPath = path.resolve(currentDir, '..', 'run-mcp.sh');

  await new Promise<void>((resolve, reject) => {
    const child = spawn(runnerPath, [], {
      env: {
        ...process.env,
        SYNC_ERP_MCP_BOOTSTRAP_ONLY: '1',
      },
      stdio: ['ignore', 'ignore', 'ignore'],
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Local Sync ERP API auto-start failed with exit code ${code ?? 'unknown'}`
        )
      );
    });
  });
}

/**
 * Execute a tRPC query (HTTP GET).
 */
export async function apiQuery(
  path: string,
  input?: Record<string, unknown>,
  companyId?: string,
  includeEmptyInput = false
): Promise<string> {
  return withRetryOnUnauthorized(async () => {
    await ensureLocalApiAvailable();
    const sid = await ensureAuth();
    const config = getConfig();

    const hasInput =
      input !== undefined && (includeEmptyInput || Object.keys(input).length > 0);
    const queryPart = hasInput
      ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
      : '';

    const url = `${config.apiUrl}/${path}${queryPart}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(sid, companyId, csrfToken),
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
    await ensureLocalApiAvailable();
    const sid = await ensureAuth();
    const config = getConfig();

    const url = `${config.apiUrl}/${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(sid, companyId, csrfToken),
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
      csrfToken = null;
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
