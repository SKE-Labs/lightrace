import { router } from "./context";
import { tracesRouter } from "./routers/traces";
import { observationsRouter } from "./routers/observations";
import { settingsRouter } from "./routers/settings";
import { realtimeRouter } from "./routers/realtime";

export const appRouter = router({
  traces: tracesRouter,
  observations: observationsRouter,
  settings: settingsRouter,
  realtime: realtimeRouter,
});

export type AppRouter = typeof appRouter;
