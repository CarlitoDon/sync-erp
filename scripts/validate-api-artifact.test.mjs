import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateApiArtifact } from './validate-api-artifact.mjs';

const COMMIT = 'a'.repeat(40);

async function writeFixtureFile(root, relativePath, contents) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, 'utf8');
}

async function createArtifactFixture() {
  const root = await mkdtemp(
    path.join(os.tmpdir(), 'sync-erp-api-artifact-')
  );
  const packageJson = {
    name: '@sync-erp/api',
    scripts: { start: 'node dist/index.js' },
    dependencies: { prisma: '7.1.0' },
  };
  const releaseManifest = {
    schemaVersion: 1,
    service: 'sync-erp-api',
    commit: COMMIT,
  };

  await writeFixtureFile(
    root,
    'dist/index.js',
    'console.log("fixture");\n'
  );
  await writeFixtureFile(
    root,
    'package.json',
    JSON.stringify(packageJson)
  );
  await writeFixtureFile(
    root,
    'release.json',
    JSON.stringify(releaseManifest)
  );
  await writeFixtureFile(
    root,
    'prisma.config.ts',
    'export default {};\n'
  );
  await writeFixtureFile(
    root,
    'prisma/schema.prisma',
    'datasource db { provider = "postgresql" }\n'
  );
  await writeFixtureFile(
    root,
    'prisma/migrations/migration_lock.toml',
    'provider = "postgresql"\n'
  );
  await writeFixtureFile(
    root,
    'prisma/migrations/20260101000000_init/migration.sql',
    '-- fixture\n'
  );
  await writeFixtureFile(
    root,
    'node_modules/prisma/build/index.js',
    'console.log("prisma");\n'
  );
  await writeFixtureFile(
    root,
    'node_modules/@prisma/client/package.json',
    '{}'
  );
  await writeFixtureFile(
    root,
    'node_modules/@prisma/adapter-pg/package.json',
    '{}'
  );

  return root;
}

test('accepts a complete artifact with its exact release SHA', async (t) => {
  const root = await createArtifactFixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  await assert.doesNotReject(async () => {
    const result = await validateApiArtifact({
      artifactDir: root,
      expectedSha: COMMIT,
    });
    assert.deepEqual(result, {
      commit: COMMIT,
      migrationCount: 1,
      service: 'sync-erp-api',
    });
  });
});

test('rejects an artifact without the artifact-local Prisma CLI', async (t) => {
  const root = await createArtifactFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await rm(path.join(root, 'node_modules/prisma/build/index.js'));

  await assert.rejects(
    validateApiArtifact({ artifactDir: root, expectedSha: COMMIT }),
    /Missing node_modules\/prisma\/build\/index\.js\./
  );
});

test('rejects a release manifest for a different commit', async (t) => {
  const root = await createArtifactFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFixtureFile(
    root,
    'release.json',
    JSON.stringify({
      schemaVersion: 1,
      service: 'sync-erp-api',
      commit: 'b'.repeat(40),
    })
  );

  await assert.rejects(
    validateApiArtifact({ artifactDir: root, expectedSha: COMMIT }),
    /release\.json commit does not match the workflow SHA\./
  );
});
