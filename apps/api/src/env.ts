import dotenv from 'dotenv';
<<<<<<< HEAD
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();
const originalEnvKeys = new Set(Object.keys(process.env));
=======
import path from 'path';

// Use process.cwd() for bundled CJS output - it runs from api root directory
const appDir = process.cwd();
>>>>>>> origin/dev

// Determine environment and load appropriate .env file
// Railway sets NODE_ENV=production for ALL environments, so we check HOSTINGER_ENV first
// Priority: HOSTINGER_ENV > NODE_ENV
<<<<<<< HEAD
function getEnvMode(): 'development' | 'test' | 'staging' | 'production' {
=======
function getEnvFile(): string {
>>>>>>> origin/dev
  const hostingerEnv = process.env.HOSTINGER_ENV; // 'staging' or 'production' on Hostinger
  const nodeEnv = process.env.NODE_ENV;

  // Railway environment takes precedence
<<<<<<< HEAD
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
=======
  if (hostingerEnv === 'staging') return '.env.staging';
  if (hostingerEnv === 'production') return '.env.production';

  // Fallback to NODE_ENV for local development
  if (nodeEnv === 'test' || process.env.VITEST) return '.env.test';
  if (nodeEnv === 'staging') return '.env.staging';
  if (nodeEnv === 'production') return '.env.production';

  return '.env';
}

const envFile = getEnvFile();
const pkgEnvPath = path.resolve(appDir, envFile);

// eslint-disable-next-line no-console -- Startup log for deployment debugging
if (!process.env.VITEST) console.log(`[API] Loading ${envFile} from ${pkgEnvPath}`);

let result = dotenv.config({ path: pkgEnvPath });

if (result.error) {
  // Fallback to generic .env if specific file not found
  const fallbackPath = path.resolve(appDir, '.env');
  // eslint-disable-next-line no-console -- Fallback attempt
  console.log(`[API] Fallback to ${fallbackPath}`);
  result = dotenv.config({ path: fallbackPath });
  if (result.error && !process.env.VITEST) {
    // eslint-disable-next-line no-console -- Warning for missing env file
    console.warn(
      `[API] Failed to load environment from ${pkgEnvPath}`
    );
  }
>>>>>>> origin/dev
}
