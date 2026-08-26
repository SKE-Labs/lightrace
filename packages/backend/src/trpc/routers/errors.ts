import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { router, projectProcedure } from "../context";

export const errorsRouter = router({
  list: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        page: z.number().min(1).default(1),
        search: z.string().optional(),
        status: z
          .enum(["UNRESOLVED", "RESOLVED", "ARCHIVED", "ESCALATING", "REGRESSED", "FOR_REVIEW"])
          .optional(),
        type: z.enum(["TOOL", "GENERATION", "SPAN", "CHAIN", "EVENT"]).optional(),
        toolName: z.string().optional(),
        sortBy: z.enum(["lastSeen", "firstSeen", "count", "traceCount"]).default("lastSeen"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, page, search, status, type, toolName, sortBy, sortOrder } = input;
      const skip = (page - 1) * limit;

      const where: Prisma.ErrorIssueWhereInput = {
        projectId: ctx.projectId,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
        ...(toolName ? { toolName } : {}),
        ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
      };

      const orderBy: Prisma.ErrorIssueOrderByWithRelationInput = {
        [sortBy]: sortOrder,
      } as Prisma.ErrorIssueOrderByWithRelationInput;

      const [items, totalCount] = await Promise.all([
        ctx.db.errorIssue.findMany({
          where,
          orderBy,
          skip,
          take: limit,
        }),
        ctx.db.errorIssue.count({ where }),
      ]);

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
      const issue = await ctx.db.errorIssue.findUnique({
        where: { id: input.id },
      });
      if (!issue || issue.projectId !== ctx.projectId) return null;

      const recentEvents = await ctx.db.errorEvent.findMany({
        where: { issueId: issue.id },
        orderBy: { timestamp: "desc" },
        take: 10,
        include: { observation: true, trace: { select: { id: true, name: true } } },
      });

      // Facet map: distribution of type/toolName for this issue's project? For now per-issue stats by type
      // For MVP, return issue with recentEvents
      return { ...issue, recentEvents };
    }),

  events: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        issueId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        page: z.number().min(1).default(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { issueId, limit, page } = input;
      const skip = (page - 1) * limit;

      // Verify issue belongs to project
      const issue = await ctx.db.errorIssue.findUnique({ where: { id: issueId } });
      if (!issue || issue.projectId !== ctx.projectId) {
        return { items: [], totalCount: 0, page, totalPages: 0 };
      }

      const where = { issueId, projectId: ctx.projectId };
      const [items, totalCount] = await Promise.all([
        ctx.db.errorEvent.findMany({
          where,
          orderBy: { timestamp: "desc" },
          skip,
          take: limit,
          include: { observation: true, trace: { select: { id: true, name: true } } },
        }),
        ctx.db.errorEvent.count({ where }),
      ]);

      return {
        items,
        totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
      };
    }),

  update: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
        status: z
          .enum(["UNRESOLVED", "RESOLVED", "ARCHIVED", "ESCALATING", "REGRESSED", "FOR_REVIEW"])
          .optional(),
        priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
        assigneeId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const issue = await ctx.db.errorIssue.findUnique({ where: { id: input.id } });
      if (!issue || issue.projectId !== ctx.projectId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      if (input.assigneeId !== undefined && input.assigneeId !== null) {
        const assignee = await ctx.db.user.findUnique({ where: { id: input.assigneeId } });
        if (!assignee) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Assignee not found" });
        }
        const membership = await ctx.db.projectMembership.findUnique({
          where: { userId_projectId: { userId: input.assigneeId, projectId: ctx.projectId } },
        });
        if (!membership) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Assignee not a member of this project",
          });
        }
      }

      const data: Prisma.ErrorIssueUpdateInput = {};
      if (input.status !== undefined) data.status = input.status;
      if (input.priority !== undefined) data.priority = input.priority;
      if (input.assigneeId !== undefined) {
        if (input.assigneeId === null) {
          data.assignee = { disconnect: true };
        } else {
          data.assignee = { connect: { id: input.assigneeId } };
        }
      }

      const updated = await ctx.db.errorIssue.update({
        where: { id: input.id },
        data,
      });
      return updated;
    }),

  stats: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        groupBy: z.enum(["type", "toolName", "status", "priority"]),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { groupBy } = input;

      if (groupBy === "type") {
        const groups = await ctx.db.errorIssue.groupBy({
          by: ["type"],
          where: { projectId: ctx.projectId },
          _sum: { count: true },
        });
        return groups.map((g) => ({ key: g.type, count: g._sum.count ?? 0 }));
      }
      if (groupBy === "toolName") {
        const groups = await ctx.db.errorIssue.groupBy({
          by: ["toolName"],
          where: { projectId: ctx.projectId },
          _sum: { count: true },
        });
        return groups.map((g) => ({ key: g.toolName ?? "unknown", count: g._sum.count ?? 0 }));
      }
      if (groupBy === "status") {
        const groups = await ctx.db.errorIssue.groupBy({
          by: ["status"],
          where: { projectId: ctx.projectId },
          _sum: { count: true },
        });
        return groups.map((g) => ({ key: g.status, count: g._sum.count ?? 0 }));
      }
      // priority
      const groups = await ctx.db.errorIssue.groupBy({
        by: ["priority"],
        where: { projectId: ctx.projectId },
        _sum: { count: true },
      });
      return groups.map((g) => ({ key: g.priority, count: g._sum.count ?? 0 }));
    }),
});
