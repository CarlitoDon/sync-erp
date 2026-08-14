import { prisma } from '@sync-erp/database';

export type DependencyReadiness = 'ok' | 'unavailable' | 'external';

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

  // Staging serves MCP as a separately deployed process. Its authenticated
  // protocol readiness is verified by deploy-mcp-hostinger.yml, not by the
  // optional in-process API MCP router configuration.
  const mcp: DependencyReadiness = 'external';

  return {
    ready: database === 'ok',
    dependencies: { database, mcp },
  };
}
