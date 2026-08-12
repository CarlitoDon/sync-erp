import { beforeEach, describe, expect, it } from 'vitest';
import { mockPrisma } from './mocks/prisma.mock';

describe('getReadiness', () => {
  beforeEach(() => {
    vi.resetModules();
    mockPrisma.$queryRaw.mockReset();
  });

  it('is ready when the database probe succeeds and identifies MCP as external', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const { getReadiness } = await import('../../src/readiness');

    await expect(getReadiness()).resolves.toEqual({
      ready: true,
      dependencies: { database: 'ok', mcp: 'external' },
    });
  });

  it('fails closed when the database probe fails', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    const { getReadiness } = await import('../../src/readiness');

    await expect(getReadiness()).resolves.toEqual({
      ready: false,
      dependencies: { database: 'unavailable', mcp: 'external' },
    });
  });
});
