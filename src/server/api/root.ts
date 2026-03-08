import { router } from "./trpc";
import { tracesRouter } from "./routers/traces";
import { observationsRouter } from "./routers/observations";
import { settingsRouter } from "./routers/settings";

export const appRouter = router({
  traces: tracesRouter,
  observations: observationsRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
