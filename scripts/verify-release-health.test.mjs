import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateReleaseHealthPayload,
  verifyReleaseHealth,
} from './verify-release-health.mjs';

const COMMIT = 'a'.repeat(40);

test('accepts a health response with the expected release identity', () => {
  assert.deepEqual(
    validateReleaseHealthPayload({
      payload: {
        status: 'ok',
        release: { commit: COMMIT, version: '0.0.1' },
      },
      expectedSha: COMMIT,
    }),
    { commit: COMMIT, version: '0.0.1' }
  );
});

test('rejects a health response for a different release', () => {
  assert.throws(
    () =>
      validateReleaseHealthPayload({
        payload: {
          release: { commit: 'b'.repeat(40), version: '0.0.1' },
        },
        expectedSha: COMMIT,
      }),
    /does not match expected/
  );
});

test('accepts an HTTP health response through the workflow verifier', async () => {
  const result = await verifyReleaseHealth({
    url: 'https://example.test/health',
    expectedSha: COMMIT,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          status: 'ok',
          release: { commit: COMMIT, version: '1.0.0' },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      ),
  });

  assert.deepEqual(result, { commit: COMMIT, version: '1.0.0' });
});

test('allows explicit unknown version when no manifest is available', () => {
  assert.deepEqual(
    validateReleaseHealthPayload({
      payload: {
        status: 'ok',
        release: { commit: COMMIT, version: 'unknown' },
      },
      expectedSha: COMMIT,
    }),
    { commit: COMMIT, version: 'unknown' }
  );
});
