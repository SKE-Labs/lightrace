import { z } from "zod";
import { router, protectedProcedure } from "../context";

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
          _count: { select: { observations: true } },
          observations: {
            select: {
              totalTokens: true,
              startTime: true,
              endTime: true,
              type: true,
              totalCost: true,
              level: true,
              model: true,
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
        const totalCost = trace.observations.reduce((sum, o) => sum + Number(o.totalCost ?? 0), 0);

        const times = trace.observations
          .map((o) => o.startTime.getTime())
          .concat(trace.observations.filter((o) => o.endTime).map((o) => o.endTime!.getTime()));
        const minTime = times.length > 0 ? Math.min(...times) : trace.timestamp.getTime();
        const maxTime = times.length > 0 ? Math.max(...times) : trace.timestamp.getTime();
        const latencyMs = maxTime - minTime;

        const hasError = trace.observations.some((o) => o.level === "ERROR");
        const hasWarning = !hasError && trace.observations.some((o) => o.level === "WARNING");
        const primaryModel =
          trace.observations.find((o) => o.type === "GENERATION" && o.model)?.model ?? null;

        return {
          id: trace.id,
          name: trace.name,
          timestamp: trace.timestamp,
          tags: trace.tags,
          observationCount: trace._count.observations,
          totalTokens,
          totalCost: totalCost > 0 ? totalCost : null,
          latencyMs,
          hasError,
          hasWarning,
          primaryModel,
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
