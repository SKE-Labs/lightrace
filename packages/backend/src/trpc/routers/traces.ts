import { z } from "zod";
import { router, projectProcedure, projectAdminProcedure } from "../context";

export const tracesRouter = router({
  list: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        page: z.number().min(1).default(1),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, page, search } = input;
      const skip = (page - 1) * limit;

      const where = {
        projectId: ctx.projectId,
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      };

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
            isFork: true,
          },
        }),
        ctx.db.trace.count({ where }),
      ]);

      // Batch-load fork status for the page of traces
      const traceIds = traces.map((t) => t.id);
      const forkRecords =
        traceIds.length > 0
          ? await ctx.db.traceFork.findMany({
              where: { sourceTraceId: { in: traceIds } },
              select: { sourceTraceId: true },
            })
          : [];

      // Build fork count map: sourceTraceId → number of forks
      const forkCountMap = new Map<string, number>();
      for (const r of forkRecords) {
        forkCountMap.set(r.sourceTraceId, (forkCountMap.get(r.sourceTraceId) ?? 0) + 1);
      }

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
        isFork: trace.isFork,
        forkCount: forkCountMap.get(trace.id) ?? 0,
      }));

      return {
        items,
        totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
      };
    }),

  byId: projectProcedure
    .input(z.object({ projectId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const trace = await ctx.db.trace.findUnique({
        where: { id: input.id },
        include: {
          observations: {
            orderBy: { startTime: "asc" },
          },
        },
      });

      if (!trace || trace.projectId !== ctx.projectId) {
        return null;
      }

      // Fetch fork metadata in parallel
      const [forkedFrom, forks] = await Promise.all([
        ctx.db.traceFork.findUnique({ where: { forkedTraceId: input.id } }),
        ctx.db.traceFork.findMany({
          where: { sourceTraceId: input.id },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return { ...trace, forkedFrom, forks };
    }),

  delete: projectAdminProcedure
    .input(z.object({ projectId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.trace.deleteMany({
        where: { id: input.id, projectId: ctx.projectId },
      });
      return { success: true };
    }),
});
