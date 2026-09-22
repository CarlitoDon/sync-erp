import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getEnvFile(): string {
  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv === 'test' || process.env.VITEST) return '.env.test';
  if (nodeEnv === 'staging') return '.env.staging';
  if (nodeEnv === 'production') return '.env.production';

  return '.env';
}

const envFile = getEnvFile();
const pkgEnvPath = path.resolve(__dirname, `../${envFile}`);

dotenv.config({ path: pkgEnvPath });

// Fallback to generic .env in package
const fallbackPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: fallbackPath });

// Fallback to root .env
const rootEnvPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: rootEnvPath });
