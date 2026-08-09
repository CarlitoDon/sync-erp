import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  analyzePreflight,
  createDefaultMetadataAdapter,
  formatReport,
  runPreflight,
} from './artifact-remediation-preflight.mjs';

const scriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'artifact-remediation-preflight.mjs',
);

function cleanInput(overrides = {}) {
  return {
    mode: 'current-tree',
    trackedPaths: [],
    trackedPathsOk: true,
    worktreeStatus: { state: 'CLEAN', entries: 0 },
    archiveResults: [],
    ...overrides,
  };
}

test('blocks a tracked environment file and reports only its path metadata', () => {
  const result = analyzePreflight(
    cleanInput({ trackedPaths: ['apps/api/.env.production'] }),
  );
  const report = formatReport(result);

  assert.equal(result.result, 'BLOCKED');
  assert.equal(result.exitCode, 1);
  assert.match(report, /TRACKED_SECRET_LIKE_PATHS: 1/);
  assert.match(report, /\n\x20{2}apps\/api\/.env\.production/);
  assert.doesNotMatch(report, /DATABASE_URL|password|secret-value/i);
  assert.match(report, /GIT_DIFF_CHECK: NOT_RUN_METADATA_ONLY/);
  assert.match(report, /CONTENT_READ: NONE/);
});

test('flags .env.example for review without counting it as a sensitive env path', () => {
  const result = analyzePreflight(
    cleanInput({ trackedPaths: ['apps/api/.env.example'] }),
  );

  assert.equal(result.result, 'BLOCKED');
  assert.deepEqual(result.trackedSensitivePaths, []);
  assert.deepEqual(result.envExampleNeedsReview, ['apps/api/.env.example']);
  assert.equal(result.historyRewriteEligible, false);
});

test('blocks cookie artifacts and the audited check-migrations.js path', () => {
  const result = analyzePreflight(
    cleanInput({ trackedPaths: ['cookies.txt', 'check-migrations.js'] }),
  );
  const report = formatReport(result);

  assert.equal(result.result, 'BLOCKED');
  assert.deepEqual(result.trackedSensitivePaths, ['cookies.txt']);
  assert.deepEqual(result.auditedPaths, ['check-migrations.js']);
  assert.match(report, /KNOWN_AUDIT_SENSITIVE_PATHS: 1/);
});

test('blocks a ZIP member named .env without reading archive payload', () => {
  const result = analyzePreflight(
    cleanInput({
      trackedPaths: ['bundle.zip'],
      archiveResults: [
        { path: 'bundle.zip', state: 'MEMBERS', members: ['dist/index.js', '.env'] },
      ],
    }),
  );

  assert.equal(result.result, 'BLOCKED');
  assert.deepEqual(result.archiveSecretMembers, ['bundle.zip:.env']);
  assert.equal(result.contentRead, 'NONE');
});

test('blocks a clean-named deployment ZIP even without a sensitive member', () => {
  const result = analyzePreflight(
    cleanInput({
      trackedPaths: ['deploy/release.zip'],
      archiveResults: [
        {
          path: 'deploy/release.zip',
          state: 'MEMBERS',
          members: ['dist/index.js'],
        },
      ],
    }),
  );

  assert.equal(result.result, 'BLOCKED');
  assert.deepEqual(result.deployArchives, ['deploy/release.zip']);
});

test('never passes or becomes eligible from complete-looking local approval data', () => {
  const result = analyzePreflight({
    ...cleanInput({ mode: 'history-rewrite' }),
    manifest: {
      approved: true,
      caseId: 'self-asserted',
      owners: ['self-asserted'],
    },
    environmentApproval: 'yes',
    historyRewriteApproval: true,
  });

  assert.equal(result.result, 'BLOCKED');
  assert.equal(result.exitCode, 1);
  assert.equal(result.historyRewriteEligible, false);
  assert.match(formatReport(result), /APPROVAL_VERIFICATION: OUT_OF_BAND_REQUIRED/);
});

test('history-rewrite mode blocks dirty worktree metadata in injected input', () => {
  const result = analyzePreflight(
    cleanInput({
      mode: 'history-rewrite',
      worktreeStatus: { state: 'CLEAN', entries: 2 },
    }),
  );

  assert.equal(result.worktreeStatus, 'DIRTY');
  assert.equal(result.historyWorktreeGate, 'BLOCKED_DIRTY');
  assert.equal(result.result, 'BLOCKED');
});

test('Git metadata calls use controlled fixed argv and never invoke diff', () => {
  const calls = [];
  const fakeExecFileSync = (file, args, options) => {
    calls.push({ file, args, options });
    if (args.includes('ls-files')) return 'apps/api/.env.example\0';
    if (args.includes('status')) return '?? synthetic.txt\0';
    throw new Error('unexpected metadata command');
  };
  const adapter = createDefaultMetadataAdapter({ execFileSyncImpl: fakeExecFileSync });
  const result = runPreflight({ repoRoot: '/synthetic/repository', adapter });
  const gitCalls = calls.filter((call) => call.file === '/usr/bin/git');

  assert.equal(result.result, 'BLOCKED');
  assert.equal(gitCalls.length, 2);
  assert.equal(calls.every((call) => call.options.shell === false), true);
  assert.equal(calls.every((call) => call.options.env.GIT_OPTIONAL_LOCKS === '0'), true);
  assert.equal(calls.every((call) => call.options.env.GIT_EXTERNAL_DIFF === '0'), true);
  assert.equal(gitCalls.every((call) => call.args.includes('--no-optional-locks')), true);
  assert.equal(gitCalls.every((call) => call.args.includes('--no-pager')), true);
  assert.equal(
    gitCalls.every((call) => call.args.includes('core.hooksPath=/dev/null')),
    true,
  );
  assert.equal(gitCalls.every((call) => call.args.includes('diff.external=')), true);
  assert.equal(gitCalls.some((call) => call.args.includes('diff')), false);
  assert.equal(gitCalls.some((call) => call.args.includes('fetch')), false);
});

test('rejects a symlink ZIP without listing members', () => {
  const calls = [];
  const adapter = createDefaultMetadataAdapter({
    execFileSyncImpl: (file, args, options) => {
      calls.push({ file, args, options });
      if (args.includes('ls-files')) return 'artifact.zip\0';
      if (args.includes('status')) return '';
      throw new Error('unzip must not run for a symlink');
    },
    lstatSyncImpl: () => ({
      isFile: () => true,
      isSymbolicLink: () => true,
    }),
    realpathSyncImpl: (candidate) => candidate,
  });
  const result = runPreflight({ repoRoot: '/repo', adapter });

  assert.deepEqual(result.archiveNeedsReview, ['artifact.zip']);
  assert.equal(calls.some((call) => call.file === '/usr/bin/unzip'), false);
});

test('rejects a ZIP resolving outside the real repository root', () => {
  const calls = [];
  const adapter = createDefaultMetadataAdapter({
    execFileSyncImpl: (file, args, options) => {
      calls.push({ file, args, options });
      if (args.includes('ls-files')) return 'artifact.zip\0';
      if (args.includes('status')) return '';
      throw new Error('unzip must not run outside the repository');
    },
    lstatSyncImpl: () => ({
      isFile: () => true,
      isSymbolicLink: () => false,
    }),
    realpathSyncImpl: (candidate) =>
      candidate === '/repo' ? '/real/repository' : '/outside/artifact.zip',
  });
  const result = runPreflight({ repoRoot: '/repo', adapter });

  assert.deepEqual(result.archiveNeedsReview, ['artifact.zip']);
  assert.equal(calls.some((call) => call.file === '/usr/bin/unzip'), false);
});

test('flags tgz and tar.gz archives without inspecting or decompressing them', () => {
  let zipInspectionCalled = false;
  const result = runPreflight({
    repoRoot: '/synthetic/repository',
    adapter: {
      getTrackedPaths: () => ['bundle.tgz', 'bundle.tar.gz'],
      getWorktreeStatus: () => ({ state: 'CLEAN', entries: 0 }),
      inspectZipArchive: () => {
        zipInspectionCalled = true;
        throw new Error('must not inspect a tgz archive');
      },
    },
  });

  assert.equal(zipInspectionCalled, false);
  assert.deepEqual(result.archiveNeedsReview, ['bundle.tar.gz', 'bundle.tgz']);
});

test('escapes control characters in member-name findings', () => {
  const newline = String.fromCharCode(10);
  const result = analyzePreflight(
    cleanInput({
      trackedPaths: ['bundle.zip'],
      archiveResults: [
        {
          path: 'bundle.zip',
          state: 'MEMBERS',
          members: [`.env${newline}spoofed-output`],
        },
      ],
    }),
  );
  const report = formatReport(result);

  assert.equal(result.archiveControlMemberNames.length, 1);
  assert.match(report, /\.env\\nspoofed-output/);
  assert.doesNotMatch(report, /\.env\nspoofed-output/);
});

test('manifest-like CLI arguments are rejected with redacted nonzero results', () => {
  for (const mode of ['current-tree', 'history-rewrite']) {
    const child = spawnSync(
      process.execPath,
      [scriptPath, '--mode', mode, '--manifest', '/must/not/be/read.json'],
      {
        encoding: 'utf8',
        env: { PATH: '/usr/bin:/bin' },
        shell: false,
      },
    );

    assert.equal(child.status, 1);
    assert.match(child.stdout, /RESULT: BLOCKED/);
    assert.match(child.stdout, /LOCAL_APPROVAL_INPUT: REJECTED/);
    assert.match(child.stdout, /CONTENT_READ: NONE/);
    assert.doesNotMatch(child.stdout, /must\/not\/be\/read/);
  }
});

test('default metadata adapter has no file-content reader dependency', () => {
  let unexpectedContentRead = false;
  const adapter = createDefaultMetadataAdapter({
    execFileSyncImpl: (file, args) => {
      if (args.includes('ls-files')) return '';
      if (args.includes('status')) return '';
      throw new Error('unexpected command');
    },
    readFileSyncImpl: () => {
      unexpectedContentRead = true;
      throw new Error('content read is forbidden');
    },
  });
  const result = runPreflight({ repoRoot: '/synthetic/repository', adapter });

  assert.equal(result.contentRead, 'NONE');
  assert.equal(unexpectedContentRead, false);
});
