import { z } from "zod";
import { router, projectProcedure } from "../context";

export const observationsRouter = router({
  byId: projectProcedure
    .input(z.object({ projectId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const observation = await ctx.db.observation.findUnique({
        where: { id: input.id },
      });
      if (!observation || observation.projectId !== ctx.projectId) return null;
      return observation;
    }),
});
