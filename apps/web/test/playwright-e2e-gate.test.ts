import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import playwrightConfig from '../playwright.config';

interface PackageManifest {
  name?: string;
  scripts?: Record<string, string>;
}

function readPackageManifest(candidateRoot: string): PackageManifest | undefined {
  const packagePath = resolve(candidateRoot, 'package.json');

  if (!existsSync(packagePath)) {
    return undefined;
  }

  try {
    return JSON.parse(readFileSync(packagePath, 'utf8')) as PackageManifest;
  } catch {
    return undefined;
  }
}

function findWebRoot(startDirectory: string): string {
  let currentDirectory = resolve(startDirectory);

  while (true) {
    for (const candidateRoot of [
      currentDirectory,
      resolve(currentDirectory, 'apps/web'),
    ]) {
      if (readPackageManifest(candidateRoot)?.name === '@sync-erp/web') {
        return candidateRoot;
      }
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      throw new Error('Unable to locate the @sync-erp/web package root');
    }
    currentDirectory = parentDirectory;
  }
}

const webRoot = findWebRoot(process.cwd());
const webPackage = JSON.parse(
  readFileSync(resolve(webRoot, 'package.json'), 'utf8')
) as PackageManifest;
const workflow = readFileSync(
  resolve(webRoot, '../../.github/workflows/e2e-playwright.yml'),
  'utf8'
);
const webGitignore = readFileSync(resolve(webRoot, '.gitignore'), 'utf8');

function isIgnored(relativePath: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '--quiet', '--no-index', relativePath], {
      cwd: webRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

describe('Playwright E2E gate', () => {
  it('discovers the tracked browser specs and starts a controlled preview server', () => {
    const e2eDirectory = resolve(webRoot, 'e2e-tests');
    const specs = readdirSync(e2eDirectory).filter((file) =>
      /\.(spec|test)\.[cm]?[jt]sx?$/.test(file)
    );
    const webServer = playwrightConfig.webServer;

    expect(playwrightConfig.testDir).toBe('./e2e-tests');
    expect(specs.length).toBeGreaterThan(0);
    expect(webServer).toMatchObject({
      command: expect.stringContaining('npm run preview'),
      url: 'http://127.0.0.1:4173',
    });
  });

  it('has a fail-closed CI invocation and uploads the configured report', () => {
    expect(webPackage.scripts?.['test:e2e']).toBe('playwright test');
    expect(workflow).toContain(
      'run: npm run test:e2e --workspace=@sync-erp/web'
    );
    expect(workflow).not.toContain('continue-on-error: true');
    expect(workflow).not.toContain('No e2e suite configured yet');
    expect(workflow).toContain('path: apps/web/.playwright-report/');
    expect(workflow).not.toContain('path: apps/web/playwright-report/');
  });

  it('keeps reports and test artifacts out of tracked fixtures', () => {
    const reporterDescriptions = Array.isArray(playwrightConfig.reporter)
      ? (playwrightConfig.reporter as unknown as Array<
          readonly [string, { outputFolder?: string }]
        >)
      : [];
    const htmlReporter = reporterDescriptions.find(([name]) => name === 'html');
    const reportFolder = htmlReporter?.[1]?.outputFolder;
    const outputDir = playwrightConfig.outputDir;

    expect(reportFolder).toBe('.playwright-report');
    expect(outputDir).toBe('.playwright-test-results');
    expect(webGitignore).toContain('/.playwright-report/');
    expect(webGitignore).toContain('/.playwright-test-results/');
    expect(webGitignore).toContain('/playwright-report/');
    expect(webGitignore).toContain('/test-results/');
    expect(isIgnored(`${reportFolder}/index.html`)).toBe(true);
    expect(isIgnored(`${outputDir}/example.trace.zip`)).toBe(true);
    expect(existsSync(resolve(webRoot, 'playwright-report/index.html'))).toBe(
      false
    );
    expect(existsSync(resolve(webRoot, 'test-results/.last-run.json'))).toBe(
      false
    );
  });
});
