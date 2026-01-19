import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine environment and load appropriate .env file
// Priority: test > staging > production > development
function getEnvFile(): string {
  const isTest =
    process.env.NODE_ENV === 'test' || process.env.VITEST;
  const isStaging = process.env.NODE_ENV === 'staging';
  const isProd = process.env.NODE_ENV === 'production';

  if (isTest) return '.env.test';
  if (isStaging) return '.env.staging';
  if (isProd) return '.env.production';
  return '.env';
}

const envFile = getEnvFile();
const pkgEnvPath = path.resolve(__dirname, `../${envFile}`);

console.log(`[API] Loading ${envFile} from ${pkgEnvPath}`);

let result = dotenv.config({ path: pkgEnvPath });

if (result.error) {
  // Fallback to generic .env if specific file not found
  const fallbackPath = path.resolve(__dirname, '../.env');
  console.log(`[API] Fallback to ${fallbackPath}`);
  result = dotenv.config({ path: fallbackPath });
  if (result.error) {
    console.warn(
      `[API] Failed to load environment from ${pkgEnvPath}`
    );
  }
}
