#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

const requestHeaders = Object.freeze({
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
});

export class GoogleOAuthVerificationError extends Error {}

function verificationError(message) {
  return new GoogleOAuthVerificationError(
    `Google OAuth redirect verification failed: ${message}`
  );
}

function isAbsoluteHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate the API's OAuth redirect without contacting Google.
 *
 * The request URL may be a Hostinger loopback URL while
 * expectedRedirectUri must remain the public callback URI configured for the
 * deployment environment. The response Location is inspected but never
 * requested, and neither cookies nor the provider URL are logged.
 */
export async function verifyGoogleOAuthRedirect({
  requestUrl,
  expectedRedirectUri,
  fetchImpl = globalThis.fetch,
}) {
  if (!isAbsoluteHttpUrl(requestUrl)) {
    throw verificationError(
      'the request URL must be an absolute HTTP URL.'
    );
  }
  if (!expectedRedirectUri) {
    throw verificationError('the expected callback URI is missing.');
  }
  if (typeof fetchImpl !== 'function') {
    throw verificationError('the HTTP client is unavailable.');
  }

  let startResponse;
  try {
    startResponse = await fetchImpl(requestUrl, {
      headers: requestHeaders,
      redirect: 'manual',
    });
  } catch {
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
    authorizationUrl = new URL(authorizationLocation, requestUrl);
  } catch {
    throw verificationError(
      'the Location header is not a valid URL.'
    );
  }

  if (authorizationUrl.origin !== 'https://accounts.google.com') {
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
    expectedRedirectUri
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

  return {
    requestUrl,
    expectedRedirectUri,
    status: startResponse.status,
    followedProviderRedirect: false,
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
    'Google OAuth redirect preflight passed on Hostinger loopback.\n'
  );
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  await main();
}
