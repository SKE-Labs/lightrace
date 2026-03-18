import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  protectedProcedure,
  projectProcedure,
  projectAdminProcedure,
  projectOwnerProcedure,
} from "../context";

export const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.projectMembership.findMany({
      where: { userId: ctx.user.id },
      include: {
        project: {
          include: {
            _count: {
              select: { memberships: true, traces: true },
            },
          },
        },
      },
      orderBy: { project: { createdAt: "desc" } },
    });

    return memberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      description: m.project.description,
      createdAt: m.project.createdAt,
      updatedAt: m.project.updatedAt,
      role: m.role,
      memberCount: m.project._count.memberships,
      traceCount: m.project._count.traces,
    }));
  }),

  byId: projectProcedure.query(async ({ ctx }) => {
    const project = await ctx.db.project.findUnique({
      where: { id: ctx.projectId },
      include: {
        _count: {
          select: { memberships: true, traces: true, apiKeys: true },
        },
      },
    });
    if (!project) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    return {
      ...project,
      role: ctx.membership.role,
      memberCount: project._count.memberships,
      traceCount: project._count.traces,
      apiKeyCount: project._count.apiKeys,
    };
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.create({
        data: {
          name: input.name,
          description: input.description,
          memberships: {
            create: {
              userId: ctx.user.id,
              role: "OWNER",
            },
          },
        },
      });
      return project;
    }),

  update: projectAdminProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.project.update({
        where: { id: ctx.projectId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
        },
      });
    }),

  delete: projectOwnerProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx }) => {
      await ctx.db.project.delete({ where: { id: ctx.projectId } });
      return { success: true };
    }),
});
