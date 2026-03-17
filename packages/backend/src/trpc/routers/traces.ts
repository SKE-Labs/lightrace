import { z } from "zod";
import { router, protectedProcedure } from "../context";

export const tracesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        page: z.number().min(1).default(1),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, page, search } = input;
      const skip = (page - 1) * limit;

      const where = search ? { name: { contains: search, mode: "insensitive" as const } } : {};

      const [traces, totalCount] = await Promise.all([
        ctx.db.trace.findMany({
          take: limit,
          skip,
          orderBy: { timestamp: "desc" },
          where,
          select: {
            id: true,
            name: true,
            timestamp: true,
            tags: true,
            totalTokens: true,
            totalCost: true,
            latencyMs: true,
            primaryModel: true,
            observationCount: true,
            level: true,
          },
        }),
        ctx.db.trace.count({ where }),
      ]);

      const items = traces.map((trace) => ({
        id: trace.id,
        name: trace.name,
        timestamp: trace.timestamp,
        tags: trace.tags,
        observationCount: trace.observationCount,
        totalTokens: trace.totalTokens,
        totalCost: trace.totalCost && trace.totalCost > 0 ? trace.totalCost : null,
        latencyMs: trace.latencyMs ?? 0,
        hasError: trace.level === "ERROR",
        hasWarning: trace.level === "WARNING",
        primaryModel: trace.primaryModel,
      }));

      return {
        items,
        totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
      };
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
