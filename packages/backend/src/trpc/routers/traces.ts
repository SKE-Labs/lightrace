import { z } from "zod";
import type { ObservationLevel } from "@prisma/client";
import { router, projectProcedure, projectAdminProcedure } from "../context";

const traceItemSelect = {
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
} as const;

type RawTrace = {
  id: string;
  name: string | null;
  timestamp: Date;
  tags: string[];
  totalTokens: number;
  totalCost: number | null;
  latencyMs: number | null;
  primaryModel: string | null;
  observationCount: number;
  level: ObservationLevel;
  isFork: boolean;
};

function shapeTraceItem(trace: RawTrace, forkCount: number) {
  return {
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
    forkCount,
  };
}

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

      // Root traces only — forks are nested under their parent below.
      const where = {
        projectId: ctx.projectId,
        isFork: false,
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      };

      const [parents, totalCount] = await Promise.all([
        ctx.db.trace.findMany({
          take: limit,
          skip,
          orderBy: { timestamp: "desc" },
          where,
          select: {
            ...traceItemSelect,
            // Cap nested forks: the UI only shows them inline; deeper exploration
            // happens on the trace detail page.
            sourceForks: {
              take: 10,
              orderBy: { createdAt: "desc" },
              select: {
                forkedTrace: { select: traceItemSelect },
              },
            },
          },
        }),
        ctx.db.trace.count({ where }),
      ]);

      const items = parents.map((parent) => {
        const forks = parent.sourceForks.map((sf) => shapeTraceItem(sf.forkedTrace, 0));
        return {
          ...shapeTraceItem(parent, forks.length),
          forks,
        };
      });

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
