import { router, publicProcedure } from '../trpc';

export const healthRouter = router({
  /**
   * Health check endpoint
   */
  check: publicProcedure.query(() => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '0.0.1',
    };
  }),
});

export type HealthRouter = typeof healthRouter;
