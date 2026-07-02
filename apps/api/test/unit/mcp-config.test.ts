import { beforeEach, describe, expect, it, vi } from 'vitest';

async function importConfig() {
  vi.resetModules();
  return import('../../src/modules/mcp/config');
}

describe('mcp runtime config', () => {
  beforeEach(() => {
    delete process.env.SYNC_ERP_MCP_BEARER_TOKEN;
    delete process.env.SYNC_ERP_MCP_BEARER_TOKENS;
    delete process.env.SYNC_ERP_MCP_MAX_SESSIONS;
    delete process.env.SYNC_ERP_MCP_SESSION_TTL_MS;
  });

  it('treats missing or blank bearer token env as disabled', async () => {
    let config = await importConfig();
    expect(config.isMcpEnabled()).toBe(false);

    process.env.SYNC_ERP_MCP_BEARER_TOKENS = ' , ';
    config = await importConfig();
    expect(config.isMcpEnabled()).toBe(false);
  });

  it('parses comma-separated bearer tokens after trimming', async () => {
    process.env.SYNC_ERP_MCP_BEARER_TOKENS =
      ' 1234567890abcdef , abcdef1234567890 ';

    const { getMcpRuntimeConfig, isMcpEnabled } = await importConfig();

    expect(isMcpEnabled()).toBe(true);
    expect(getMcpRuntimeConfig().bearerTokens).toEqual([
      '1234567890abcdef',
      'abcdef1234567890',
    ]);
  });
});
