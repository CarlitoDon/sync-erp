export const CSRF_COOKIE_NAME = 'csrf-token';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const NGROK_SKIP_BROWSER_WARNING_HEADER = 'ngrok-skip-browser-warning';

export type HeaderRecord = Record<string, string>;

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Pick<Response, 'ok' | 'json'>>;

export function getCsrfTokenFromCookie(cookieString = ''): string | undefined {
  const cookie = cookieString
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_COOKIE_NAME}=`));

  if (!cookie) {
    return undefined;
  }

  const value = cookie.slice(CSRF_COOKIE_NAME.length + 1);
  return value ? decodeURIComponent(value) : undefined;
}

export function buildCsrfTokenEndpoint(trpcUrl: string): string {
  const url = new URL(trpcUrl, globalThis.location?.origin);
  url.pathname = url.pathname.replace(/\/api\/trpc(?:\/.*)?$/, '/api/csrf-token');
  url.search = '';
  url.hash = '';
  return url.toString();
}

function resolveUrl(url: string): URL {
  const baseUrl =
    typeof globalThis.location?.origin === 'string'
      ? globalThis.location.origin
      : 'http://localhost';

  return new URL(url, baseUrl);
}

export function buildApiRequestHeaders(apiUrl: string): HeaderRecord {
  const { hostname } = resolveUrl(apiUrl);

  if (
    hostname.endsWith('.ngrok-free.app') ||
    hostname.endsWith('.ngrok-free.dev') ||
    hostname.endsWith('.ngrok.io')
  ) {
    return { [NGROK_SKIP_BROWSER_WARNING_HEADER]: 'true' };
  }

  return {};
}

export async function ensureCsrfToken(
  trpcUrl: string,
  cookieString = globalThis.document?.cookie ?? '',
  fetchFn: FetchLike = globalThis.fetch
): Promise<string | undefined> {
  const cookieToken = getCsrfTokenFromCookie(cookieString);
  if (cookieToken) {
    return cookieToken;
  }

  const endpoint = buildCsrfTokenEndpoint(trpcUrl);
  const response = await fetchFn(endpoint, {
    method: 'GET',
    credentials: 'include',
    headers: buildApiRequestHeaders(endpoint),
  });

  if (!response.ok) {
    return undefined;
  }

  const body = (await response.json()) as { csrfToken?: unknown };
  return typeof body.csrfToken === 'string' && body.csrfToken.length > 0
    ? body.csrfToken
    : getCsrfTokenFromCookie(globalThis.document?.cookie ?? '');
}
