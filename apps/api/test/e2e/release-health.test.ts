import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../src/app';

const originalManifestPath =
  process.env.SYNC_ERP_RELEASE_MANIFEST_PATH;

afterEach(() => {
  if (originalManifestPath === undefined) {
    delete process.env.SYNC_ERP_RELEASE_MANIFEST_PATH;
  } else {
    process.env.SYNC_ERP_RELEASE_MANIFEST_PATH = originalManifestPath;
  }
});

describe('release identity health endpoints', () => {
  it('preserves health fields and returns unknown identity without a manifest', async () => {
    process.env.SYNC_ERP_RELEASE_MANIFEST_PATH = path.join(
      os.tmpdir(),
      'sync-erp-release-manifest-does-not-exist.json'
    );

    const app = createApp();
    const apiHealth = await request(app).get('/health');
    const mcpHealth = await request(app).get('/mcp/health');

    expect(apiHealth.status).toBe(200);
    expect(apiHealth.body.status).toBe('ok');
    expect(apiHealth.body).toHaveProperty('timestamp');
    expect(apiHealth.body.release).toEqual({
      commit: 'unknown',
      version: 'unknown',
    });
    expect(mcpHealth.status).toBe(200);
    expect(mcpHealth.body.release).toEqual(apiHealth.body.release);
  });

  it('returns manifest identity from API and MCP health endpoints', async () => {
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
      const app = createApp();
      const apiHealth = await request(app).get('/health');
      const mcpHealth = await request(app).get('/mcp/health');

      expect(apiHealth.body.release).toEqual({
        commit: 'a'.repeat(40),
        version: '0.0.1',
      });
      expect(mcpHealth.body.release).toEqual(apiHealth.body.release);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
