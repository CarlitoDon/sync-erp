import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getReleaseIdentity } from '../src/release-identity.js';

const originalManifestPath =
  process.env.SYNC_ERP_RELEASE_MANIFEST_PATH;

afterEach(() => {
  if (originalManifestPath === undefined) {
    delete process.env.SYNC_ERP_RELEASE_MANIFEST_PATH;
  } else {
    process.env.SYNC_ERP_RELEASE_MANIFEST_PATH = originalManifestPath;
  }
});

describe('MCP release identity', () => {
  it('returns explicit unknown values without a manifest', () => {
    process.env.SYNC_ERP_RELEASE_MANIFEST_PATH = path.join(
      os.tmpdir(),
      'sync-erp-mcp-release-manifest-does-not-exist.json'
    );

    expect(getReleaseIdentity()).toEqual({
      commit: 'unknown',
      version: 'unknown',
    });
  });

  it('loads the release commit and version from release.json', async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), 'sync-erp-mcp-release-health-')
    );
    const manifestPath = path.join(directory, 'release.json');
    await writeFile(
      manifestPath,
      JSON.stringify({
        schemaVersion: 1,
        service: 'sync-erp-mcp',
        commit: 'b'.repeat(40),
        version: '1.0.0',
      })
    );
    process.env.SYNC_ERP_RELEASE_MANIFEST_PATH = manifestPath;

    try {
      expect(getReleaseIdentity()).toEqual({
        commit: 'b'.repeat(40),
        version: '1.0.0',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
