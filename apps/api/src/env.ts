import dotenv from 'dotenv';
import path from 'path';

// Use process.cwd() for bundled CJS output - it runs from api root directory
const appDir = process.cwd();

// Determine environment and load appropriate .env file
// Railway sets NODE_ENV=production for ALL environments, so we check HOSTINGER_ENV first
// Priority: HOSTINGER_ENV > NODE_ENV
function getEnvFile(): string {
  const hostingerEnv = process.env.HOSTINGER_ENV; // 'staging' or 'production' on Hostinger
  const nodeEnv = process.env.NODE_ENV;

  // Railway environment takes precedence
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
console.log(`[API] Loading ${envFile} from ${pkgEnvPath}`);

let result = dotenv.config({ path: pkgEnvPath });

if (result.error) {
  // Fallback to generic .env if specific file not found
  const fallbackPath = path.resolve(appDir, '.env');
  // eslint-disable-next-line no-console -- Startup log for deployment debugging
  console.log(`[API] Fallback to ${fallbackPath}`);
  result = dotenv.config({ path: fallbackPath });
  if (result.error) {
    // eslint-disable-next-line no-console -- Warning for missing env file
    console.warn(
      `[API] Failed to load environment from ${pkgEnvPath}`
    );
  }
}
