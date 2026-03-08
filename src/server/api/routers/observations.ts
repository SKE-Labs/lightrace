import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const observationsRouter = router({
  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const observation = await ctx.db.observation.findUnique({
      where: { id: input.id },
      include: { scores: true },
    });
    return observation;
  }),
});
