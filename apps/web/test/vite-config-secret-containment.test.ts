import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { TextEncoder as NodeTextEncoder } from 'node:util';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SERVER_ENV_NAMES = [
  'SYNC_ERP_API_SECRET',
  'SYNC_ERP_BOT_SECRET',
  'SYNC_ERP_API_URL',
  'SYNC_ERP_BOT_URL',
] as const;
const SECRET_SENTINEL = 'vite-config-test-only-secret';
const PUBLIC_SENTINEL = 'vite-config-test-only-public-value';

async function loadWebViteConfig() {
  // jsdom installs a realm-local TextEncoder; esbuild requires Node's
  // Uint8Array-compatible implementation when the config is loaded.
  const nodeUint8Array = new NodeTextEncoder().encode('').constructor;
  Object.defineProperty(globalThis, 'TextEncoder', {
    configurable: true,
    value: NodeTextEncoder,
  });
  Object.defineProperty(globalThis, 'Uint8Array', {
    configurable: true,
    value: nodeUint8Array,
  });

  return import('../vite.config');
}

async function readEmittedFiles(
  directory: string
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        return readEmittedFiles(entryPath);
      }

      // Scan every emitted file type. A secret in an asset or manifest must
      // fail the containment check just as a secret in JavaScript must.
      return [
        `${entryPath}\n${(await readFile(entryPath)).toString('utf8')}`,
      ];
    })
  );

  return contents.flat();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Vite browser-secret containment', () => {
  it('exposes only the public VITE_* prefix through the config', async () => {
    for (const name of SERVER_ENV_NAMES) {
      vi.stubEnv(name, SECRET_SENTINEL);
    }

    const { createWebViteConfig, VITE_ENV_PREFIX } =
      await loadWebViteConfig();
    const config = createWebViteConfig({
      command: 'build',
      mode: 'production',
    });
    const define = config.define as Record<string, unknown>;

    expect(config.envPrefix).toBe(VITE_ENV_PREFIX);
    expect(Object.keys(define)).toEqual(['process.env.NODE_ENV']);
    for (const name of SERVER_ENV_NAMES) {
      expect(define).not.toHaveProperty(`process.env.${name}`);
    }
    expect(JSON.stringify(define)).not.toContain(SECRET_SENTINEL);
    const configText = JSON.stringify({
      envPrefix: config.envPrefix,
      define,
    });
    for (const name of SERVER_ENV_NAMES) {
      expect(configText).not.toContain(name);
    }
  });

  it('keeps a server secret out of emitted build code', async () => {
    for (const name of SERVER_ENV_NAMES) {
      vi.stubEnv(name, SECRET_SENTINEL);
    }
    vi.stubEnv('VITE_CONFIG_TEST_VALUE', PUBLIC_SENTINEL);

    const { createWebViteConfig } = await loadWebViteConfig();

    const root = await mkdtemp(
      join(tmpdir(), 'sync-erp-vite-secret-containment-')
    );
    const outputDirectory = join(root, 'dist');

    try {
      await writeFile(
        join(root, 'entry.js'),
        `console.log(import.meta.env.VITE_CONFIG_TEST_VALUE);\n${SERVER_ENV_NAMES.map((name) => `console.log(process.env.${name});`).join('\n')}\n`
      );

      const config = createWebViteConfig({
        command: 'build',
        mode: 'production',
      });
      const { build } = await import('vite');

      await build({
        ...config,
        configFile: false,
        root,
        logLevel: 'silent',
        build: {
          ...config.build,
          outDir: outputDirectory,
          emptyOutDir: true,
          sourcemap: false,
          rollupOptions: {
            input: join(root, 'entry.js'),
          },
        },
      });

      const emittedCode = (
        await readEmittedFiles(outputDirectory)
      ).join('\n');

      expect(emittedCode).toContain(PUBLIC_SENTINEL);
      expect(emittedCode).not.toContain(SECRET_SENTINEL);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
