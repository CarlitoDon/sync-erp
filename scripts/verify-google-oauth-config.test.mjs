import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GoogleOAuthVerificationError,
  verifyGoogleOAuthRedirect,
} from './verify-google-oauth-config.mjs';

const requestUrl =
  'http://127.0.0.1:3001/api/auth/google/start?intent=login';
const expectedRedirectUri =
  'https://api-staging.santiliving.com/api/auth/google/callback';
const providerUrl = new URL(
  'https://accounts.google.com/o/oauth2/v2/auth'
);
providerUrl.searchParams.set('client_id', 'client-id');
providerUrl.searchParams.set('redirect_uri', expectedRedirectUri);
providerUrl.searchParams.set('response_type', 'code');
providerUrl.searchParams.set('state', 'state-must-not-leak');

function response(status, location) {
  return {
    status,
    headers: new Headers(location ? { location } : {}),
  };
}

function mockFetch(result) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return result;
  };
  return { calls, fetchImpl };
}

test('accepts an exact public callback from a Hostinger loopback request', async () => {
  const { calls, fetchImpl } = mockFetch(
    response(302, providerUrl.href)
  );

  const result = await verifyGoogleOAuthRedirect({
    requestUrl,
    expectedRedirectUri,
    fetchImpl,
  });

  assert.equal(result.status, 302);
  assert.equal(result.followedProviderRedirect, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, requestUrl);
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(calls[0].options.headers.cookie, undefined);
});

for (const [name, result, expectedMessage] of [
  [
    'rejects a non-302 response',
    response(200, providerUrl.href),
    'expected HTTP 302',
  ],
  [
    'rejects a 302 without Location',
    response(302),
    'no Location header',
  ],
  [
    'rejects a non-Google Location',
    response(
      302,
      'https://evil.example/oauth?state=state-must-not-leak'
    ),
    'Location origin is not Google OAuth',
  ],
  [
    'rejects a mismatched callback URI',
    response(
      302,
      providerUrl.href.replace(
        encodeURIComponent(expectedRedirectUri),
        encodeURIComponent('https://api.example/wrong-callback')
      )
    ),
    'does not match the configured URI',
  ],
  [
    'rejects a redirect missing state',
    response(
      302,
      providerUrl.href.replace('&state=state-must-not-leak', '')
    ),
    'missing state',
  ],
  [
    'rejects a redirect missing client_id',
    response(
      302,
      providerUrl.href.replace('client_id=client-id&', '')
    ),
    'missing client_id',
  ],
]) {
  test(name, async () => {
    const { fetchImpl } = mockFetch(result);

    await assert.rejects(
      verifyGoogleOAuthRedirect({
        requestUrl,
        expectedRedirectUri,
        fetchImpl,
      }),
      (error) => {
        assert.ok(error instanceof GoogleOAuthVerificationError);
        assert.match(error.message, new RegExp(expectedMessage));
        assert.doesNotMatch(error.message, /state-must-not-leak/);
        assert.doesNotMatch(error.message, /accounts\.google\.com/);
        return true;
      }
    );
  });
}

test('does not follow the provider redirect or expose its URL on request failure', async () => {
  const { calls, fetchImpl } = mockFetch(
    response(302, `${providerUrl.href}&secret=do-not-log`)
  );
  const originalFetch = globalThis.fetch;
  let providerFollowed = false;
  globalThis.fetch = async (url, options) => {
    if (url === providerUrl.href) providerFollowed = true;
    return fetchImpl(url, options);
  };

  try {
    await verifyGoogleOAuthRedirect({
      requestUrl,
      expectedRedirectUri: 'https://api.example/wrong-callback',
    });
  } catch (error) {
    assert.match(error.message, /does not match the configured URI/);
    assert.doesNotMatch(error.message, /secret=do-not-log/);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(providerFollowed, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, requestUrl);
});
