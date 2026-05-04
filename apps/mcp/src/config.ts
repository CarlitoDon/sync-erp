/**
 * MCP Server Configuration
 *
 * Reads environment variables for API connection. No hardcoded credentials.
 */
import { z } from 'zod';

const ConfigSchema = z.object({
  apiUrl: z.string().url().default('http://localhost:3001/api/trpc'),
  email: z.string().email(),
  password: z.string().min(1),
});

export type Config = z.infer<typeof ConfigSchema>;

let cachedConfig: Config | null = null;

function loadConfig(): Config {
  const raw: unknown = {
    apiUrl:
      process.env.SYNC_ERP_MCP_API_URL ??
      process.env.SYNC_ERP_API_URL ??
      'http://localhost:3001/api/trpc',
    email:
      process.env.SYNC_ERP_MCP_EMAIL ??
      process.env.SYNC_ERP_EMAIL,
    password:
      process.env.SYNC_ERP_MCP_PASSWORD ??
      process.env.SYNC_ERP_PASSWORD,
  };

  const parsed = ConfigSchema.safeParse(raw);

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => i.path.join('.'))
      .join(', ');
    throw new Error(
      `MCP Config Error: Missing or invalid env vars (${missing}). ` +
        'Required: SYNC_ERP_MCP_EMAIL/SYNC_ERP_EMAIL and ' +
        'SYNC_ERP_MCP_PASSWORD/SYNC_ERP_PASSWORD. ' +
        'Optional: SYNC_ERP_MCP_API_URL/SYNC_ERP_API_URL ' +
        '(default: http://localhost:3001/api/trpc)'
    );
  }

  return parsed.data;
}

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }

  return cachedConfig;
}
