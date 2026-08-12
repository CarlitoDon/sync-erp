import { prisma } from '@sync-erp/database';
import { isMcpEnabled } from './modules/mcp/config';

export type DependencyReadiness = 'ok' | 'unavailable' | 'disabled';

export interface ReadinessResult {
  ready: boolean;
  dependencies: {
    database: DependencyReadiness;
    mcp: DependencyReadiness;
  };
}

/**
 * Runs only non-mutating dependency probes.  Keep this separate from the
 * liveness endpoint: a process can be alive while it cannot safely serve
 * requests.
 */
export async function getReadiness(): Promise<ReadinessResult> {
  let database: DependencyReadiness = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'unavailable';
  }

  const mcp: DependencyReadiness = isMcpEnabled() ? 'ok' : 'disabled';

  return {
    ready: database === 'ok' && mcp === 'ok',
    dependencies: { database, mcp },
  };
}
