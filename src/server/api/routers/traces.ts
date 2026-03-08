import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const tracesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().nullish(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, search } = input;

      const traces = await ctx.db.trace.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { timestamp: "desc" },
        where: search
          ? {
              name: { contains: search, mode: "insensitive" },
            }
          : undefined,
        include: {
          _count: { select: { observations: true, scores: true } },
          observations: {
            select: {
              promptTokens: true,
              completionTokens: true,
              totalTokens: true,
              startTime: true,
              endTime: true,
              type: true,
              inputCost: true,
              outputCost: true,
              totalCost: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (traces.length > limit) {
        const nextItem = traces.pop();
        nextCursor = nextItem?.id;
      }

      const items = traces.map((trace) => {
        const totalTokens = trace.observations.reduce((sum, o) => sum + o.totalTokens, 0);
        const promptTokens = trace.observations.reduce((sum, o) => sum + o.promptTokens, 0);
        const completionTokens = trace.observations.reduce((sum, o) => sum + o.completionTokens, 0);
        const totalCost = trace.observations.reduce((sum, o) => sum + (o.totalCost ?? 0), 0);

        const times = trace.observations
          .map((o) => o.startTime.getTime())
          .concat(trace.observations.filter((o) => o.endTime).map((o) => o.endTime!.getTime()));
        const minTime = times.length > 0 ? Math.min(...times) : trace.timestamp.getTime();
        const maxTime = times.length > 0 ? Math.max(...times) : trace.timestamp.getTime();
        const latencyMs = maxTime - minTime;

        return {
          id: trace.id,
          name: trace.name,
          timestamp: trace.timestamp,
          tags: trace.tags,
          observationCount: trace._count.observations,
          scoreCount: trace._count.scores,
          totalTokens,
          promptTokens,
          completionTokens,
          totalCost: totalCost > 0 ? totalCost : null,
          latencyMs,
        };
      });

      return { items, nextCursor };
    }),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const trace = await ctx.db.trace.findUnique({
      where: { id: input.id },
      include: {
        observations: {
          orderBy: { startTime: "asc" },
        },
        scores: true,
      },
    });

    if (!trace) {
      return null;
    }

    return trace;
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.trace.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
