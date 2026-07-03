import { z } from 'zod';

const McpRuntimeConfigSchema = z.object({
  bearerTokens: z.array(z.string().min(16)).min(1),
  maxSessions: z.number().int().positive().default(50),
  sessionTtlMs: z.number().int().positive().default(15 * 60 * 1000),
});

export type McpRuntimeConfig = z.infer<typeof McpRuntimeConfigSchema>;

let cachedConfig: McpRuntimeConfig | null = null;

<<<<<<< HEAD
function getBearerTokensFromEnv(): string[] {
  const bearerTokenList =
    process.env.SYNC_ERP_MCP_BEARER_TOKENS ||
    process.env.SYNC_ERP_MCP_BEARER_TOKEN ||
    '';

  return bearerTokenList
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
}

export function isMcpEnabled(): boolean {
  return getBearerTokensFromEnv().length > 0;
=======
export function isMcpEnabled(): boolean {
  return Boolean(
    process.env.SYNC_ERP_MCP_BEARER_TOKEN ||
      process.env.SYNC_ERP_MCP_BEARER_TOKENS
  );
>>>>>>> origin/dev
}

export function getMcpRuntimeConfig(): McpRuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

<<<<<<< HEAD
  const rawConfig = {
    bearerTokens: getBearerTokensFromEnv(),
=======
  const bearerTokenList =
    process.env.SYNC_ERP_MCP_BEARER_TOKENS ||
    process.env.SYNC_ERP_MCP_BEARER_TOKEN ||
    '';

  const rawConfig = {
    bearerTokens: bearerTokenList
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean),
>>>>>>> origin/dev
    maxSessions: Number(process.env.SYNC_ERP_MCP_MAX_SESSIONS || 50),
    sessionTtlMs: Number(
      process.env.SYNC_ERP_MCP_SESSION_TTL_MS || 15 * 60 * 1000
    ),
  };

  const parsed = McpRuntimeConfigSchema.safeParse(rawConfig);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid MCP runtime config: ${message}`);
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}
