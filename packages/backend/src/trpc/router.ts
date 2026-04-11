import { router } from "./context";
import { tracesRouter } from "./routers/traces";
import { observationsRouter } from "./routers/observations";
import { settingsRouter } from "./routers/settings";
import { realtimeRouter } from "./routers/realtime";
import { toolsRouter } from "./routers/tools";
import { projectsRouter } from "./routers/projects";
import { membersRouter } from "./routers/members";
import { forksRouter } from "./routers/forks";

export const appRouter = router({
  traces: tracesRouter,
  observations: observationsRouter,
  settings: settingsRouter,
  realtime: realtimeRouter,
  tools: toolsRouter,
  projects: projectsRouter,
  members: membersRouter,
  forks: forksRouter,
});

export type AppRouter = typeof appRouter;
