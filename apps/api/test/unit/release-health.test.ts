import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getReleaseIdentity } from '../../src/release-identity';

const originalManifestPath =
  process.env.SYNC_ERP_RELEASE_MANIFEST_PATH;

afterEach(() => {
  if (originalManifestPath === undefined) {
    delete process.env.SYNC_ERP_RELEASE_MANIFEST_PATH;
  } else {
    process.env.SYNC_ERP_RELEASE_MANIFEST_PATH = originalManifestPath;
  }
});

describe('release identity health contract', () => {
  it('returns explicit unknown values when release.json is absent', () => {
    process.env.SYNC_ERP_RELEASE_MANIFEST_PATH = path.join(
      os.tmpdir(),
      'sync-erp-release-manifest-does-not-exist.json'
    );

    expect(getReleaseIdentity()).toEqual({
      commit: 'unknown',
      version: 'unknown',
    });
  });

  it('returns the manifest commit and version', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'sync-erp-release-health-')
    );
    const manifestPath = path.join(directory, 'release.json');
    await writeFile(
      manifestPath,
      JSON.stringify({
        schemaVersion: 1,
        service: 'sync-erp-api',
        commit: 'a'.repeat(40),
        version: '0.0.1',
      })
    );
    process.env.SYNC_ERP_RELEASE_MANIFEST_PATH = manifestPath;

    try {
      expect(getReleaseIdentity()).toEqual({
        commit: 'a'.repeat(40),
        version: '0.0.1',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
