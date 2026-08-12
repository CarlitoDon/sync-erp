import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPrisma } from './mocks/prisma.mock';

const isMcpEnabled = vi.fn();

vi.mock('../../src/modules/mcp/config', () => ({ isMcpEnabled }));

describe('getReadiness', () => {
  beforeEach(() => {
    vi.resetModules();
    mockPrisma.$queryRaw.mockReset();
    isMcpEnabled.mockReset();
  });

  it('is ready only when database and MCP are available', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    isMcpEnabled.mockReturnValue(true);

    const { getReadiness } = await import('../../src/readiness');

    await expect(getReadiness()).resolves.toEqual({
      ready: true,
      dependencies: { database: 'ok', mcp: 'ok' },
    });
  });

  it('fails closed when the database probe fails', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    isMcpEnabled.mockReturnValue(true);

    const { getReadiness } = await import('../../src/readiness');

    await expect(getReadiness()).resolves.toEqual({
      ready: false,
      dependencies: { database: 'unavailable', mcp: 'ok' },
    });
  });

  it('fails closed when MCP is disabled', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    isMcpEnabled.mockReturnValue(false);

    const { getReadiness } = await import('../../src/readiness');

    await expect(getReadiness()).resolves.toEqual({
      ready: false,
      dependencies: { database: 'ok', mcp: 'disabled' },
    });
  });
});
