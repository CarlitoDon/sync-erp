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

<<<<<<< HEAD
const HttpRuntimeConfigSchema = z.object({
  bearerTokens: z.array(z.string().min(16)),
  maxSessions: z.number().int().positive().default(50),
  sessionTtlMs: z.number().int().positive().default(15 * 60 * 1000),
});

export type HttpRuntimeConfig = z.infer<typeof HttpRuntimeConfigSchema>;

let cachedConfig: Config | null = null;
let cachedHttpRuntimeConfig: HttpRuntimeConfig | null = null;
=======
let cachedConfig: Config | null = null;
>>>>>>> origin/dev

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
<<<<<<< HEAD

export function getHttpRuntimeConfig(): HttpRuntimeConfig {
  if (cachedHttpRuntimeConfig) {
    return cachedHttpRuntimeConfig;
  }

  const bearerTokenList =
    process.env.SYNC_ERP_MCP_BEARER_TOKENS ??
    process.env.SYNC_ERP_MCP_BEARER_TOKEN ??
    process.env.MCP_BEARER_TOKEN ??
    '';

  const rawConfig = {
    bearerTokens: bearerTokenList
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean),
    maxSessions: Number(process.env.SYNC_ERP_MCP_MAX_SESSIONS ?? 50),
    sessionTtlMs: Number(
      process.env.SYNC_ERP_MCP_SESSION_TTL_MS ?? 15 * 60 * 1000
    ),
  };

  const parsed = HttpRuntimeConfigSchema.safeParse(rawConfig);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid MCP HTTP runtime config: ${message}`);
  }

  cachedHttpRuntimeConfig = parsed.data;
  return cachedHttpRuntimeConfig;
}

export function isHttpMcpEnabled(): boolean {
  return getHttpRuntimeConfig().bearerTokens.length > 0;
}
=======
>>>>>>> origin/dev
