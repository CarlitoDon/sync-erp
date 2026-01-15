import { router } from "./trpc";
import { botRouter } from "./routers/bot.router";

export const appRouter = router({
  bot: botRouter,
});

export type AppRouter = typeof appRouter;
