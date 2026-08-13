import { pathToFileURL } from 'node:url';
import {
  LIMITS,
  buildGithubReviewUrl,
  buildReviewBody,
  fetchPullRequest,
  isRecord,
  loadExpectedContext,
  parseReviewArtifact,
  readBoundedResponseBody,
  readBoundedJsonFile,
  redactSensitiveText,
  requestHttp,
  requireEnv,
  validatePullRequestIdentity,
} from './ai-review-common.mjs';

function fail(message) {
  throw new Error(message);
}

export async function revalidateAndPublish({
  artifact,
  expected,
  token,
  fetchImpl,
}) {
  const reviewArtifact = parseReviewArtifact(artifact, expected);
  const currentPullRequest = await fetchPullRequest(
    expected.repository,
    expected.prNumber,
    token,
    fetchImpl
  );
  const currentHeadSha =
    isRecord(currentPullRequest.head) && currentPullRequest.head.sha;
  if (
    currentHeadSha !== reviewArtifact.headSha ||
    currentHeadSha !== expected.headSha
  ) {
    fail('Pull request head SHA changed after analysis');
  }
  validatePullRequestIdentity(currentPullRequest, expected);

  const body = buildReviewBody(
    {
      verdict: reviewArtifact.verdict,
      summary: reviewArtifact.summary,
      issues: reviewArtifact.issues,
    },
    [token]
  );
  // The immediate revalidation plus commit_id prevents publishing an AI review
  // decision for a different analyzed commit. This is not atomic: a remaining
  // event race can publish a comment after the head moves, but it is
  // non-authoritative because the GitHub event is COMMENT.
  const response = await requestHttp({
    url: buildGithubReviewUrl(expected.repository, expected.prNumber),
    token,
    method: 'POST',
    service: 'GitHub review publication API',
    fetchImpl,
    extraHeaders: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      body,
      event: 'COMMENT',
      commit_id: reviewArtifact.headSha,
    }),
  });
  const success = response.status === 200;
  try {
    await readBoundedResponseBody(response, {
      service: 'GitHub review publication API',
    });
  } catch (error) {
    if (!success) {
      fail(`GitHub review publication returned HTTP ${response.status}`);
    }
    throw error;
  }
  if (!success) {
    fail(`GitHub review publication returned HTTP ${response.status}`);
  }
  return {
    verdict: reviewArtifact.verdict,
    event: 'COMMENT',
    commitId: reviewArtifact.headSha,
    body,
  };
}

export async function runPublisher({ env = process.env, fetchImpl } = {}) {
  const token = requireEnv('GITHUB_TOKEN', env);
  const resultPath = requireEnv('REVIEW_RESULT_PATH', env);
  const expected = await loadExpectedContext(env);
  const artifact = await readBoundedJsonFile(
    resultPath,
    LIMITS.maxArtifactChars
  );
  return revalidateAndPublish({
    artifact,
    expected,
    token,
    fetchImpl,
  });
}

export async function main() {
  try {
    const result = await runPublisher();
    console.log(
      `AI review comment published (advisory verdict: ${result.verdict}).`
    );
  } catch (error) {
    const token = process.env.GITHUB_TOKEN;
    const message = error instanceof Error ? error.message : 'Unknown publisher error';
    console.error(
      `AI review publication failed: ${redactSensitiveText(message, [token])}`
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  await main();
}
