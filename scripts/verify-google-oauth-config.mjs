#!/usr/bin/env node

const apiBaseUrl = process.argv[2]?.replace(/\/+$/, '');

if (!apiBaseUrl) {
  console.error(
    'Usage: node scripts/verify-google-oauth-config.mjs <api-base-url>'
  );
  process.exit(1);
}

const expectedRedirectUri = `${apiBaseUrl}/api/auth/google/callback`;
const startUrl = `${apiBaseUrl}/api/auth/google/start?intent=login`;
const requestHeaders = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
};

function fail(message) {
  console.error(`Google OAuth verification failed: ${message}`);
  process.exit(1);
}

function isGoogleOAuthError(url) {
  return (
    url.hostname === 'accounts.google.com' &&
    (url.pathname.includes('/signin/oauth/error') ||
      url.searchParams.has('authError'))
  );
}

async function fetchManual(url) {
  return fetch(url, {
    headers: requestHeaders,
    redirect: 'manual',
  });
}

const startResponse = await fetchManual(startUrl);
const authorizationLocation = startResponse.headers.get('location');

if (startResponse.status !== 302 || !authorizationLocation) {
  fail(
    `${startUrl} returned HTTP ${startResponse.status}; expected a Google redirect.`
  );
}

const authorizationUrl = new URL(authorizationLocation, startUrl);

if (authorizationUrl.origin !== 'https://accounts.google.com') {
  const authError = authorizationUrl.searchParams.get('authError');
  fail(
    authError
      ? `${apiBaseUrl} reported ${authError}.`
      : `${apiBaseUrl} redirected to an unexpected origin.`
  );
}

if (
  authorizationUrl.searchParams.get('redirect_uri') !==
  expectedRedirectUri
) {
  fail(
    `API generated ${authorizationUrl.searchParams.get('redirect_uri') || 'no redirect URI'}; expected ${expectedRedirectUri}.`
  );
}

for (const requiredParameter of ['client_id', 'state']) {
  if (!authorizationUrl.searchParams.get(requiredParameter)) {
    fail(`Google authorization URL is missing ${requiredParameter}.`);
  }
}

let currentUrl = authorizationUrl;
let providerResponse;

for (let redirectCount = 0; redirectCount < 8; redirectCount += 1) {
  if (isGoogleOAuthError(currentUrl)) {
    fail(
      `Google rejected ${expectedRedirectUri} (redirect_uri_mismatch).`
    );
  }

  providerResponse = await fetchManual(currentUrl);
  const nextLocation = providerResponse.headers.get('location');

  if (
    !nextLocation ||
    providerResponse.status < 300 ||
    providerResponse.status >= 400
  ) {
    break;
  }

  currentUrl = new URL(nextLocation, currentUrl);
}

if (!providerResponse) {
  fail('Google authorization endpoint did not respond.');
}

if (isGoogleOAuthError(currentUrl)) {
  fail(
    `Google rejected ${expectedRedirectUri} (redirect_uri_mismatch).`
  );
}

if (providerResponse.status >= 400) {
  fail(
    `Google authorization endpoint returned HTTP ${providerResponse.status}.`
  );
}

if (providerResponse.status >= 300) {
  fail('Google authorization endpoint exceeded the redirect limit.');
}

const providerBody = (await providerResponse.text()).slice(
  0,
  200_000
);
if (
  /redirect_uri_mismatch/i.test(providerBody) ||
  /Error 400[^<]{0,200}redirect_uri_mismatch/i.test(providerBody)
) {
  fail(
    `Google rejected ${expectedRedirectUri} (redirect_uri_mismatch).`
  );
}

process.stdout.write(
  `Google OAuth preflight passed for ${expectedRedirectUri}.\n`
);
