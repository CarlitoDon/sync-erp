import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { MapsService } from '../../modules/maps/maps.service';

const mapsService = new MapsService();

export const mapsRouter = router({
  extractFromUrl: protectedProcedure
    .input(z.object({ url: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return mapsService.extractAddressFromUrl(input.url);
    }),

  reverseGeocode: protectedProcedure
    .input(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
      })
    )
    .query(async ({ input }) => {
      return mapsService.reverseGeocode(input.latitude, input.longitude);
    }),

  searchPlaces: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      return mapsService.searchPlaces(input.query);
    }),
});

export type MapsRouter = typeof mapsRouter;
