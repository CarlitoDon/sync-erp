import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/i;

function requiredOption(argv, name) {
  const index = argv.indexOf(name);
  const value = index === -1 ? undefined : argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing required option ${name}.`);
  }
  return value;
}

export function validateReleaseHealthPayload({
  payload,
  expectedSha,
}) {
  if (!RELEASE_SHA_PATTERN.test(expectedSha)) {
    throw new Error(
      'Expected release SHA must be a 40-character hexadecimal commit.'
    );
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Health response must be a JSON object.');
  }

  const release = payload.release;
  if (!release || typeof release !== 'object') {
    throw new Error('Health response is missing release identity.');
  }

  if (release.commit !== expectedSha) {
    throw new Error(
      `Health release commit ${String(release.commit)} does not match expected ${expectedSha}.`
    );
  }

  if (
    typeof release.version !== 'string' ||
    release.version.trim().length === 0
  ) {
    throw new Error('Health response is missing release version.');
  }

  return {
    commit: release.commit,
    version: release.version,
  };
}

export async function verifyReleaseHealth({
  url,
  expectedSha,
  fetchImpl = fetch,
}) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    throw new Error(
      `Health request failed for ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Health request returned HTTP ${response.status} for ${url}.`
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(
      `Health response was not valid JSON for ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return validateReleaseHealthPayload({ payload, expectedSha });
}

const isCliInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliInvocation) {
  try {
    const url = requiredOption(process.argv.slice(2), '--url');
    const expectedSha = requiredOption(
      process.argv.slice(2),
      '--expected-sha'
    );
    const result = await verifyReleaseHealth({ url, expectedSha });
    console.log(
      `Verified release health for ${result.commit} (${result.version}) at ${url}.`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
