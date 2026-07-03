/**
 * AI-powered Pull Request reviewer (9router-tunnel provider).
 *
 * Sends the PR diff to a configurable OpenAI-compatible endpoint
 * and translates the structured verdict into a GitHub PR review
 * (APPROVE or REQUEST_CHANGES).
 *
 * Provider: 9router-tunnel (DeepSeek v4 Flash via "murah-cepat" model)
 *
 * Required environment variables:
 *   AI_API_BASE_URL  – OpenAI-compatible base URL
 *   AI_API_KEY       – Bearer token for the AI provider
 *   AI_MODEL         – Model identifier (e.g. "murah-cepat")
 *   GITHUB_TOKEN     – GitHub token with pull-requests:write
 *   PR_NUMBER        – Pull request number
 *   GITHUB_REPOSITORY – owner/repo (set automatically by Actions)
 */

import { execSync } from 'node:child_process';

// ─── Types ───────────────────────────────────────────────────────

interface ReviewVerdict {
  verdict: 'APPROVE' | 'REQUEST_CHANGES';
  summary: string;
  issues: Array<{
    file: string;
    line: number;
    severity: 'critical' | 'warning' | 'suggestion';
    message: string;
  }>;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// ─── Config ──────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const AI_API_BASE_URL = requireEnv('AI_API_BASE_URL');
const AI_API_KEY = requireEnv('AI_API_KEY');
const AI_MODEL = requireEnv('AI_MODEL');
const GITHUB_TOKEN = requireEnv('GITHUB_TOKEN');
const PR_NUMBER = requireEnv('PR_NUMBER');
const GITHUB_REPOSITORY = requireEnv('GITHUB_REPOSITORY');

// ─── Diff ────────────────────────────────────────────────────────

function getDiff(): string {
  try {
    // Fetch latest remote state
    execSync('git fetch origin', { stdio: 'pipe' });

    const baseBranch = process.env.PR_BASE_REF || 'dev';
    const diff = execSync(
      `git diff origin/${baseBranch}...HEAD -- '*.ts' '*.tsx' '*.prisma' '*.json' '*.yml' '*.yaml'`,
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 5 }
    );

    if (!diff.trim()) {
      console.log('No diff found, skipping review.');
      process.exit(0);
    }

    // Truncate very large diffs to avoid token limits
    const MAX_CHARS = 30_000;
    if (diff.length > MAX_CHARS) {
      return diff.slice(0, MAX_CHARS) + '\n\n... [diff truncated]';
    }

    return diff;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to get diff:', message);
    process.exit(1);
  }
}

// ─── AI Call ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior code reviewer for a TypeScript monorepo (ERP system).
Your job is to review pull request diffs and provide a structured verdict.

Rules:
1. Focus on: bugs, security issues, type safety (no \`any\`), missing validation, logic errors.
2. Ignore: formatting, style preferences, minor naming choices.
3. Be strict on: unsafe casting, missing error handling, SQL injection, broken imports.
4. If there are NO critical issues, verdict should be APPROVE.
5. If there are critical/blocking issues, verdict should be REQUEST_CHANGES.

You MUST respond with valid JSON in this exact format:
{
  "verdict": "APPROVE" | "REQUEST_CHANGES",
  "summary": "Brief 2-3 sentence summary of the changes and your assessment.",
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical" | "warning" | "suggestion",
      "message": "Description of the issue."
    }
  ]
}

Only use REQUEST_CHANGES if there are "critical" severity issues.
Warnings and suggestions alone should result in APPROVE with the issues listed.`;

async function callAI(diff: string): Promise<ReviewVerdict> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Review the following pull request diff:\n\n\`\`\`diff\n${diff}\n\`\`\``,
    },
  ];

  const url = `${AI_API_BASE_URL.replace(/\/+$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `AI API returned ${response.status}: ${body.slice(0, 500)}`
    );
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('AI returned empty response');
  }

  // Extract JSON from potential markdown code block
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [
    null,
    content,
  ];
  const rawJson = jsonMatch[1]?.trim() ?? content.trim();

  const parsed: unknown = JSON.parse(rawJson);

  // Basic shape validation
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('verdict' in parsed) ||
    !('summary' in parsed)
  ) {
    throw new Error(`Invalid AI response shape: ${rawJson.slice(0, 200)}`);
  }

  const verdict = parsed as Record<string, unknown>;

  return {
    verdict:
      verdict.verdict === 'REQUEST_CHANGES' ? 'REQUEST_CHANGES' : 'APPROVE',
    summary: String(verdict.summary ?? ''),
    issues: Array.isArray(verdict.issues)
      ? verdict.issues.map((issue: Record<string, unknown>) => ({
          file: String(issue.file ?? ''),
          line: Number(issue.line ?? 0),
          severity: (['critical', 'warning', 'suggestion'].includes(
            String(issue.severity)
          )
            ? String(issue.severity)
            : 'suggestion') as 'critical' | 'warning' | 'suggestion',
          message: String(issue.message ?? ''),
        }))
      : [],
  };
}

// ─── GitHub Review ───────────────────────────────────────────────

function buildReviewBody(review: ReviewVerdict): string {
  const icon = review.verdict === 'APPROVE' ? '✅' : '🚫';
  const header = `## ${icon} AI Code Review\n\n`;
  const summary = `**Summary:** ${review.summary}\n\n`;

  if (review.issues.length === 0) {
    return `${header}${summary}No issues found. Looks good! 🎉`;
  }

  const severityIcon = {
    critical: '🔴',
    warning: '🟡',
    suggestion: '🔵',
  };

  const issueList = review.issues
    .map(
      (issue) =>
        `- ${severityIcon[issue.severity]} **${issue.severity.toUpperCase()}** \`${issue.file}:${issue.line}\`\n  ${issue.message}`
    )
    .join('\n');

  return `${header}${summary}### Issues Found\n\n${issueList}`;
}

function submitReview(review: ReviewVerdict): void {
  const body = buildReviewBody(review);
  const event = review.verdict === 'APPROVE' ? 'APPROVE' : 'REQUEST_CHANGES';

  console.log(`\n📝 Submitting review: ${event}`);
  console.log(body);

  // Submit the review via GitHub API
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}/reviews`;

  const result = execSync(
    `curl -s -X POST "${apiUrl}" \
      -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github.v3+json" \
      -H "Content-Type: application/json" \
      -d '${JSON.stringify({ body, event }).replace(/'/g, "'\\''")}'`,
    { encoding: 'utf-8' }
  );

  console.log('GitHub API response:', result.slice(0, 300));
}

// ─── Main ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🤖 AI Code Review starting...');
  console.log(`   Provider: ${AI_API_BASE_URL}`);
  console.log(`   Model: ${AI_MODEL}`);
  console.log(`   PR: #${PR_NUMBER}`);

  const diff = getDiff();
  console.log(`   Diff size: ${diff.length} chars`);

  try {
    const review = await callAI(diff);
    submitReview(review);

    if (review.verdict === 'REQUEST_CHANGES') {
      console.log('\n❌ AI requested changes. PR cannot be merged.');
      process.exit(1);
    }

    console.log('\n✅ AI approved the PR.');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('AI review failed:', message);
    // Don't block the pipeline if AI is unavailable — fallback to manual review
    console.log(
      '⚠️ AI review could not complete. Falling back to manual review.'
    );
  }
}

main();
