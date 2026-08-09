#!/usr/bin/env node

import { execFileSync as nodeExecFileSync } from 'node:child_process';
import { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_COMMAND_OUTPUT_BYTES = 2 * 1024 * 1024;
const GIT_EXECUTABLE = '/usr/bin/git';
const UNZIP_EXECUTABLE = '/usr/bin/unzip';
const AUDITED_SENSITIVE_PATHS = new Set(['check-migrations.js']);
const KNOWN_SENSITIVE_TRACKED_PATHS = new Set([
  'apps/api/.env.production',
  'apps/api/.env.staging',
  'apps/bot/.env.production',
  'apps/bot/.env.staging',
  'apps/web/.env.production',
  'apps/web/.env.staging',
  'packages/database/.env.production',
  'packages/database/.env.staging',
  'cookies.txt',
  'deploy/api.zip',
  'deploy/bot.zip',
]);
const CONTROLLED_ENV = Object.freeze({
  PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
  LC_ALL: 'C',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_OPTIONAL_LOCKS: '0',
  GIT_PAGER: 'cat',
  PAGER: 'cat',
  GIT_TERMINAL_PROMPT: '0',
  GIT_EXTERNAL_DIFF: '0',
  NO_COLOR: '1',
});
const GIT_METADATA_PREFIX = [
  '--no-pager',
  '--no-optional-locks',
  '-c',
  'core.hooksPath=/dev/null',
  '-c',
  'core.pager=cat',
  '-c',
  'color.ui=false',
  '-c',
  'core.quotepath=true',
  '-c',
  'diff.external=',
];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function containsControlCharacter(value) {
  return [...String(value)].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

function safeDisplay(value) {
  const text = String(value);
  return containsControlCharacter(text) ? JSON.stringify(text) : text;
}

function basenameOf(value) {
  const normalized = String(value).replaceAll('\\', '/');
  const parts = normalized.split('/');
  return parts.at(-1) ?? '';
}

function isEnvExamplePath(value) {
  return basenameOf(value).toLowerCase() === '.env.example';
}

function isEnvLikePath(value) {
  const basename = basenameOf(value).toLowerCase();
  return (
    !isEnvExamplePath(value) &&
    (basename === '.env' || basename.startsWith('.env.'))
  );
}

function isCookieLikePath(value) {
  const basename = basenameOf(value).toLowerCase();
  return /^(?:cookies?|cookiejar)(?:[._-].*)?$/.test(basename);
}

function isGenericSecretLikePath(value) {
  const basename = basenameOf(value);
  return (
    /(?:secret|credential|token|private)/i.test(basename) ||
    /\.(?:pem|key|p12)$/i.test(basename)
  );
}

function isSensitivePathLike(value) {
  return (
    isEnvLikePath(value) ||
    isCookieLikePath(value) ||
    isGenericSecretLikePath(value)
  );
}

function isSensitiveTrackedPath(value) {
  return KNOWN_SENSITIVE_TRACKED_PATHS.has(value) || isSensitivePathLike(value);
}

function archiveType(value) {
  const normalized = String(value).replaceAll('\\', '/').toLowerCase();
  if (normalized.endsWith('.tar.gz') || normalized.endsWith('.tgz')) return 'TGZ';
  if (normalized.endsWith('.zip')) return 'ZIP';
  return null;
}

function isDeployArchive(value) {
  return String(value).replaceAll('\\', '/').startsWith('deploy/');
}

function isSafeRepoRelativePath(value) {
  if (!isNonEmptyString(value) || containsControlCharacter(value)) return false;
  if (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)) return false;
  return !value.replaceAll('\\', '/').split('/').includes('..');
}

function resolveSafeRepoPath(repoRoot, relativePath) {
  if (!isSafeRepoRelativePath(relativePath)) return null;
  const root = path.resolve(repoRoot);
  const absolute = path.resolve(root, relativePath);
  const relativeFromRoot = path.relative(root, absolute);
  if (
    relativeFromRoot.startsWith('..') ||
    path.isAbsolute(relativeFromRoot)
  ) {
    return null;
  }
  return absolute;
}

function isPathWithinRoot(rootPath, candidatePath) {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath.length > 0 &&
    !relativePath.startsWith('..') &&
    !path.isAbsolute(relativePath)
  );
}

function splitNullSeparated(value) {
  return String(value)
    .split('\0')
    .filter((item) => item.length > 0);
}

function splitLines(value) {
  return String(value)
    .split(/\r?\n/)
    .filter((item) => item.length > 0);
}

function fixedCommandOptions(cwd) {
  return {
    cwd,
    encoding: 'utf8',
    env: { ...CONTROLLED_ENV },
    maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  };
}

function commandText(execFileSyncImpl, file, args, cwd) {
  const output = execFileSyncImpl(file, args, fixedCommandOptions(cwd));
  return Buffer.isBuffer(output) ? output.toString('utf8') : String(output);
}

function parsePorcelainV1Z(value) {
  const records = String(value).split('\0');
  let entries = 0;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.length === 0) continue;
    if (record.length < 4 || record[2] !== ' ') {
      throw new Error('invalid porcelain metadata');
    }
    entries += 1;
    const statusCode = record.slice(0, 2);
    if (statusCode.includes('R') || statusCode.includes('C')) {
      const originalPath = records[index + 1];
      if (originalPath === undefined || originalPath.length === 0) {
        throw new Error('incomplete rename metadata');
      }
      index += 1;
    }
  }
  return entries;
}

function uniqueSorted(values) {
  return [...new Set(values.map(String))].sort();
}

function archiveFindingName(archivePath, memberName) {
  return `${archivePath}:${memberName}`;
}

/**
 * Production adapter: Git receives only fixed metadata arguments and ZIP
 * inspection is restricted to a verified regular file under the real repo.
 * No approval file, environment value, diff, hook, pager, or external diff is
 * read or invoked.
 */
export function createDefaultMetadataAdapter({
  execFileSyncImpl = nodeExecFileSync,
  lstatSyncImpl = lstatSync,
  realpathSyncImpl = realpathSync,
} = {}) {
  const gitMetadata = (args, repoRoot) =>
    commandText(
      execFileSyncImpl,
      GIT_EXECUTABLE,
      [...GIT_METADATA_PREFIX, ...args],
      repoRoot,
    );

  return {
    getTrackedPaths(repoRoot) {
      return splitNullSeparated(gitMetadata(['ls-files', '-z'], repoRoot));
    },

    getWorktreeStatus(repoRoot) {
      const entries = parsePorcelainV1Z(
        gitMetadata(
          ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
          repoRoot,
        ),
      );
      return { state: entries === 0 ? 'CLEAN' : 'DIRTY', entries };
    },

    inspectZipArchive(repoRoot, relativeArchivePath) {
      const candidatePath = resolveSafeRepoPath(repoRoot, relativeArchivePath);
      if (!candidatePath) return { state: 'NEEDS_REVIEW', members: [] };

      try {
        const realRepoRoot = realpathSyncImpl(path.resolve(repoRoot));
        const stat = lstatSyncImpl(candidatePath);
        if (!stat.isFile() || stat.isSymbolicLink()) {
          return { state: 'NEEDS_REVIEW', members: [] };
        }
        const realArchivePath = realpathSyncImpl(candidatePath);
        if (!isPathWithinRoot(realRepoRoot, realArchivePath)) {
          return { state: 'NEEDS_REVIEW', members: [] };
        }
        return {
          state: 'MEMBERS',
          members: splitLines(
            commandText(
              execFileSyncImpl,
              UNZIP_EXECUTABLE,
              ['-Z1', realArchivePath],
              undefined,
            ),
          ),
        };
      } catch {
        return { state: 'NEEDS_REVIEW', members: [] };
      }
    },
  };
}

function normalizeWorktreeStatus(value) {
  if (!value || !Number.isInteger(value.entries) || value.entries < 0) {
    return { state: 'ERROR', entries: 0 };
  }
  if (value.state === 'DIRTY' || value.entries > 0) {
    return { state: 'DIRTY', entries: value.entries };
  }
  if (value.state === 'CLEAN') return { state: 'CLEAN', entries: 0 };
  return { state: 'ERROR', entries: 0 };
}

/**
 * Analyze path/member-name metadata. This tool is intentionally a blocker,
 * never an authorization mechanism: no local input can produce PASS or make
 * history rewriting eligible.
 */
export function analyzePreflight({
  mode = 'current-tree',
  trackedPaths = [],
  trackedPathsOk = true,
  worktreeStatus = { state: 'CLEAN', entries: 0 },
  archiveResults = [],
} = {}) {
  if (!['current-tree', 'history-rewrite'].includes(mode)) {
    throw new Error('unsupported mode');
  }

  const normalizedTrackedPaths = uniqueSorted(trackedPaths);
  const normalizedWorktreeStatus = normalizeWorktreeStatus(worktreeStatus);
  const trackedSensitivePaths = normalizedTrackedPaths.filter(isSensitiveTrackedPath);
  const auditedPaths = normalizedTrackedPaths.filter((value) =>
    AUDITED_SENSITIVE_PATHS.has(value),
  );
  const envExamplePaths = normalizedTrackedPaths.filter(isEnvExamplePath);
  const unsafeTrackedPaths = normalizedTrackedPaths.filter(
    (value) => !isSafeRepoRelativePath(value),
  );
  const deployArchives = normalizedTrackedPaths.filter(
    (value) => archiveType(value) && isDeployArchive(value),
  );
  const archiveSecretMembers = [];
  const archiveEnvExampleMembers = [];
  const archiveControlMemberNames = [];
  const archiveNeedsReview = [];

  for (const archive of archiveResults) {
    const archivePath = String(archive.path);
    if (archive.state !== 'MEMBERS' || !Array.isArray(archive.members)) {
      archiveNeedsReview.push(archivePath);
      continue;
    }
    for (const memberName of uniqueSorted(archive.members)) {
      const findingName = archiveFindingName(archivePath, memberName);
      if (containsControlCharacter(memberName)) {
        archiveControlMemberNames.push(findingName);
      }
      if (isEnvExamplePath(memberName)) {
        archiveEnvExampleMembers.push(findingName);
      } else if (isSensitivePathLike(memberName)) {
        archiveSecretMembers.push(findingName);
      }
    }
  }

  const envExampleNeedsReview = uniqueSorted([
    ...envExamplePaths,
    ...archiveEnvExampleMembers,
  ]);
  const historyWorktreeBlocked =
    mode === 'history-rewrite' && normalizedWorktreeStatus.state !== 'CLEAN';
  const metadataFindings =
    trackedSensitivePaths.length +
    auditedPaths.length +
    envExampleNeedsReview.length +
    archiveSecretMembers.length +
    archiveControlMemberNames.length +
    archiveNeedsReview.length +
    deployArchives.length +
    unsafeTrackedPaths.length +
    (trackedPathsOk ? 0 : 1) +
    (normalizedWorktreeStatus.state === 'ERROR' ? 1 : 0) +
    (historyWorktreeBlocked ? 1 : 0);

  return {
    result: 'BLOCKED',
    exitCode: 1,
    mode,
    trackedPathsOk,
    worktreeStatus: normalizedWorktreeStatus.state,
    worktreeStatusEntries: normalizedWorktreeStatus.entries,
    gitDiffCheck: 'NOT_RUN_METADATA_ONLY',
    trackedSensitivePaths,
    auditedPaths,
    envExampleNeedsReview,
    archiveSecretMembers: uniqueSorted(archiveSecretMembers),
    archiveControlMemberNames: uniqueSorted(archiveControlMemberNames),
    archiveNeedsReview: uniqueSorted(archiveNeedsReview),
    deployArchives,
    unsafeTrackedPaths,
    findingsTotal: metadataFindings + 1,
    externalApproval: 'OUT_OF_BAND_REQUIRED',
    historyWorktreeGate:
      mode !== 'history-rewrite'
        ? 'NOT_EVALUATED'
        : historyWorktreeBlocked
          ? `BLOCKED_${normalizedWorktreeStatus.state}`
          : 'CLEAN_METADATA_ONLY_UNAUTHORIZED',
    historyRewriteEligible: false,
    historyRewriteAction: 'NOT_PERFORMED',
    contentRead: 'NONE',
  };
}

export function runPreflight({
  repoRoot = process.cwd(),
  mode = 'current-tree',
  adapter = createDefaultMetadataAdapter(),
} = {}) {
  let trackedPaths = [];
  let trackedPathsOk = true;
  try {
    trackedPaths = adapter.getTrackedPaths(repoRoot);
  } catch {
    trackedPathsOk = false;
  }

  let worktreeStatus = { state: 'ERROR', entries: 0 };
  try {
    worktreeStatus = adapter.getWorktreeStatus(repoRoot);
  } catch {
    worktreeStatus = { state: 'ERROR', entries: 0 };
  }

  const archiveResults = [];
  for (const archivePath of uniqueSorted(trackedPaths.filter(archiveType))) {
    const type = archiveType(archivePath);
    if (type === 'TGZ') {
      archiveResults.push({ path: archivePath, state: 'NEEDS_REVIEW', members: [] });
      continue;
    }
    try {
      const inspected = adapter.inspectZipArchive(repoRoot, archivePath);
      archiveResults.push(
        inspected?.state === 'MEMBERS' && Array.isArray(inspected.members)
          ? { path: archivePath, state: 'MEMBERS', members: inspected.members }
          : { path: archivePath, state: 'NEEDS_REVIEW', members: [] },
      );
    } catch {
      archiveResults.push({ path: archivePath, state: 'NEEDS_REVIEW', members: [] });
    }
  }

  return analyzePreflight({
    mode,
    trackedPaths,
    trackedPathsOk,
    worktreeStatus,
    archiveResults,
  });
}

function formatList(lines, values) {
  for (const value of values) lines.push(`  ${safeDisplay(value)}`);
}

export function formatReport(result) {
  const lines = [
    `RESULT: ${result.result}`,
    `MODE: ${result.mode}`,
    `WORKTREE_STATUS: ${result.worktreeStatus}`,
    `WORKTREE_STATUS_ENTRIES: ${result.worktreeStatusEntries}`,
    `GIT_DIFF_CHECK: ${result.gitDiffCheck}`,
    `TRACKED_PATH_ENUMERATION: ${result.trackedPathsOk ? 'PASS' : 'ERROR'}`,
    `TRACKED_SECRET_LIKE_PATHS: ${result.trackedSensitivePaths.length}`,
  ];
  formatList(lines, result.trackedSensitivePaths);
  lines.push(`KNOWN_AUDIT_SENSITIVE_PATHS: ${result.auditedPaths.length}`);
  formatList(lines, result.auditedPaths);
  lines.push(`ENV_EXAMPLE_NEEDS_REVIEW: ${result.envExampleNeedsReview.length}`);
  formatList(lines, result.envExampleNeedsReview);
  lines.push(`ARCHIVE_SECRET_MEMBERS: ${result.archiveSecretMembers.length}`);
  formatList(lines, result.archiveSecretMembers);
  lines.push(
    `ARCHIVE_MEMBER_NAME_NEEDS_REVIEW: ${result.archiveControlMemberNames.length}`,
  );
  formatList(lines, result.archiveControlMemberNames);
  lines.push(`ARCHIVE_NEEDS_REVIEW: ${result.archiveNeedsReview.length}`);
  formatList(lines, result.archiveNeedsReview);
  lines.push(`DEPLOY_ARCHIVES_BLOCKED: ${result.deployArchives.length}`);
  formatList(lines, result.deployArchives);
  lines.push(`UNSAFE_TRACKED_PATHS: ${result.unsafeTrackedPaths.length}`);
  formatList(lines, result.unsafeTrackedPaths);
  lines.push(`FINDINGS_TOTAL: ${result.findingsTotal}`);
  lines.push(`LOCAL_APPROVAL_INPUT: NOT_ACCEPTED`);
  lines.push(`APPROVAL_VERIFICATION: ${result.externalApproval}`);
  lines.push(`G3_SIGNOFF: ${result.externalApproval}`);
  lines.push(`CLEANUP_AUTHORIZATION: ${result.externalApproval}`);
  lines.push(`HISTORY_REWRITE_APPROVAL: ${result.externalApproval}`);
  lines.push(`HISTORY_WORKTREE_GATE: ${result.historyWorktreeGate}`);
  lines.push(`HISTORY_REWRITE_ELIGIBLE: NO`);
  lines.push(`HISTORY_REWRITE_ACTION: ${result.historyRewriteAction}`);
  lines.push(`EXIT_CODE: ${result.exitCode}`);
  lines.push(`CONTENT_READ: ${result.contentRead}`);
  return `${lines.join('\n')}\n`;
}

function rejectedApprovalInputReport(mode) {
  return [
    'RESULT: BLOCKED',
    `MODE: ${mode}`,
    'WORKTREE_STATUS: NOT_RUN_REJECTED_INPUT',
    'WORKTREE_STATUS_ENTRIES: 0',
    'GIT_DIFF_CHECK: NOT_RUN_METADATA_ONLY',
    'TRACKED_PATH_ENUMERATION: NOT_RUN_REJECTED_INPUT',
    'TRACKED_SECRET_LIKE_PATHS: 0',
    'KNOWN_AUDIT_SENSITIVE_PATHS: 0',
    'ENV_EXAMPLE_NEEDS_REVIEW: 0',
    'ARCHIVE_SECRET_MEMBERS: 0',
    'ARCHIVE_MEMBER_NAME_NEEDS_REVIEW: 0',
    'ARCHIVE_NEEDS_REVIEW: 0',
    'DEPLOY_ARCHIVES_BLOCKED: 0',
    'UNSAFE_TRACKED_PATHS: 0',
    'FINDINGS_TOTAL: 1',
    'LOCAL_APPROVAL_INPUT: REJECTED',
    'APPROVAL_VERIFICATION: OUT_OF_BAND_REQUIRED',
    'G3_SIGNOFF: OUT_OF_BAND_REQUIRED',
    'CLEANUP_AUTHORIZATION: OUT_OF_BAND_REQUIRED',
    'HISTORY_REWRITE_APPROVAL: OUT_OF_BAND_REQUIRED',
    'HISTORY_WORKTREE_GATE: NOT_EVALUATED',
    'HISTORY_REWRITE_ELIGIBLE: NO',
    'HISTORY_REWRITE_ACTION: NOT_PERFORMED',
    'EXIT_CODE: 1',
    'CONTENT_READ: NONE',
    '',
  ].join('\n');
}

function isRejectedApprovalArgument(argument) {
  return (
    argument === '--manifest' ||
    argument.startsWith('--manifest=') ||
    argument === '--approval' ||
    argument.startsWith('--approval=') ||
    argument === '--approval-manifest' ||
    argument.startsWith('--approval-manifest=') ||
    argument === '--history-approval' ||
    argument.startsWith('--history-approval=')
  );
}

export function parseArgs(argv) {
  const options = { mode: 'current-tree', rejectedApprovalInput: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (isRejectedApprovalArgument(argument)) {
      return { ...options, rejectedApprovalInput: true };
    }
    if (argument === '--mode') {
      const value = argv[index + 1];
      if (!value || !['current-tree', 'history-rewrite'].includes(value)) {
        throw new Error('invalid mode');
      }
      options.mode = value;
      index += 1;
      continue;
    }
    throw new Error('invalid argument');
  }
  return options;
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    if (options.rejectedApprovalInput) {
      process.stdout.write(rejectedApprovalInputReport(options.mode));
      return 1;
    }
    const result = runPreflight({ mode: options.mode });
    process.stdout.write(formatReport(result));
    return result.exitCode;
  } catch {
    process.stdout.write(rejectedApprovalInputReport('INVALID_ARGUMENT'));
    return 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  process.exitCode = main();
}
