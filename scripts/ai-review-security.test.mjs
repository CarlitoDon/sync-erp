import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  LIMITS,
  buildGithubPullRequestUrl,
  buildReviewBody,
  buildBoundedDiff,
  fetchPullRequest,
  parseReviewArtifact,
  parseReviewPayload,
  requestHttp,
  serializeReviewArtifact,
  validatePrNumber,
  validatePullRequestIdentity,
} from './ai-review-common.mjs';
import {
  callAiReview,
  parseProviderReview,
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

function response(status, value) {
  return {
    status,
    text: async () => (typeof value === 'string' ? value : JSON.stringify(value)),
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

test('workflow keeps a trusted-base trigger and least-privilege job split', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ai-review.yml', import.meta.url), 'utf8');
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /branches: \[dev, main\]/);
  assert.doesNotMatch(workflow, /^\s+pull_request:/m);
  assert.doesNotMatch(workflow, /workflow_dispatch/);
  assert.doesNotMatch(workflow, /head_ref|base_ref|inputs\./);
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

test('bounded diff rejects oversized files, patches, and total input', () => {
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
      { filename: 'a.ts', status: 'modified', patch: 'x'.repeat(15_000) },
      { filename: 'b.ts', status: 'modified', patch: 'x'.repeat(15_000) },
    ]),
    /diff exceeds size limit/
  );
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

test('GitHub HTTP errors are status-only and never include response bodies', async () => {
  await assert.rejects(
    () =>
      fetchPullRequest(
        IDENTITY.repository,
        IDENTITY.prNumber,
        'github-secret-token',
        async () => response(404, { message: 'github-secret-token' })
      ),
    (error) => {
      assert.match(error.message, /GitHub pull request API returned HTTP 404/);
      assert.doesNotMatch(error.message, /github-secret-token/);
      return true;
    }
  );
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
  const result = await revalidateAndPublish({
    artifact: artifact('REQUEST_CHANGES'),
    expected: IDENTITY,
    token: 'github-write-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return calls.length === 1
        ? response(200, pullRequest())
        : response(200, { id: 123 });
    },
  });
  assert.equal(result.verdict, 'REQUEST_CHANGES');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[1].init.method, 'POST');
  assert.match(calls[1].url, /\/repos\/owner\/repo\/pulls\/42\/reviews$/);
  assert.equal(JSON.parse(calls[1].init.body).event, 'REQUEST_CHANGES');
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
