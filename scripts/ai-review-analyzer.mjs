import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import {
  LIMITS,
  buildBoundedReviewInput,
  buildProviderChatUrl,
  fetchJson,
  fetchPullRequest,
  fetchPullRequestFiles,
  isRecord,
  loadExpectedContext,
  parseReviewPayload,
  redactSensitiveText,
  requireEnv,
  serializeReviewArtifact,
  validatePullRequestIdentity,
} from './ai-review-common.mjs';

const SYSTEM_PROMPT = `You are a senior code reviewer for a TypeScript monorepo (ERP system).
Review only the supplied pull request metadata and changed-file patches.
Focus on bugs, security issues, type safety, missing validation, logic errors,
unsafe casts, missing error handling, SQL injection, and broken imports.
Ignore formatting, style preferences, and minor naming choices.
If there are no critical issues, use APPROVE. Use REQUEST_CHANGES only for
blocking critical issues. Warnings and suggestions alone should use APPROVE.

Return only valid JSON with exactly this shape:
{
  "verdict": "APPROVE" | "REQUEST_CHANGES",
  "summary": "Brief assessment.",
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical" | "warning" | "suggestion",
      "message": "Description of the issue."
    }
  ]
}`;

function fail(message) {
  throw new Error(message);
}

function extractProviderContent(response) {
  if (
    !isRecord(response) ||
    !Array.isArray(response.choices) ||
    response.choices.length !== 1 ||
    !isRecord(response.choices[0]) ||
    !isRecord(response.choices[0].message) ||
    typeof response.choices[0].message.content !== 'string'
  ) {
    fail('Malformed AI provider response');
  }
  const content = response.choices[0].message.content.trim();
  if (content.length === 0 || content.length > LIMITS.maxProviderResponseChars) {
    fail('AI provider response exceeds size limit');
  }
  return content;
}

export function parseProviderReview(response) {
  const content = extractProviderContent(response);
  const fenced = content.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = fenced ? fenced[1].trim() : content;
  if (jsonText.length > LIMITS.maxProviderResponseChars) {
    fail('AI provider response exceeds size limit');
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    fail('AI provider returned malformed review JSON');
  }
  return parseReviewPayload(parsed);
}

export async function callAiReview({
  reviewInput,
  apiBaseUrl,
  apiKey,
  model,
  fetchImpl,
}) {
  if (typeof reviewInput !== 'string' || reviewInput.length > LIMITS.maxDiffChars + 30_000) {
    fail('AI review input exceeds size limit');
  }
  if (typeof model !== 'string' || model.length === 0 || model.length > 200) {
    fail('Invalid AI model');
  }
  const response = await fetchJson({
    url: buildProviderChatUrl(apiBaseUrl),
    token: apiKey,
    method: 'POST',
    service: 'AI provider',
    fetchImpl,
    maxChars: LIMITS.maxProviderResponseChars,
    extraHeaders: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Review this pull request:\n\n${reviewInput}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
  });
  return parseProviderReview(response);
}

export async function runAnalyzer({ env = process.env, fetchImpl } = {}) {
  const token = requireEnv('GITHUB_TOKEN', env);
  const apiKey = requireEnv('AI_API_KEY', env);
  const apiBaseUrl = requireEnv('AI_API_BASE_URL', env);
  const model = requireEnv('AI_MODEL', env);
  const resultPath = requireEnv('REVIEW_RESULT_PATH', env);
  const identity = await loadExpectedContext(env);

  const pullRequest = await fetchPullRequest(
    identity.repository,
    identity.prNumber,
    token,
    fetchImpl
  );
  validatePullRequestIdentity(pullRequest, identity);
  const files = await fetchPullRequestFiles(
    identity.repository,
    identity.prNumber,
    token,
    fetchImpl
  );
  const reviewInput = buildBoundedReviewInput(pullRequest, files);
  const review = await callAiReview({
    reviewInput,
    apiBaseUrl,
    apiKey,
    model,
    fetchImpl,
  });
  const artifact = serializeReviewArtifact({
    identity,
    review,
    secrets: [apiKey, token],
  });
  await writeFile(resultPath, artifact, { encoding: 'utf8', mode: 0o600 });
  return { identity, review };
}

export async function main() {
  try {
    const result = await runAnalyzer();
    console.log(
      `AI review analysis completed for PR #${result.identity.prNumber} (${result.review.verdict}).`
    );
  } catch (error) {
    const apiKey = process.env.AI_API_KEY;
    const token = process.env.GITHUB_TOKEN;
    const message = error instanceof Error ? error.message : 'Unknown analyzer error';
    console.error(
      `AI review analysis failed: ${redactSensitiveText(message, [apiKey, token])}`
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
