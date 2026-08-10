import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SHA_PATTERN = /^[0-9a-f]{40}$/i;

function option(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}.`);
  }

  return value;
}

function requiredOption(name) {
  const value = option(name);
  if (!value) {
    throw new Error(`Missing required option ${name}.`);
  }
  return value;
}

const output = path.resolve(requiredOption('--output'));
const service = requiredOption('--service');
const commit = requiredOption('--commit');

if (!SHA_PATTERN.test(commit)) {
  throw new Error(
    `Release commit must be a 40-character SHA, received ${commit.length} characters.`
  );
}

const manifest = {
  schemaVersion: 1,
  service,
  commit,
  repository: option(
    '--repository',
    process.env.GITHUB_REPOSITORY ?? null
  ),
  ref: option('--ref', process.env.GITHUB_REF ?? null),
  workflowRunId: option(
    '--run-id',
    process.env.GITHUB_RUN_ID ?? null
  ),
};

await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8'
);

console.log(`Wrote release manifest for ${service} at ${commit}.`);
