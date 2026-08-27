import { readFile, stat } from 'node:fs/promises';

export const ALLOWED_BASE_REFS = Object.freeze(['dev', 'main']);
export const REVIEW_VERDICTS = Object.freeze(['APPROVE', 'REQUEST_CHANGES']);
export const ISSUE_SEVERITIES = Object.freeze([
  'critical',
  'warning',
  'suggestion',
]);

export const LIMITS = Object.freeze({
  maxFiles: 100,
  maxFilePages: 2,
  maxFileStatusChars: 32,
  maxPatchChars: 50_000,
  maxDiffChars: 60_000,
  maxReviewInputChars: 90_000,
  maxTitleChars: 2_000,
  maxBodyChars: 20_000,
  maxGithubResponseChars: 1_000_000,
  maxProviderResponseChars: 100_000,
  maxArtifactChars: 70_000,
  maxSummaryChars: 4_000,
  maxIssues: 50,
  maxIssueFileChars: 300,
  maxIssueMessageChars: 2_000,
  maxReviewBodyChars: 60_000,
  maxEventChars: 1_000_000,
});

export const HTTP_TIMEOUT_MS = 30_000;

const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function fail(message) {
  throw new Error(message);
}

export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requireEnv(name, env = process.env) {
  const value = env[name];
  if (typeof value !== 'string' || value.length === 0) {
    fail(`Missing required environment variable: ${name}`);
  }
  if (value.includes('\r') || value.includes('\n')) {
    fail(`Invalid environment variable: ${name}`);
  }
  return value;
}

export function validateRepository(repository) {
  if (typeof repository !== 'string' || !REPOSITORY_PATTERN.test(repository)) {
    fail('Invalid repository identity');
  }
  return repository;
}

export function validatePrNumber(value) {
  const text = typeof value === 'number' ? String(value) : value;
  if (
    typeof text !== 'string' ||
    !/^[1-9][0-9]{0,8}$/.test(text) ||
    !Number.isSafeInteger(Number(text))
  ) {
    fail('Invalid pull request number');
  }
  return Number(text);
}

export function validateSha(value, label = 'SHA') {
  if (typeof value !== 'string' || !SHA_PATTERN.test(value)) {
    fail(`Invalid ${label}`);
  }
  return value;
}

function validateBaseRef(value) {
  if (typeof value !== 'string' || !ALLOWED_BASE_REFS.includes(value)) {
    fail('Invalid or disallowed base branch');
  }
  return value;
}

function validateHeadRepository(value, required = false) {
  if (value === undefined && !required) return undefined;
  return validateRepository(value);
}

export function validateExpectedIdentity(expected) {
  if (!isRecord(expected)) fail('Invalid expected pull request identity');

  const repository = validateRepository(expected.repository);
  const prNumber = validatePrNumber(expected.prNumber);
  const baseRef = validateBaseRef(expected.baseRef);
  const baseSha = validateSha(expected.baseSha, 'base SHA');
  const headSha = validateSha(expected.headSha, 'head SHA');
  const headRepository = validateHeadRepository(expected.headRepository, true);

  if (baseSha === headSha) fail('Base and head SHA must differ');

  return {
    repository,
    prNumber,
    baseRef,
    baseSha,
    headSha,
    headRepository,
  };
}

export function validatePullRequestIdentity(pullRequest, expected) {
  const identity = validateExpectedIdentity(expected);
  if (!isRecord(pullRequest)) fail('Malformed pull request metadata');

  if (
    pullRequest.number !== identity.prNumber ||
    pullRequest.state !== 'open' ||
    pullRequest.draft !== false
  ) {
    fail('Pull request is not the expected open, non-draft pull request');
  }

  const base = pullRequest.base;
  const head = pullRequest.head;
  if (!isRecord(base) || !isRecord(head)) {
    fail('Malformed pull request branch metadata');
  }

  if (
    base.ref !== identity.baseRef ||
    base.sha !== identity.baseSha ||
    head.sha !== identity.headSha
  ) {
    fail('Pull request branch SHA or base branch changed');
  }

  if (!isRecord(base.repo) || base.repo.full_name !== identity.repository) {
    fail('Pull request base repository does not match the trusted repository');
  }

  if (
    !isRecord(head.repo) ||
    head.repo.full_name !== identity.headRepository
  ) {
    fail('Pull request head repository does not match event metadata');
  }

  return identity;
}

function assertSafeText(value, label, maxChars, { allowEmpty = true } = {}) {
  if (typeof value !== 'string') fail(`Malformed ${label}`);
  if (!allowEmpty && value.length === 0) fail(`Empty ${label}`);
  if (value.length > maxChars) fail(`${label} exceeds size limit`);
  if (value.includes('\0')) fail(`Invalid ${label}`);
  return value;
}

function normalizeChangedFile(file) {
  if (!isRecord(file)) fail('Malformed changed-file metadata');
  const filename = assertSafeText(
    file.filename,
    'changed-file path',
    LIMITS.maxIssueFileChars,
    { allowEmpty: false }
  );
  if (filename.includes('\r') || filename.includes('\n')) {
    fail('Invalid changed-file path');
  }

  assertSafeText(file.status, 'changed-file status', LIMITS.maxFileStatusChars, {
    allowEmpty: false,
  });
  if (file.status.includes('\r') || file.status.includes('\n')) {
    fail('Invalid changed-file status');
  }

  const patch = file.patch === undefined || file.patch === null ? '' : file.patch;
  assertSafeText(patch, 'changed-file patch', LIMITS.maxPatchChars);

  return { filename, status: file.status, patch };
}

export function normalizeChangedFiles(files) {
  if (!Array.isArray(files)) fail('Malformed changed-file response');
  if (files.length > LIMITS.maxFiles) {
    fail('Changed-file count exceeds size limit');
  }
  return files.map(normalizeChangedFile);
}

export function buildBoundedDiff(files) {
  const normalized = normalizeChangedFiles(files);
  const entries = normalized.map(({ filename, status, patch }) => {
    const patchText = patch.length > 0 ? patch : '[patch unavailable]';
    return `File: ${filename}\nStatus: ${status}\nPatch:\n${patchText}`;
  });
  const diff = entries.join('\n\n');
  if (diff.length > LIMITS.maxDiffChars) {
    fail('Pull request diff exceeds size limit');
  }
  return diff;
}

export function buildBoundedReviewInput(pullRequest, files) {
  if (!isRecord(pullRequest)) fail('Malformed pull request metadata');
  const title = assertSafeText(
    pullRequest.title,
    'pull request title',
    LIMITS.maxTitleChars,
    { allowEmpty: false }
  );
  const body =
    pullRequest.body === null || pullRequest.body === undefined
      ? ''
      : assertSafeText(pullRequest.body, 'pull request body', LIMITS.maxBodyChars);
  const diff = buildBoundedDiff(files);

  return [
    `Pull request title:\n${title}`,
    `Pull request description:\n${body || '[no description]'}`,
    `Changed-file patches:\n${diff || '[no changed files]'}`,
  ].join('\n\n');
}

function assertHttpsUrl(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`Invalid ${label}`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`Invalid ${label}`);
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    fail(`Invalid ${label}`);
  }
  return url;
}

export function buildProviderChatUrl(baseUrl) {
  const url = assertHttpsUrl(baseUrl, 'AI provider URL');
  const pathname = url.pathname.replace(/\/+$/, '');
  url.pathname = `${pathname}/chat/completions`;
  return url.toString();
}

export function buildGithubPullRequestUrl(repository, prNumber) {
  const repo = validateRepository(repository);
  const number = validatePrNumber(prNumber);
  return `https://api.github.com/repos/${repo}/pulls/${number}`;
}

export function buildGithubPullRequestFilesUrl(repository, prNumber, page) {
  const baseUrl = buildGithubPullRequestUrl(repository, prNumber);
  if (!Number.isInteger(page) || page < 1 || page > LIMITS.maxFilePages) {
    fail('Invalid changed-file page');
  }
  return `${baseUrl}/files?per_page=${LIMITS.maxFiles}&page=${page}`;
}

export function buildGithubReviewUrl(repository, prNumber) {
  return `${buildGithubPullRequestUrl(repository, prNumber)}/reviews`;
}

function buildHeaders(token, extraHeaders = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'sync-erp-ai-review',
    'X-GitHub-Api-Version': '2022-11-28',
    ...extraHeaders,
  };
  if (token !== undefined) {
    if (typeof token !== 'string' || token.length === 0) {
      fail('Missing HTTP bearer token');
    }
    if (token.includes('\r') || token.includes('\n')) {
      fail('Invalid HTTP bearer token');
    }
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

class HttpTimeoutError extends Error {}
class ResponseLimitError extends Error {}
class ResponseReadError extends Error {}

function validateTimeoutMs(timeoutMs) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    fail('Invalid HTTP timeout');
  }
  return timeoutMs;
}

function validateResponseLimit(maxChars) {
  if (!Number.isSafeInteger(maxChars) || maxChars < 1) {
    fail('Invalid HTTP response size limit');
  }
  return maxChars;
}

function invokeSafely(callback) {
  try {
    const result = callback?.();
    if (result && typeof result.then === 'function') {
      void result.catch(() => {});
    }
  } catch {
    // Timeout and cancellation paths must keep their sanitized error.
  }
}

async function withTimeout(operation, { timeoutMs, onTimeout, message }) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      invokeSafely(onTimeout);
      reject(new HttpTimeoutError(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function getContentLength(response, service) {
  let value;
  try {
    if (response.headers && typeof response.headers.get === 'function') {
      value = response.headers.get('content-length');
    } else if (isRecord(response.headers)) {
      value =
        response.headers['content-length'] ?? response.headers['Content-Length'];
    }
  } catch {
    fail(`${service} returned an invalid Content-Length`);
  }

  if (value === undefined || value === null || value === '') return undefined;
  const text = String(value);
  if (!/^\d+$/.test(text)) {
    fail(`${service} returned an invalid Content-Length`);
  }
  return text;
}

function assertContentLengthWithinLimit(response, service, maxBytes) {
  const contentLength = getContentLength(response, service);
  if (
    contentLength !== undefined &&
    BigInt(contentLength) > BigInt(maxBytes)
  ) {
    fail(`${service} response exceeds size limit`);
  }
}

async function cancelReader(reader) {
  try {
    await reader.cancel();
  } catch {
    // The response is already being rejected with a sanitized error.
  }
}

async function cancelResponseBody(response) {
  try {
    const cancel = response?.body?.cancel;
    if (typeof cancel === 'function') {
      await cancel.call(response.body);
    }
  } catch {
    // The response is already being rejected with a sanitized error.
  }
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return undefined;
}

async function readResponseStream(response, service, maxChars, timeoutMs) {
  let reader;
  try {
    reader = response.body.getReader();
  } catch {
    invokeSafely(() => cancelResponseBody(response));
    fail(`${service} response could not be read`);
  }

  const decoder = new TextDecoder();
  let byteCount = 0;
  let text = '';
  const consume = async () => {
    try {
      while (true) {
        const result = await reader.read();
        if (!isRecord(result) || typeof result.done !== 'boolean') {
          throw new ResponseReadError();
        }
        if (result.done) {
          text += decoder.decode();
          if (text.length > maxChars) {
            invokeSafely(() => cancelReader(reader));
            throw new ResponseLimitError();
          }
          return text;
        }

        const chunk = toUint8Array(result.value);
        if (!chunk) throw new ResponseReadError();
        if (chunk.byteLength > maxChars - byteCount) {
          invokeSafely(() => cancelReader(reader));
          throw new ResponseLimitError();
        }
        byteCount += chunk.byteLength;
        text += decoder.decode(chunk, { stream: true });
        if (text.length > maxChars) {
          invokeSafely(() => cancelReader(reader));
          throw new ResponseLimitError();
        }
      }
    } catch (error) {
      if (error instanceof ResponseLimitError) throw error;
      if (error instanceof ResponseReadError) {
        invokeSafely(() => cancelReader(reader));
        throw error;
      }
      invokeSafely(() => cancelReader(reader));
      throw new ResponseReadError();
    }
  };

  try {
    let contentLength;
    try {
      contentLength = getContentLength(response, service);
    } catch (error) {
      invokeSafely(() => cancelReader(reader));
      throw error;
    }
    if (
      contentLength !== undefined &&
      BigInt(contentLength) > BigInt(maxChars)
    ) {
      invokeSafely(() => cancelReader(reader));
      throw new ResponseLimitError();
    }
    return await withTimeout(consume, {
      timeoutMs,
      onTimeout: () => cancelReader(reader),
      message: `${service} response timed out`,
    });
  } catch (error) {
    if (error instanceof HttpTimeoutError) fail(error.message);
    if (error instanceof ResponseLimitError) {
      fail(`${service} response exceeds size limit`);
    }
    if (error instanceof ResponseReadError) {
      fail(`${service} response could not be read`);
    }
    throw error;
  } finally {
    if (reader && typeof reader.releaseLock === 'function') {
      try {
        reader.releaseLock();
      } catch {
        // The stream may still be cancelling after a timeout.
      }
    }
  }
}

export async function requestHttp({
  url,
  token,
  method = 'GET',
  body,
  service = 'HTTP service',
  fetchImpl = globalThis.fetch,
  extraHeaders,
  maxResponseChars = LIMITS.maxGithubResponseChars,
  timeoutMs = HTTP_TIMEOUT_MS,
}) {
  if (typeof fetchImpl !== 'function') fail('Fetch implementation is unavailable');
  if (!['GET', 'POST'].includes(method)) fail('Unsupported HTTP method');
  validateResponseLimit(maxResponseChars);
  const requestTimeout = validateTimeoutMs(timeoutMs);

  const controller =
    typeof AbortController === 'function' ? new AbortController() : undefined;
  const requestInit = {
    method,
    headers: buildHeaders(token, extraHeaders),
    ...(body === undefined ? {} : { body }),
    ...(controller === undefined ? {} : { signal: controller.signal }),
  };

  let response;
  try {
    response = await withTimeout(
      () => fetchImpl(url, requestInit),
      {
        timeoutMs: requestTimeout,
        onTimeout: () => controller?.abort(),
        message: `${service} request timed out`,
      }
    );
  } catch (error) {
    if (error instanceof HttpTimeoutError) fail(error.message);
    fail(`${service} request failed before receiving a response`);
  }

  if (!response || !Number.isInteger(response.status)) {
    fail(`${service} returned an invalid HTTP response`);
  }
  return response;
}

async function readResponseTextFallback(response, service, maxChars, timeoutMs) {
  const maxBytes = validateResponseLimit(maxChars);
  try {
    assertContentLengthWithinLimit(response, service, maxBytes);
  } catch (error) {
    invokeSafely(() => cancelResponseBody(response));
    throw error;
  }

  if (typeof response.text !== 'function') {
    invokeSafely(() => cancelResponseBody(response));
    fail(`${service} returned an unreadable response`);
  }
  let text;
  try {
    text = await withTimeout(
      () => response.text(),
      {
        timeoutMs,
        onTimeout: () => cancelResponseBody(response),
        message: `${service} response timed out`,
      }
    );
  } catch (error) {
    if (error instanceof HttpTimeoutError) fail(error.message);
    invokeSafely(() => cancelResponseBody(response));
    fail(`${service} response could not be read`);
  }
  if (
    typeof text !== 'string' ||
    text.length > maxBytes ||
    Buffer.byteLength(text, 'utf8') > maxBytes
  ) {
    fail(`${service} response exceeds size limit`);
  }
  return text;
}

export async function readBoundedResponseBody(
  response,
  {
    service = 'HTTP service',
    maxChars = LIMITS.maxGithubResponseChars,
    timeoutMs = HTTP_TIMEOUT_MS,
  } = {}
) {
  const maxBytes = validateResponseLimit(maxChars);
  const bodyTimeout = validateTimeoutMs(timeoutMs);

  if (response?.body && typeof response.body.getReader === 'function') {
    return readResponseStream(response, service, maxBytes, bodyTimeout);
  }
  return readResponseTextFallback(response, service, maxBytes, bodyTimeout);
}

export async function fetchJson({
  url,
  token,
  method = 'GET',
  body,
  service = 'HTTP service',
  fetchImpl = globalThis.fetch,
  maxChars = LIMITS.maxGithubResponseChars,
  timeoutMs = HTTP_TIMEOUT_MS,
  extraHeaders,
}) {
  const response = await requestHttp({
    url,
    token,
    method,
    body,
    service,
    fetchImpl,
    extraHeaders,
    maxResponseChars: maxChars,
    timeoutMs,
  });
  const success = response.status >= 200 && response.status < 300;
  let raw;
  try {
    raw = await readBoundedResponseBody(response, {
      service,
      maxChars,
      timeoutMs,
    });
  } catch (error) {
    if (!success) fail(`${service} returned HTTP ${response.status}`);
    throw error;
  }
  if (!success) {
    fail(`${service} returned HTTP ${response.status}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    fail(`${service} returned malformed JSON`);
  }
}

export async function fetchPullRequest(repository, prNumber, token, fetchImpl) {
  const data = await fetchJson({
    url: buildGithubPullRequestUrl(repository, prNumber),
    token,
    service: 'GitHub pull request API',
    fetchImpl,
  });
  if (!isRecord(data)) fail('Malformed GitHub pull request response');
  return data;
}

export async function fetchPullRequestFiles(
  repository,
  prNumber,
  token,
  fetchImpl
) {
  const files = [];
  for (let page = 1; page <= LIMITS.maxFilePages; page += 1) {
    const data = await fetchJson({
      url: buildGithubPullRequestFilesUrl(repository, prNumber, page),
      token,
      service: 'GitHub changed-files API',
      fetchImpl,
    });
    if (!Array.isArray(data)) fail('Malformed GitHub changed-files response');
    const pageFiles = normalizeChangedFiles(data);
    if (files.length + pageFiles.length > LIMITS.maxFiles) {
      fail('Changed-file count exceeds size limit');
    }
    files.push(...pageFiles);
    if (pageFiles.length < LIMITS.maxFiles) return files;
  }
  fail('Changed-file count exceeds page limit');
}

function compareEventField(actual, expected, message) {
  if (actual !== expected) fail(message);
}

export async function loadExpectedContext(env = process.env) {
  compareEventField(
    requireEnv('GITHUB_EVENT_NAME', env),
    'pull_request_target',
    'Unexpected GitHub event'
  );

  const expected = validateExpectedIdentity({
    repository: requireEnv('GITHUB_REPOSITORY', env),
    prNumber: requireEnv('PR_NUMBER', env),
    baseRef: requireEnv('EXPECTED_BASE_REF', env),
    baseSha: requireEnv('EXPECTED_BASE_SHA', env),
    headSha: requireEnv('EXPECTED_HEAD_SHA', env),
    headRepository: requireEnv('EXPECTED_HEAD_REPOSITORY', env),
  });

  const eventPath = env.GITHUB_EVENT_PATH;
  if (eventPath) {
    const event = await readBoundedJsonFile(eventPath, LIMITS.maxEventChars);
    if (!isRecord(event) || !isRecord(event.pull_request)) {
      fail('Malformed GitHub pull request event');
    }
    const eventPullRequest = event.pull_request;
    compareEventField(
      event.repository?.full_name,
      expected.repository,
      'GitHub event repository mismatch'
    );
    compareEventField(
      eventPullRequest.number,
      expected.prNumber,
      'GitHub event pull request mismatch'
    );
    compareEventField(
      eventPullRequest.base?.ref,
      expected.baseRef,
      'GitHub event base branch mismatch'
    );
    compareEventField(
      eventPullRequest.base?.sha,
      expected.baseSha,
      'GitHub event base SHA mismatch'
    );
    compareEventField(
      eventPullRequest.head?.sha,
      expected.headSha,
      'GitHub event head SHA mismatch'
    );
    compareEventField(
      eventPullRequest.base?.repo?.full_name,
      expected.repository,
      'GitHub event base repository mismatch'
    );
    compareEventField(
      eventPullRequest.head?.repo?.full_name,
      expected.headRepository,
      'GitHub event head repository mismatch'
    );
  }

  return expected;
}

function parseJsonText(raw, label, maxChars) {
  if (typeof raw !== 'string' || raw.length > maxChars) {
    fail(`${label} exceeds size limit`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    fail(`Malformed ${label}`);
  }
}

export async function readBoundedJsonFile(filePath, maxChars) {
  if (typeof filePath !== 'string' || filePath.length === 0 || filePath.includes('\0')) {
    fail('Invalid JSON artifact path');
  }
  let fileInfo;
  let raw;
  try {
    fileInfo = await stat(filePath);
    if (!fileInfo.isFile() || fileInfo.size > maxChars) {
      fail('JSON artifact exceeds size limit');
    }
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && error.message === 'JSON artifact exceeds size limit') {
      throw error;
    }
    fail('Unable to read JSON artifact');
  }
  if (Buffer.byteLength(raw, 'utf8') > maxChars) {
    fail('JSON artifact exceeds size limit');
  }
  return parseJsonText(raw, 'JSON artifact', maxChars);
}

export function parseReviewPayload(value) {
  if (!isRecord(value)) fail('Malformed AI review result');
  if (!('verdict' in value) || !('summary' in value) || !('issues' in value)) {
    fail('Malformed AI review result');
  }
  const keys = Object.keys(value).sort().join(',');
  if (keys !== 'issues,summary,verdict') {
    fail('AI review result contains an unexpected schema');
  }

  if (!REVIEW_VERDICTS.includes(value.verdict)) {
    fail('AI review result contains an unsupported verdict');
  }
  const summary = assertSafeText(
    value.summary,
    'AI review summary',
    LIMITS.maxSummaryChars,
    { allowEmpty: false }
  );
  if (!Array.isArray(value.issues) || value.issues.length > LIMITS.maxIssues) {
    fail('AI review issues are malformed or exceed size limit');
  }

  const issues = value.issues.map((issue) => {
    if (!isRecord(issue)) fail('Malformed AI review issue');
    const issueKeys = Object.keys(issue).sort().join(',');
    if (issueKeys !== 'file,line,message,severity') {
      fail('AI review issue contains an unexpected schema');
    }
    const file = assertSafeText(
      issue.file,
      'AI review issue file',
      LIMITS.maxIssueFileChars,
      { allowEmpty: false }
    );
    if (file.includes('\r') || file.includes('\n')) {
      fail('Invalid AI review issue file');
    }
    if (
      !Number.isInteger(issue.line) ||
      issue.line < 0 ||
      issue.line > 1_000_000
    ) {
      fail('Invalid AI review issue line');
    }
    if (!ISSUE_SEVERITIES.includes(issue.severity)) {
      fail('Invalid AI review issue severity');
    }
    const message = assertSafeText(
      issue.message,
      'AI review issue message',
      LIMITS.maxIssueMessageChars,
      { allowEmpty: false }
    );
    return { file, line: issue.line, severity: issue.severity, message };
  });

  return { verdict: value.verdict, summary, issues };
}

export function redactSensitiveText(value, secrets = []) {
  if (typeof value !== 'string') return value;
  return secrets
    .filter((secret) => typeof secret === 'string' && secret.length > 0)
    .reduce((result, secret) => result.split(secret).join('[REDACTED]'), value);
}

export function redactReviewSecrets(review, secrets = []) {
  const parsed = parseReviewPayload(review);
  return {
    verdict: parsed.verdict,
    summary: redactSensitiveText(parsed.summary, secrets),
    issues: parsed.issues.map((issue) => ({
      file: redactSensitiveText(issue.file, secrets),
      line: issue.line,
      severity: issue.severity,
      message: redactSensitiveText(issue.message, secrets),
    })),
  };
}

export function buildReviewBody(review, secrets = []) {
  const safeReview = redactReviewSecrets(review, secrets);
  const header = '## 📝 AI Code Review (advisory)\n\n';
  const advisory =
    '> Advisory only: the AI verdict does not authorize GitHub APPROVE or REQUEST_CHANGES; this publication is a COMMENT.\n\n';
  const verdict = `**Advisory AI verdict:** \`${safeReview.verdict}\`\n\n`;
  const summary = `**Summary:** ${safeReview.summary}\n\n`;

  if (safeReview.issues.length === 0) {
    const body = `${header}${advisory}${verdict}${summary}No issues found.`;
    if (body.length > LIMITS.maxReviewBodyChars) {
      fail('GitHub review body exceeds size limit');
    }
    return body;
  }

  const severityIcon = {
    critical: '🔴',
    warning: '🟡',
    suggestion: '🔵',
  };
  const issueList = safeReview.issues
    .map(
      (issue) =>
        `- ${severityIcon[issue.severity]} **${issue.severity.toUpperCase()}** \`${issue.file}:${issue.line}\`\n  ${issue.message}`
    )
    .join('\n');
  const body = `${header}${advisory}${verdict}${summary}### Issues Found\n\n${issueList}`;
  if (body.length > LIMITS.maxReviewBodyChars) {
    fail('GitHub review body exceeds size limit');
  }
  return body;
}

function validateArtifactIdentity(artifact, expected) {
  const identity = validateExpectedIdentity(expected);
  if (
    artifact.repository !== identity.repository ||
    artifact.prNumber !== identity.prNumber ||
    artifact.baseRef !== identity.baseRef ||
    artifact.baseSha !== identity.baseSha ||
    artifact.headSha !== identity.headSha ||
    artifact.headRepository !== identity.headRepository
  ) {
    fail('Review artifact identity does not match the expected pull request');
  }
  return identity;
}

export function serializeReviewArtifact({ identity, review, secrets = [] }) {
  const normalizedIdentity = validateExpectedIdentity(identity);
  const safeReview = redactReviewSecrets(review, secrets);
  const artifact = {
    schemaVersion: 1,
    repository: normalizedIdentity.repository,
    prNumber: normalizedIdentity.prNumber,
    baseRef: normalizedIdentity.baseRef,
    baseSha: normalizedIdentity.baseSha,
    headSha: normalizedIdentity.headSha,
    headRepository: normalizedIdentity.headRepository,
    verdict: safeReview.verdict,
    summary: safeReview.summary,
    issues: safeReview.issues,
  };
  const raw = JSON.stringify(artifact);
  if (raw.length > LIMITS.maxArtifactChars) {
    fail('Review artifact exceeds size limit');
  }
  return `${raw}\n`;
}

export function parseReviewArtifact(value, expected) {
  if (!isRecord(value)) fail('Malformed review artifact');
  const keys = Object.keys(value).sort().join(',');
  if (
    keys !==
    'baseRef,baseSha,headRepository,headSha,issues,prNumber,repository,schemaVersion,summary,verdict'
  ) {
    fail('Review artifact contains an unexpected schema');
  }
  if (value.schemaVersion !== 1) fail('Unsupported review artifact version');
  const identity = validateArtifactIdentity(value, expected);
  const review = parseReviewPayload({
    verdict: value.verdict,
    summary: value.summary,
    issues: value.issues,
  });
  return { ...identity, ...review, schemaVersion: 1 };
}
