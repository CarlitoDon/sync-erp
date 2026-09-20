import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Test-only env bootstrap: the shared barrel transitively imports
// `@sync-erp/database`, whose client resolves `.env.test` relative to
// `process.cwd()` and throws under NODE_ENV=test when DATABASE_URL is
// missing. Load the database env files here so shared suites pass without
// requiring callers to source env first. No DB connection is opened.
const setupDir = path.dirname(fileURLToPath(import.meta.url));

const candidateEnvFiles: string[] = [
  path.resolve(setupDir, '../../database/.env.test'),
  path.resolve(setupDir, '../../database/.env'),
];

for (const envPath of candidateEnvFiles) {
  try {
    const result = dotenv.config({ path: envPath });
    if (!result.error) break;
  } catch {
    // Ignore and try the next candidate; suites must not depend on env files existing.
  }
}
