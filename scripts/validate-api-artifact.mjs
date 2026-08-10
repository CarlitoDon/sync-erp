import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/i;

const REQUIRED_FILES = [
  'dist/index.js',
  'package.json',
  'release.json',
  'prisma.config.ts',
  'prisma/schema.prisma',
  'prisma/migrations/migration_lock.toml',
  'node_modules/prisma/build/index.js',
  'node_modules/@prisma/client/package.json',
  'node_modules/@prisma/adapter-pg/package.json',
];

const FORBIDDEN_ROOT_ENTRIES = new Set([
  '.env',
  '.git',
  'cookies.txt',
]);

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'invalid JSON';
    throw new Error(
      `${path.basename(filePath)} is not valid JSON: ${reason}`
    );
  }
}

async function requireRegularFile(root, relativePath, errors) {
  const absolutePath = path.join(root, relativePath);
  try {
    const stats = await lstat(absolutePath);
    if (!stats.isFile()) {
      errors.push(`${relativePath} must be a regular file.`);
    }
  } catch {
    errors.push(`Missing ${relativePath}.`);
  }
}

function parseOptions(argv) {
  const get = (name) => {
    const index = argv.indexOf(name);
    const value = index === -1 ? undefined : argv[index + 1];
    if (index !== -1 && (!value || value.startsWith('--'))) {
      throw new Error(`Missing value for ${name}.`);
    }
    return value;
  };

  return {
    artifactDir: get('--artifact-dir'),
    expectedSha: get('--expected-sha'),
  };
}

export async function validateApiArtifact({
  artifactDir,
  expectedSha,
}) {
  const root = path.resolve(artifactDir);
  const errors = [];

  if (!RELEASE_SHA_PATTERN.test(expectedSha)) {
    errors.push(
      'Expected release SHA must be a 40-character hexadecimal commit.'
    );
  }

  try {
    const rootStats = await lstat(root);
    if (!rootStats.isDirectory()) {
      errors.push('Artifact path must be a directory.');
    }
  } catch {
    errors.push('Artifact directory does not exist.');
  }

  if (errors.length > 0) {
    throw new Error(
      `API release artifact validation failed:\n- ${errors.join('\n- ')}`
    );
  }

  for (const relativePath of REQUIRED_FILES) {
    await requireRegularFile(root, relativePath, errors);
  }

  const rootEntries = await readdir(root, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (
      FORBIDDEN_ROOT_ENTRIES.has(entry.name) ||
      entry.name.startsWith('.env.')
    ) {
      errors.push(`Forbidden root entry ${entry.name}.`);
    }
  }

  let packageJson;
  try {
    packageJson = await readJson(path.join(root, 'package.json'));
  } catch (error) {
    errors.push(error.message);
  }

  if (packageJson) {
    if (packageJson.name !== '@sync-erp/api') {
      errors.push('package.json must describe @sync-erp/api.');
    }
    if (packageJson.scripts?.start !== 'node dist/index.js') {
      errors.push(
        'package.json must start the bundled dist/index.js entrypoint.'
      );
    }
    if (typeof packageJson.dependencies?.prisma !== 'string') {
      errors.push(
        'package.json must ship Prisma as a production dependency.'
      );
    }
  }

  let releaseManifest;
  try {
    releaseManifest = await readJson(path.join(root, 'release.json'));
  } catch (error) {
    errors.push(error.message);
  }

  if (releaseManifest) {
    if (releaseManifest.schemaVersion !== 1) {
      errors.push('release.json must use schemaVersion 1.');
    }
    if (releaseManifest.service !== 'sync-erp-api') {
      errors.push(
        'release.json must identify the sync-erp-api service.'
      );
    }
    if (releaseManifest.commit !== expectedSha) {
      errors.push(
        'release.json commit does not match the workflow SHA.'
      );
    }
  }

  const migrationsPath = path.join(root, 'prisma', 'migrations');
  let migrationEntries = [];
  try {
    migrationEntries = await readdir(migrationsPath, {
      withFileTypes: true,
    });
  } catch {
    errors.push('Missing prisma/migrations directory.');
  }

  const migrationDirectories = migrationEntries.filter(
    (entry) => entry.isDirectory() && !entry.name.startsWith('.')
  );
  for (const migration of migrationDirectories) {
    await requireRegularFile(
      root,
      path.join(
        'prisma',
        'migrations',
        migration.name,
        'migration.sql'
      ),
      errors
    );
  }
  if (migrationDirectories.length === 0) {
    errors.push(
      'Artifact must contain at least one Prisma migration.'
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `API release artifact validation failed:\n- ${errors.join('\n- ')}`
    );
  }

  return {
    commit: releaseManifest.commit,
    migrationCount: migrationDirectories.length,
    service: releaseManifest.service,
  };
}

const isCliInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliInvocation) {
  try {
    const { artifactDir, expectedSha } = parseOptions(
      process.argv.slice(2)
    );
    if (!artifactDir || !expectedSha) {
      throw new Error(
        'Usage: node scripts/validate-api-artifact.mjs --artifact-dir <dir> --expected-sha <sha>.'
      );
    }

    const result = await validateApiArtifact({
      artifactDir,
      expectedSha,
    });
    console.log(
      `Validated ${result.service} artifact for ${result.commit} with ${result.migrationCount} migrations.`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
