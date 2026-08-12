#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

const requestHeaders = Object.freeze({
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
});
const GOOGLE_OAUTH_ORIGIN = 'https://accounts.google.com';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_PROVIDER_REDIRECTS = 8;

export class GoogleOAuthVerificationError extends Error {}

function verificationError(message) {
  return new GoogleOAuthVerificationError(
    `Google OAuth redirect verification failed: ${message}`
  );
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function isLoopbackHttpUrl(url) {
  return (
    url.protocol === 'http:' &&
    !url.username &&
    !url.password &&
    ['127.0.0.1', 'localhost', '::1'].includes(url.hostname.toLowerCase())
  );
}

function isPublicHttpsUrl(url) {
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !['127.0.0.1', 'localhost', '::1'].includes(url.hostname.toLowerCase())
  );
}

function validateTimeout(timeoutMs) {
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw verificationError(
      `the timeout must be an integer between 1 and ${MAX_TIMEOUT_MS} milliseconds.`
    );
  }
}

function validateRequestAndCallback({
  requestUrl,
  expectedRedirectUri,
  requestScope,
}) {
  const request = parseUrl(requestUrl);
  const expected = parseUrl(expectedRedirectUri);

  if (!request) {
    throw verificationError('the request URL is not valid.');
  }
  if (!expected) {
    throw verificationError('the expected callback URI is not valid.');
  }
  if (!isPublicHttpsUrl(expected) || expected.search || expected.hash) {
    throw verificationError(
      'the expected callback URI must be a public HTTPS URL without query or fragment.'
    );
  }

  if (requestScope === 'loopback') {
    if (!isLoopbackHttpUrl(request)) {
      throw verificationError(
        'the loopback request URL must use HTTP and target localhost.'
      );
    }
  } else if (requestScope === 'public-edge') {
    if (!isPublicHttpsUrl(request)) {
      throw verificationError(
        'the public-edge request URL must use HTTPS and target a public host.'
      );
    }
    if (request.origin !== expected.origin) {
      throw verificationError(
        'the public-edge request and callback must use the same origin.'
      );
    }
  } else {
    throw verificationError(`unsupported request scope: ${requestScope}.`);
  }

  return { request, expected };
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(verificationError('the OAuth verification request timed out.'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetchImpl(url, {
        ...options,
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);
  } catch (error) {
    if (error instanceof GoogleOAuthVerificationError) throw error;
    if (controller.signal.aborted) {
      throw verificationError('the OAuth verification request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isGoogleOAuthError(url) {
  return (
    url.origin === GOOGLE_OAUTH_ORIGIN &&
    (url.pathname.includes('/signin/oauth/error') ||
      url.searchParams.has('authError') ||
      url.searchParams.get('error') === 'redirect_uri_mismatch')
  );
}

async function verifyGoogleProvider({
  authorizationUrl,
  fetchImpl,
  timeoutMs,
}) {
  let currentUrl = authorizationUrl;

  for (
    let redirectCount = 0;
    redirectCount <= MAX_PROVIDER_REDIRECTS;
    redirectCount += 1
  ) {
    if (isGoogleOAuthError(currentUrl)) {
      throw verificationError(
        'Google rejected the configured callback URI.'
      );
    }

    let providerResponse;
    try {
      providerResponse = await fetchWithTimeout(
        fetchImpl,
        currentUrl.href,
        {
          headers: requestHeaders,
          redirect: 'manual',
        },
        timeoutMs
      );
    } catch (error) {
      if (error instanceof GoogleOAuthVerificationError) throw error;
      throw verificationError('Google OAuth could not be reached.');
    }

    const nextLocation = providerResponse.headers.get('location');
    if (
      providerResponse.status >= 300 &&
      providerResponse.status < 400
    ) {
      if (!nextLocation) {
        throw verificationError(
          'Google returned a redirect without a Location header.'
        );
      }

      const nextUrl = parseUrl(new URL(nextLocation, currentUrl));
      if (!nextUrl || nextUrl.origin !== GOOGLE_OAUTH_ORIGIN) {
        throw verificationError(
          'Google OAuth redirected to an unexpected origin.'
        );
      }
      currentUrl = nextUrl;
      continue;
    }

    if (providerResponse.status >= 400) {
      throw verificationError(
        `Google OAuth returned HTTP ${providerResponse.status}.`
      );
    }

    let providerBody = '';
    if (typeof providerResponse.text === 'function') {
      providerBody = (await providerResponse.text()).slice(0, 200_000);
    }
    if (/redirect_uri_mismatch/i.test(providerBody)) {
      throw verificationError(
        'Google rejected the configured callback URI.'
      );
    }
    return;
  }

  throw verificationError('Google OAuth exceeded the redirect limit.');
}

/**
 * Validate the API's OAuth redirect from a loopback or explicitly scoped edge
 * request. The provider is contacted with manual redirects so an explicit
 * Google redirect_uri_mismatch remains a blocking failure; no cookies, state,
 * or provider URL are logged and no redirect is followed automatically.
 */
export async function verifyGoogleOAuthRedirect({
  requestUrl,
  expectedRedirectUri,
  fetchImpl = globalThis.fetch,
  requestScope = 'loopback',
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!expectedRedirectUri) {
    throw verificationError('the expected callback URI is missing.');
  }
  if (typeof fetchImpl !== 'function') {
    throw verificationError('the HTTP client is unavailable.');
  }
  validateTimeout(timeoutMs);
  const { request, expected } = validateRequestAndCallback({
    requestUrl,
    expectedRedirectUri,
    requestScope,
  });

  let startResponse;
  try {
    startResponse = await fetchWithTimeout(
      fetchImpl,
      request.href,
      {
        headers: requestHeaders,
        redirect: 'manual',
      },
      timeoutMs
    );
  } catch (error) {
    if (error instanceof GoogleOAuthVerificationError) throw error;
    throw verificationError(
      'the local OAuth start endpoint could not be reached.'
    );
  }

  if (startResponse.status !== 302) {
    throw verificationError(
      `the local OAuth start endpoint returned HTTP ${startResponse.status}; expected HTTP 302.`
    );
  }

  const authorizationLocation = startResponse.headers.get('location');
  if (!authorizationLocation) {
    throw verificationError(
      'the HTTP 302 response has no Location header.'
    );
  }

  let authorizationUrl;
  try {
    authorizationUrl = new URL(authorizationLocation, request);
  } catch {
    throw verificationError(
      'the Location header is not a valid URL.'
    );
  }

  if (authorizationUrl.origin !== GOOGLE_OAUTH_ORIGIN) {
    throw verificationError(
      'the Location origin is not Google OAuth.'
    );
  }

  if (
    authorizationUrl.pathname.includes('/signin/oauth/error') ||
    authorizationUrl.searchParams.has('authError')
  ) {
    throw verificationError(
      'Google rejected the configured callback URI.'
    );
  }

  if (
    authorizationUrl.searchParams.get('redirect_uri') !==
    expected.href
  ) {
    throw verificationError(
      'the generated callback URI does not match the configured URI.'
    );
  }

  for (const requiredParameter of ['client_id', 'state']) {
    if (!authorizationUrl.searchParams.get(requiredParameter)) {
      throw verificationError(
        `the Google authorization redirect is missing ${requiredParameter}.`
      );
    }
  }

  await verifyGoogleProvider({
    authorizationUrl,
    fetchImpl,
    timeoutMs,
  });

  return {
    requestUrl: request.href,
    expectedRedirectUri: expected.href,
    status: startResponse.status,
    followedProviderRedirect: false,
    providerValidated: true,
  };
}

function readCliOption(args, optionName) {
  const optionIndex = args.indexOf(optionName);
  if (optionIndex === -1) return undefined;
  return args[optionIndex + 1];
}

function printUsage() {
  console.error(
    'Usage: node scripts/verify-google-oauth-config.mjs --request-url <loopback-url> --expected-redirect-uri <public-callback-url>'
  );
}

async function main() {
  const args = process.argv.slice(2);
  const requestUrl = readCliOption(args, '--request-url');
  const expectedRedirectUri = readCliOption(
    args,
    '--expected-redirect-uri'
  );
  const requestScope =
    readCliOption(args, '--request-scope') || 'loopback';
  const timeoutOption = readCliOption(args, '--timeout-ms');
  const timeoutMs = timeoutOption ? Number(timeoutOption) : DEFAULT_TIMEOUT_MS;

  if (
    !requestUrl ||
    !expectedRedirectUri ||
    args.includes('--help')
  ) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  try {
    await verifyGoogleOAuthRedirect({
      requestUrl,
      expectedRedirectUri,
      requestScope,
      timeoutMs,
    });
  } catch (error) {
    console.error(
      error instanceof GoogleOAuthVerificationError
        ? error.message
        : 'Google OAuth redirect verification failed.'
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `Google OAuth redirect preflight passed (${requestScope}).\n`
  );
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  await main();
}
