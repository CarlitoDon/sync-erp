import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();
const originalEnvKeys = new Set(Object.keys(process.env));

// Determine environment and load appropriate .env file
// Railway sets NODE_ENV=production for ALL environments, so we check HOSTINGER_ENV first
// Priority: HOSTINGER_ENV > NODE_ENV
function getEnvMode(): 'development' | 'test' | 'staging' | 'production' {
  const hostingerEnv = process.env.HOSTINGER_ENV; // 'staging' or 'production' on Hostinger
  const nodeEnv = process.env.NODE_ENV;

  // Railway environment takes precedence
  if (hostingerEnv === 'staging') return 'staging';
  if (hostingerEnv === 'production') return 'production';

  // Fallback to NODE_ENV for local development
  if (nodeEnv === 'test' || process.env.VITEST) return 'test';
  if (nodeEnv === 'staging') return 'staging';
  if (nodeEnv === 'production') return 'production';

  return 'development';
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths.map((entry) => path.resolve(entry))));
}

const appDirs = uniquePaths([
  path.resolve(runtimeDir, '../../..'),
  cwd,
  path.resolve(cwd, 'apps/api'),
  path.resolve(runtimeDir, '..'),
]);

const envMode = getEnvMode();
const modeFile =
  envMode === 'development' ? undefined : `.env.${envMode}`;
const shouldLoadLocalOverrides = envMode === 'development';

const envFiles = [
  '.env',
  modeFile,
  shouldLoadLocalOverrides ? '.env.local' : undefined,
  shouldLoadLocalOverrides ? '.env.development.local' : undefined,
].filter((file): file is string => Boolean(file));

function loadEnvFile(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;

  const parsed = dotenv.parse(fs.readFileSync(filePath));

  for (const [key, value] of Object.entries(parsed)) {
    if (!originalEnvKeys.has(key)) {
      process.env[key] = value;
    }
  }

  return true;
}

const loadedEnvFiles: string[] = [];

for (const envFile of envFiles) {
  for (const appDir of appDirs) {
    const filePath = path.resolve(appDir, envFile);
    if (loadEnvFile(filePath)) loadedEnvFiles.push(filePath);
  }
}

if (loadedEnvFiles.length > 0) {
  // eslint-disable-next-line no-console -- Startup log for deployment debugging
  console.log(
    `[API] Loaded env files: ${loadedEnvFiles.join(', ')}`
  );
} else {
  console.warn(
    `[API] No environment file found for ${envMode} mode. Checked: ${appDirs.join(
      ', '
    )}`
  );
}
