import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  LIMITS,
  buildGithubPullRequestUrl,
  buildReviewBody,
  buildBoundedDiff,
  buildBoundedReviewInput,
  fetchPullRequest,
  fetchJson,
  isAiProviderUnavailable,
  parseReviewArtifact,
  parseReviewPayload,
  redactSensitiveText,
  requestHttp,
  serializeReviewArtifact,
  serializeSkippedReviewArtifact,
  validatePrNumber,
  validatePullRequestIdentity,
} from './ai-review-common.mjs';
import {
  callAiReview,
  parseProviderReview,
  runAnalyzer,
} from './ai-review-analyzer.mjs';
import { revalidateAndPublish } from './ai-review-publisher.mjs';

const BASE_SHA = '1'.repeat(40);
const HEAD_SHA = '2'.repeat(40);
const NEXT_HEAD_SHA = '3'.repeat(40);
const IDENTITY = {
  repository: 'owner/repo',
  prNumber: 42,
  baseRef: 'dev',
  baseSha: BASE_SHA,
  headSha: HEAD_SHA,
  headRepository: 'owner/repo',
};

function response(status, value, { headers, body, text } = {}) {
  return {
    status,
    ...(headers === undefined ? {} : { headers }),
    ...(body === undefined ? {} : { body }),
    text:
      text ??
      (async () => (typeof value === 'string' ? value : JSON.stringify(value))),
  };
}

function pullRequest(overrides = {}) {
  return {
    number: IDENTITY.prNumber,
    state: 'open',
    draft: false,
    title: 'Safe change',
    body: 'A bounded description.',
    base: {
      ref: IDENTITY.baseRef,
      sha: IDENTITY.baseSha,
      repo: { full_name: IDENTITY.repository },
    },
    head: {
      ref: 'codex/safe-change',
      sha: IDENTITY.headSha,
      repo: { full_name: IDENTITY.headRepository },
    },
    ...overrides,
  };
}

function review(verdict = 'APPROVE') {
  return {
    verdict,
    summary: 'The change is safe and sufficiently validated.',
    issues: [],
  };
}

function artifact(verdict = 'APPROVE') {
  return JSON.parse(
    serializeReviewArtifact({ identity: IDENTITY, review: review(verdict) })
  );
}

function skippedArtifact(reason = 'AI provider returned HTTP 530') {
  return JSON.parse(
    serializeSkippedReviewArtifact({ identity: IDENTITY, reason })
  );
}

test('workflow keeps a trusted-base trigger and least-privilege job split', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ai-review.yml', import.meta.url), 'utf8');
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /branches: \[dev, main\]/);
  assert.doesNotMatch(workflow, /^\s+pull_request:/m);
  assert.doesNotMatch(workflow, /workflow_dispatch/);
  assert.doesNotMatch(workflow, /head_ref|base_ref|inputs\./);
  assert.match(
    workflow,
    /types: \[opened, edited, reopened, synchronize, ready_for_review\]/
  );
  const expectedActionPins = [
    'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
    'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
    'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
    'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093',
  ];
  for (const actionPin of expectedActionPins) assert.match(workflow, new RegExp(actionPin));
  assert.equal(
    (workflow.match(/uses: [^\s]+@[0-9a-f]{40}/g) || []).length,
    6
  );
  assert.doesNotMatch(workflow, /uses: [^\s]+@v[0-9]+/);
  assert.equal((workflow.match(/runs-on: ubuntu-24\.04/g) || []).length, 2);
  assert.match(workflow, /analyzer:[\s\S]*timeout-minutes: 15/);
  assert.match(workflow, /publisher:[\s\S]*timeout-minutes: 10/);
  assert.equal(
    (workflow.match(/ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/g) || []).length,
    2
  );
  assert.equal((workflow.match(/persist-credentials: false/g) || []).length, 2);
  assert.match(workflow, /analyzer:[\s\S]*pull-requests: read/);
  assert.match(workflow, /publisher:[\s\S]*pull-requests: write/);
  assert.doesNotMatch(workflow, /npm install|npm ci|tsx|curl|execSync/);
  const analyzer = workflow.slice(workflow.indexOf('analyzer:'), workflow.indexOf('publisher:'));
  const publisher = workflow.slice(workflow.indexOf('publisher:'));
  assert.match(analyzer, /AI_API_KEY:/);
  assert.doesNotMatch(publisher, /AI_API_KEY|NINE_ROUTER_TUNNEL_API_KEY/);
  const analyzerSetup = analyzer.indexOf('name: Setup Node.js');
  const analyzerContract = analyzer.indexOf(
    'run: node --test scripts/ai-review-security.test.mjs'
  );
  const analyzerSecret = analyzer.indexOf('AI_API_KEY:');
  assert.ok(analyzerSetup >= 0 && analyzerContract > analyzerSetup);
  assert.ok(analyzerContract < analyzerSecret);
});

test('security contract is wired into pull-request CI before dependency install', async () => {
  const [packageText, ciWorkflow] = await Promise.all([
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../.github/workflows/ci-cd.yml', import.meta.url), 'utf8'),
  ]);
  const packageJson = JSON.parse(packageText);
  assert.equal(
    packageJson.scripts['test:ai-review-security'],
    'node --test scripts/ai-review-security.test.mjs'
  );
  const ciApi = ciWorkflow.indexOf('  ci-api:');
  const setupNode = ciWorkflow.indexOf(
    '- uses: actions/setup-node@v4',
    ciApi
  );
  const contract = ciWorkflow.indexOf(
    'run: npm run test:ai-review-security',
    setupNode
  );
  const install = ciWorkflow.indexOf('name: Install dependencies', setupNode);
  assert.ok(ciApi >= 0);
  assert.ok(setupNode > ciApi);
  assert.ok(contract > setupNode);
  assert.ok(contract < install);
});

test('trusted modules contain no shell execution or PR-head checkout behavior', async () => {
  const [common, analyzer, publisher] = await Promise.all([
    readFile(new URL('./ai-review-common.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./ai-review-analyzer.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./ai-review-publisher.mjs', import.meta.url), 'utf8'),
  ]);
  for (const source of [common, analyzer, publisher]) {
    assert.doesNotMatch(source, /node:child_process|execSync|spawnSync|\bcurl\b/);
    assert.doesNotMatch(source, /head_ref|base_ref/);
  }
  assert.doesNotMatch(publisher, /AI_API_KEY|NINE_ROUTER_TUNNEL_API_KEY/);
  assert.match(analyzer, /fetchPullRequestFiles/);
  assert.match(publisher, /Pull request head SHA changed after analysis/);
});

test('PR #104-sized review input accepts every complete changed-file patch', async () => {
  const patchLengths = [12_687, 20_596, 2_756, 2_394, 1_885];
  const files = patchLengths.map((length, index) => ({
    filename: `src/pr-104-file-${index + 1}.ts`,
    status: 'modified',
    patch: String(index).repeat(length),
  }));
  const totalPatchChars = patchLengths.reduce((total, length) => total + length, 0);
  const reviewInput = buildBoundedReviewInput(pullRequest(), files);
  let providerInput;

  assert.equal(LIMITS.maxPatchChars, 50_000);
  assert.equal(LIMITS.maxDiffChars, 60_000);
  assert.equal(LIMITS.maxReviewInputChars, 90_000);
  assert.equal(totalPatchChars, 40_318);
  for (const file of files) {
    assert.match(reviewInput, new RegExp(`File: ${file.filename}`));
  }
  assert.ok(reviewInput.length <= LIMITS.maxReviewInputChars);

  const result = await callAiReview({
    reviewInput,
    apiBaseUrl: 'https://provider.example/v1',
    apiKey: 'provider-secret-token',
    model: 'test-model',
    fetchImpl: async (_url, init) => {
      providerInput = JSON.parse(init.body).messages[1].content;
      return response(200, { choices: [{ message: { content: JSON.stringify(review()) } }] });
    },
  });

  assert.deepEqual(result, review());
  assert.equal(providerInput, `Review this pull request:\n\n${reviewInput}`);
});

test('bounded diff and review input reject oversized patches, files, and inputs', async () => {
  assert.throws(
    () => buildBoundedDiff([{ filename: 'a.ts', status: 'modified', patch: 'x'.repeat(LIMITS.maxPatchChars + 1) }]),
    /patch exceeds size limit/
  );
  assert.throws(
    () => buildBoundedDiff(
      Array.from({ length: LIMITS.maxFiles + 1 }, (_, index) => ({
        filename: `file-${index}.ts`,
        status: 'modified',
        patch: 'x',
      }))
    ),
    /file count exceeds size limit/
  );
  assert.throws(
    () => buildBoundedDiff([
      { filename: 'a.ts', status: 'modified', patch: 'x'.repeat(30_000) },
      { filename: 'b.ts', status: 'modified', patch: 'x'.repeat(30_000) },
    ]),
    /diff exceeds size limit/
  );
  let fetchCalled = false;
  await assert.rejects(
    () =>
      callAiReview({
        reviewInput: 'x'.repeat(LIMITS.maxReviewInputChars + 1),
        apiBaseUrl: 'https://provider.example/v1',
        apiKey: 'provider-secret-token',
        model: 'test-model',
        fetchImpl: async () => {
          fetchCalled = true;
          return response(200, { choices: [{ message: { content: JSON.stringify(review()) } }] });
        },
      }),
    /AI review input exceeds size limit/
  );
  assert.equal(fetchCalled, false);
});

test('AI provider request explicitly accepts and sends standard JSON', async () => {
  let providerRequest;
  await callAiReview({
    reviewInput: 'bounded',
    apiBaseUrl: 'https://provider.example/v1',
    apiKey: 'provider-secret-token',
    model: 'test-model',
    fetchImpl: async (url, init) => {
      providerRequest = { url, init };
      return response(200, { choices: [{ message: { content: JSON.stringify(review()) } }] });
    },
  });

  assert.equal(providerRequest.init.headers.Accept, 'application/json');
  assert.equal(providerRequest.init.headers['Content-Type'], 'application/json');
});

test('PR identity validation requires the exact open non-draft base/head tuple', () => {
  assert.deepEqual(validatePullRequestIdentity(pullRequest(), IDENTITY), IDENTITY);
  assert.throws(
    () => validatePullRequestIdentity(pullRequest({ state: 'closed' }), IDENTITY),
    /not the expected open/
  );
  assert.throws(
    () => validatePullRequestIdentity(pullRequest({ draft: true }), IDENTITY),
    /not the expected open/
  );
  assert.throws(
    () => validatePullRequestIdentity(pullRequest({ base: { ...pullRequest().base, ref: 'main' } }), IDENTITY),
    /SHA or base branch changed/
  );
  assert.throws(
    () => validatePullRequestIdentity(pullRequest({ head: { ...pullRequest().head, sha: NEXT_HEAD_SHA } }), IDENTITY),
    /SHA or base branch changed/
  );
  assert.throws(
    () => validatePullRequestIdentity(pullRequest({ base: { ...pullRequest().base, repo: { full_name: 'attacker/repo' } } }), IDENTITY),
    /base repository/
  );
});

test('review schema accepts only the two publishable verdicts and exact issue shape', () => {
  assert.equal(parseReviewPayload(review('APPROVE')).verdict, 'APPROVE');
  assert.equal(parseReviewPayload(review('REQUEST_CHANGES')).verdict, 'REQUEST_CHANGES');
  assert.throws(() => parseReviewPayload({ ...review(), verdict: 'COMMENT' }), /unsupported verdict/);
  assert.throws(() => parseReviewPayload({ ...review(), extra: 'not allowed' }), /unexpected schema/);
  assert.throws(
    () => parseReviewPayload({ ...review(), summary: 'x'.repeat(LIMITS.maxSummaryChars + 1) }),
    /summary exceeds size limit/
  );
  assert.throws(
    () => parseReviewPayload({ ...review(), issues: [{ file: 'x.ts', line: 1, severity: 'warning', message: 'x', extra: true }] }),
    /unexpected schema/
  );
});

test('malformed and oversized provider output is rejected without exposing response text', async () => {
  assert.throws(
    () => parseProviderReview({ choices: [{ message: { content: '{"verdict":"APPROVE"}' } }] }),
    /Malformed AI review result/
  );
  assert.throws(
    () => parseProviderReview({ choices: [{ message: { content: `{"verdict":"APPROVE","summary":"${'x'.repeat(LIMITS.maxSummaryChars + 1)}","issues":[]}` } }] }),
    /summary exceeds size limit/
  );
  await assert.rejects(
    () =>
      callAiReview({
        reviewInput: 'bounded',
        apiBaseUrl: 'https://provider.example/v1',
        apiKey: 'provider-secret-token',
        model: 'test-model',
        fetchImpl: async () => response(503, { error: 'provider-secret-token' }),
      }),
    (error) => {
      assert.match(error.message, /AI provider returned HTTP 503/);
      assert.doesNotMatch(error.message, /provider-secret-token/);
      return true;
    }
  );
  await assert.rejects(
    () =>
      callAiReview({
        reviewInput: 'bounded',
        apiBaseUrl: 'https://provider.example/v1',
        apiKey: 'provider-secret-token',
        model: 'test-model',
        fetchImpl: async () => response(200, 'x'.repeat(LIMITS.maxProviderResponseChars + 1)),
      }),
    /AI provider response exceeds size limit/
  );
});

test('HTTP requests time out and response bodies stay bounded without body exposure', async () => {
  let requestSignal;
  await assert.rejects(
    () =>
      requestHttp({
        url: 'https://github.example.test/slow',
        token: 'github-secret-token',
        timeoutMs: 20,
        fetchImpl: (_url, init) => {
          requestSignal = init.signal;
          return new Promise(() => {});
        },
      }),
    (error) => {
      assert.match(error.message, /HTTP service request timed out/);
      assert.doesNotMatch(error.message, /github-secret-token|response-body-secret/);
      return true;
    }
  );
  assert.equal(requestSignal.aborted, true);

  let textRead = false;
  await assert.rejects(
    () =>
      fetchJson({
        url: 'https://provider.example.test/v1/chat/completions',
        token: 'provider-secret-token',
        service: 'AI provider',
        maxChars: 10,
        fetchImpl: async () =>
          response(200, 'response-body-secret', {
            headers: { get: () => '11' },
            text: async () => {
              textRead = true;
              return 'response-body-secret';
            },
          }),
      }),
    (error) => {
      assert.match(error.message, /AI provider response exceeds size limit/);
      assert.doesNotMatch(error.message, /response-body-secret|provider-secret-token/);
      return true;
    }
  );
  assert.equal(textRead, false);

  let cancelled = false;
  await assert.rejects(
    () =>
      fetchJson({
        url: 'https://provider.example.test/v1/chat/completions',
        token: 'provider-secret-token',
        service: 'AI provider',
        maxChars: 5,
        fetchImpl: async () =>
          response(200, undefined, {
            body: {
              getReader() {
                return {
                  async read() {
                    return { done: false, value: Buffer.from('response-body-secret') };
                  },
                  async cancel() {
                    cancelled = true;
                  },
                  releaseLock() {},
                };
              },
            },
          }),
      }),
    (error) => {
      assert.match(error.message, /AI provider response exceeds size limit/);
      assert.doesNotMatch(error.message, /response-body-secret|provider-secret-token/);
      return true;
    }
  );
  assert.equal(cancelled, true);

  let fallbackTextRead = false;
  await assert.rejects(
    () =>
      fetchJson({
        url: 'https://provider.example.test/v1/chat/completions',
        token: 'provider-secret-token',
        service: 'AI provider',
        timeoutMs: 20,
        fetchImpl: async () =>
          response(200, undefined, {
            text: () => {
              fallbackTextRead = true;
              return new Promise(() => {});
            },
          }),
      }),
    (error) => {
      assert.match(error.message, /AI provider response timed out/);
      assert.doesNotMatch(error.message, /response-body-secret|provider-secret-token/);
      return true;
    }
  );
  assert.equal(fallbackTextRead, true);
});

test('chunked stream over-limit is detected incrementally and cancels the reader', async () => {
  let readCount = 0;
  let cancelCount = 0;
  let releaseCount = 0;
  const chunks = [Buffer.from('123'), Buffer.from('456')];
  const reader = {
    async read() {
      return { done: false, value: chunks[readCount++] };
    },
    async cancel() {
      cancelCount += 1;
    },
    releaseLock() {
      releaseCount += 1;
    },
  };

  await assert.rejects(
    () =>
      fetchJson({
        url: 'https://provider.example.test/v1/chat/completions',
        service: 'AI provider',
        maxChars: 5,
        fetchImpl: async () =>
          response(200, undefined, {
            body: { getReader: () => reader },
          }),
      }),
    /AI provider response exceeds size limit/
  );
  assert.equal(readCount, 2);
  assert.equal(cancelCount, 1);
  assert.equal(releaseCount, 1);
});

test('stream read errors cancel the reader and keep response details out of errors', async () => {
  let cancelCount = 0;
  let releaseCount = 0;
  const reader = {
    async read() {
      throw new Error('stream-body-secret');
    },
    async cancel() {
      cancelCount += 1;
    },
    releaseLock() {
      releaseCount += 1;
    },
  };

  await assert.rejects(
    () =>
      fetchJson({
        url: 'https://provider.example.test/v1/chat/completions',
        service: 'AI provider',
        fetchImpl: async () =>
          response(200, undefined, {
            body: { getReader: () => reader },
          }),
      }),
    (error) => {
      assert.match(error.message, /AI provider response could not be read/);
      assert.doesNotMatch(error.message, /stream-body-secret/);
      return true;
    }
  );
  assert.equal(cancelCount, 1);
  assert.equal(releaseCount, 1);
});

test('GitHub HTTP errors are status-only and never include response bodies', async () => {
  let bodyRead = false;
  await assert.rejects(
    () =>
      fetchPullRequest(
        IDENTITY.repository,
        IDENTITY.prNumber,
        'github-secret-token',
        async () =>
          response(404, { message: 'github-secret-token' }, {
            text: async () => {
              bodyRead = true;
              return JSON.stringify({ message: 'github-secret-token' });
            },
          })
      ),
    (error) => {
      assert.match(error.message, /GitHub pull request API returned HTTP 404/);
      assert.doesNotMatch(error.message, /github-secret-token/);
      return true;
    }
  );
  assert.equal(bodyRead, true);
});

test('non-2xx chunked bodies are cancelled before status-only errors', async () => {
  let cancelCount = 0;
  const reader = {
    async read() {
      return { done: false, value: Buffer.from('too-large') };
    },
    async cancel() {
      cancelCount += 1;
    },
    releaseLock() {},
  };

  await assert.rejects(
    () =>
      fetchJson({
        url: 'https://github.example.test/repos/owner/repo/pulls/42',
        service: 'GitHub pull request API',
        maxChars: 4,
        fetchImpl: async () =>
          response(503, undefined, {
            body: { getReader: () => reader },
          }),
      }),
    (error) => {
      assert.equal(error.message, 'GitHub pull request API returned HTTP 503');
      return true;
    }
  );
  assert.equal(cancelCount, 1);
});

test('publisher re-fetches and rejects a stale head before any POST', async () => {
  const calls = [];
  await assert.rejects(
    () =>
      revalidateAndPublish({
        artifact: artifact(),
        expected: IDENTITY,
        token: 'github-write-token',
        fetchImpl: async (url, init) => {
          calls.push({ url, init });
          return response(200, pullRequest({ head: { ...pullRequest().head, sha: NEXT_HEAD_SHA } }));
        },
      }),
    /head SHA changed after analysis/
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, 'GET');
});

test('publisher performs only the intended re-fetch GET and review POST', async () => {
  const calls = [];
  let publicationBodyRead = false;
  const result = await revalidateAndPublish({
    artifact: artifact('REQUEST_CHANGES'),
    expected: IDENTITY,
    token: 'github-write-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return calls.length === 1
        ? response(200, pullRequest())
        : response(200, { id: 123 }, {
            text: async () => {
              publicationBodyRead = true;
              return JSON.stringify({ id: 123 });
            },
          });
    },
  });
  assert.equal(result.verdict, 'REQUEST_CHANGES');
  assert.equal(result.event, 'COMMENT');
  assert.equal(result.commitId, HEAD_SHA);
  assert.equal(calls.length, 2);
  assert.equal(publicationBodyRead, true);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[1].init.method, 'POST');
  assert.match(calls[1].url, /\/repos\/owner\/repo\/pulls\/42\/reviews$/);
  const publication = JSON.parse(calls[1].init.body);
  assert.equal(publication.event, 'COMMENT');
  assert.equal(publication.commit_id, HEAD_SHA);
  assert.match(publication.body, /AI verdict is advisory|Advisory AI verdict/);
  assert.match(publication.body, /REQUEST_CHANGES/);
  assert.doesNotMatch(calls[1].init.body, /github-write-token/);
});

test('publisher rejects non-success review publication status', async () => {
  let callCount = 0;
  await assert.rejects(
    () =>
      revalidateAndPublish({
        artifact: artifact(),
        expected: IDENTITY,
        token: 'github-write-token',
        fetchImpl: async () => {
          callCount += 1;
          return callCount === 1
            ? response(200, pullRequest())
            : response(500, { message: 'github-write-token' });
        },
      }),
    (error) => {
      assert.match(error.message, /publication returned HTTP 500/);
      assert.doesNotMatch(error.message, /github-write-token/);
      return true;
    }
  );
});

test('artifact identity and shell-injection-shaped inputs fail closed', () => {
  const secret = 'provider-secret-token';
  const safeArtifact = serializeReviewArtifact({
    identity: IDENTITY,
    review: {
      verdict: 'APPROVE',
      summary: `The provider echoed ${secret}.`,
      issues: [],
    },
    secrets: [secret],
  });
  assert.doesNotMatch(safeArtifact, /provider-secret-token/);
  assert.throws(() => validatePrNumber('42; touch /tmp/pwned'), /Invalid pull request number/);
  assert.throws(
    () => buildGithubPullRequestUrl('owner/repo; touch /tmp/pwned', 42),
    /Invalid repository identity/
  );
  assert.throws(
    () => parseReviewArtifact({ ...artifact(), headSha: NEXT_HEAD_SHA }, IDENTITY),
    /identity does not match/
  );
  const body = buildReviewBody({
    verdict: 'APPROVE',
    summary: 'No shell is executed: $(touch /tmp/pwned).',
    issues: [],
  });
  assert.match(body, /\$\(touch \/tmp\/pwned\)/);
  assert.match(requestHttp.toString(), /fetchImpl/);
});

test('redaction removes every non-empty secret, including short values', () => {
  const redacted = redactSensitiveText(
    'short=x one=abc two=yz long=provider-secret-token',
    ['', 'x', 'abc', 'yz', 'provider-secret-token']
  );
  assert.equal(
    redacted,
    'short=[REDACTED] one=[REDACTED] two=[REDACTED] long=[REDACTED]'
  );
});

test('isAiProviderUnavailable classifies 5xx, timeouts, connection drops, and malformed JSON', () => {
  for (const status of [500, 502, 503, 504, 520, 521, 522, 524, 530]) {
    assert.equal(
      isAiProviderUnavailable(new Error(`AI provider returned HTTP ${status}`)),
      true
    );
  }
  assert.equal(
    isAiProviderUnavailable(new Error('AI provider request timed out')),
    true
  );
  assert.equal(
    isAiProviderUnavailable(new Error('AI provider response timed out')),
    true
  );
  assert.equal(
    isAiProviderUnavailable(
      new Error('AI provider request failed before receiving a response')
    ),
    true
  );
  assert.equal(
    isAiProviderUnavailable(new Error('AI provider response could not be read')),
    true
  );
  assert.equal(
    isAiProviderUnavailable(
      new Error('AI provider returned an invalid HTTP response')
    ),
    true
  );
  assert.equal(
    isAiProviderUnavailable(
      new Error('AI provider returned an unreadable response')
    ),
    true
  );
  assert.equal(
    isAiProviderUnavailable(new Error('AI provider returned malformed JSON')),
    true
  );
  assert.equal(
    isAiProviderUnavailable(
      new Error('AI provider returned malformed review JSON')
    ),
    true
  );
  assert.equal(
    isAiProviderUnavailable(new Error('Malformed AI provider response')),
    true
  );
  assert.equal(
    isAiProviderUnavailable(new Error('connect ECONNREFUSED 127.0.0.1:8045')),
    true
  );
  assert.equal(
    isAiProviderUnavailable(new Error('getaddrinfo ENOTFOUND rl3ubev.abc-tunnel.us')),
    true
  );
  assert.equal(
    isAiProviderUnavailable(new Error('read ECONNRESET')),
    true
  );
  assert.equal(
    isAiProviderUnavailable(new Error('connect ETIMEDOUT 192.0.2.1:443')),
    true
  );

  for (const status of [400, 401, 403, 404, 422]) {
    assert.equal(
      isAiProviderUnavailable(new Error(`AI provider returned HTTP ${status}`)),
      false
    );
  }
  assert.equal(
    isAiProviderUnavailable(
      new Error('GitHub pull request API returned HTTP 503')
    ),
    false
  );
  assert.equal(
    isAiProviderUnavailable(
      new Error('Pull request head SHA changed after analysis')
    ),
    false
  );
  assert.equal(
    isAiProviderUnavailable(new Error('Invalid pull request number')),
    false
  );
  assert.equal(
    isAiProviderUnavailable(new Error('Invalid expected pull request identity')),
    false
  );
  assert.equal(isAiProviderUnavailable(null), false);
  assert.equal(isAiProviderUnavailable(undefined), false);
  assert.equal(isAiProviderUnavailable('string error'), false);
});

test('skipped review artifact serializes, parses, and redacts sensitive data', () => {
  const secretKey = 'nine-router-secret-key-999';
  const raw = serializeSkippedReviewArtifact({
    identity: IDENTITY,
    reason: `Provider unavailable: ${secretKey} connection failed`,
    secrets: [secretKey],
  });
  assert.doesNotMatch(raw, new RegExp(secretKey));
  assert.match(raw, /\[REDACTED\]/);

  const parsed = parseReviewArtifact(JSON.parse(raw), IDENTITY);
  assert.equal(parsed.status, 'skipped');
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.repository, IDENTITY.repository);
  assert.equal(parsed.prNumber, IDENTITY.prNumber);
  assert.equal(parsed.baseRef, IDENTITY.baseRef);
  assert.equal(parsed.baseSha, IDENTITY.baseSha);
  assert.equal(parsed.headSha, IDENTITY.headSha);
  assert.equal(parsed.headRepository, IDENTITY.headRepository);
  assert.match(parsed.reason, /\[REDACTED\]/);

  assert.throws(
    () =>
      parseReviewArtifact(
        { ...JSON.parse(raw), status: 'completed' },
        IDENTITY
      ),
    /Malformed review artifact status/
  );
  assert.throws(
    () =>
      parseReviewArtifact(
        { ...JSON.parse(raw), extraKey: 'forbidden' },
        IDENTITY
      ),
    /Review artifact contains an unexpected schema/
  );
  assert.throws(
    () =>
      parseReviewArtifact(
        { ...JSON.parse(raw), headSha: NEXT_HEAD_SHA },
        IDENTITY
      ),
    /Review artifact identity does not match/
  );
  assert.throws(
    () =>
      parseReviewArtifact(
        { ...JSON.parse(raw), reason: '' },
        IDENTITY
      ),
    /Empty skipped review reason/
  );
});

test('runAnalyzer handles provider 5xx/outage gracefully by writing skipped artifact', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'ai-review-analyzer-test-'));
  const resultPath = join(tempDir, 'review-result.json');
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  try {
    const env = {
      GITHUB_EVENT_NAME: 'pull_request_target',
      GITHUB_REPOSITORY: IDENTITY.repository,
      GITHUB_TOKEN: 'test-gh-token',
      PR_NUMBER: String(IDENTITY.prNumber),
      EXPECTED_BASE_REF: IDENTITY.baseRef,
      EXPECTED_BASE_SHA: IDENTITY.baseSha,
      EXPECTED_HEAD_SHA: IDENTITY.headSha,
      EXPECTED_HEAD_REPOSITORY: IDENTITY.headRepository,
      AI_API_BASE_URL: 'https://rl3ubev.abc-tunnel.us/v1',
      AI_API_KEY: 'test-ai-key',
      AI_MODEL: 'murah-cepat',
      REVIEW_RESULT_PATH: resultPath,
    };

    const result = await runAnalyzer({
      env,
      fetchImpl: async (url) => {
        if (url.includes('/pulls/42/files')) {
          return response(200, [
            { filename: 'src/index.ts', status: 'modified', patch: '+hello' },
          ]);
        }
        if (url.includes('/pulls/42')) {
          return response(200, pullRequest());
        }
        if (url.includes('/chat/completions')) {
          return response(530, 'Origin DNS error', {
            text: async () => 'Origin DNS error',
          });
        }
        return response(404, 'Not found');
      },
    });

    assert.equal(result.skipped, true);
    assert.match(result.reason, /HTTP 530/);
    assert.equal(result.identity.prNumber, IDENTITY.prNumber);

    assert.ok(
      warnings.some((w) =>
        w.includes('::warning title=AI Code Review Skipped::')
      )
    );

    const fileContent = JSON.parse(await readFile(resultPath, 'utf8'));
    assert.equal(fileContent.status, 'skipped');
    const parsed = parseReviewArtifact(fileContent, IDENTITY);
    assert.equal(parsed.status, 'skipped');
    assert.match(parsed.reason, /HTTP 530/);
  } finally {
    console.warn = originalWarn;
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('runAnalyzer fails closed on PR branch, draft, or head mismatch', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'ai-review-analyzer-security-'));
  const resultPath = join(tempDir, 'review-result.json');

  try {
    const envDraft = {
      GITHUB_EVENT_NAME: 'pull_request_target',
      GITHUB_REPOSITORY: IDENTITY.repository,
      GITHUB_TOKEN: 'test-gh-token',
      PR_NUMBER: String(IDENTITY.prNumber),
      EXPECTED_BASE_REF: IDENTITY.baseRef,
      EXPECTED_BASE_SHA: IDENTITY.baseSha,
      EXPECTED_HEAD_SHA: IDENTITY.headSha,
      EXPECTED_HEAD_REPOSITORY: IDENTITY.headRepository,
      AI_API_BASE_URL: 'https://rl3ubev.abc-tunnel.us/v1',
      AI_API_KEY: 'test-ai-key',
      AI_MODEL: 'murah-cepat',
      REVIEW_RESULT_PATH: resultPath,
    };

    await assert.rejects(
      () =>
        runAnalyzer({
          env: envDraft,
          fetchImpl: async (url) => {
            if (url.includes('/pulls/42')) {
              return response(200, pullRequest({ draft: true }));
            }
            return response(200, []);
          },
        }),
      /not the expected open, non-draft pull request/
    );

    const envDisallowedBase = {
      ...envDraft,
      EXPECTED_BASE_REF: 'feature-branch',
    };
    await assert.rejects(
      () =>
        runAnalyzer({
          env: envDisallowedBase,
          fetchImpl: async () => response(200, pullRequest()),
        }),
      /Invalid or disallowed base branch/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('publisher skips review POST when artifact is skipped and verifies PR head SHA', async () => {
  const skippedArt = skippedArtifact('AI provider returned HTTP 530');
  const calls = [];
  const warnings = [];
  const logs = [];
  const originalWarn = console.warn;
  const originalLog = console.log;
  console.warn = (...args) => warnings.push(args.join(' '));
  console.log = (...args) => logs.push(args.join(' '));

  try {
    const result = await revalidateAndPublish({
      artifact: skippedArt,
      expected: IDENTITY,
      token: 'github-write-token',
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return response(200, pullRequest());
      },
    });

    assert.equal(result.status, 'skipped');
    assert.equal(result.commitId, HEAD_SHA);
    assert.match(result.reason, /HTTP 530/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.method, 'GET');
    assert.ok(
      warnings.some((w) =>
        w.includes('::warning title=AI Review Publication Skipped::')
      )
    );

    await assert.rejects(
      () =>
        revalidateAndPublish({
          artifact: skippedArt,
          expected: IDENTITY,
          token: 'github-write-token',
          fetchImpl: async () => {
            return response(
              200,
              pullRequest({ head: { ...pullRequest().head, sha: NEXT_HEAD_SHA } })
            );
          },
        }),
      /head SHA changed after analysis/
    );
  } finally {
    console.warn = originalWarn;
    console.log = originalLog;
  }
});

