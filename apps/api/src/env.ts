import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine environment and load appropriate .env file
// Railway sets NODE_ENV=production for ALL environments, so we check RAILWAY_ENVIRONMENT first
// Priority: RAILWAY_ENVIRONMENT > NODE_ENV
function getEnvFile(): string {
  const railwayEnv = process.env.RAILWAY_ENVIRONMENT; // 'staging' or 'production' on Railway
  const nodeEnv = process.env.NODE_ENV;

  // Railway environment takes precedence
  if (railwayEnv === 'staging') return '.env.staging';
  if (railwayEnv === 'production') return '.env.production';

  // Fallback to NODE_ENV for local development
  if (nodeEnv === 'test' || process.env.VITEST) return '.env.test';
  if (nodeEnv === 'staging') return '.env.staging';
  if (nodeEnv === 'production') return '.env.production';

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
