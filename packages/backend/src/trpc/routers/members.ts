import { z } from "zod";
import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { router, protectedProcedure, projectProcedure, projectAdminProcedure } from "../context";

const INVITATION_EXPIRY_DAYS = 7;

async function ensureNotLastOwner(db: PrismaClient, projectId: string) {
  const ownerCount = await db.projectMembership.count({
    where: { projectId, role: "OWNER" },
  });
  if (ownerCount <= 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot remove or demote the last owner",
    });
  }
}

export const membersRouter = router({
  list: projectProcedure.query(async ({ ctx }) => {
    const members = await ctx.db.projectMembership.findMany({
      where: { projectId: ctx.projectId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      createdAt: m.createdAt,
    }));
  }),

  invite: projectAdminProcedure
    .input(
      z.object({
        projectId: z.string(),
        email: z.string().email(),
        role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Run independent checks in parallel
      const [existingUser, existingInvite] = await Promise.all([
        ctx.db.user.findUnique({ where: { email: input.email } }),
        ctx.db.membershipInvitation.findFirst({
          where: { email: input.email, projectId: ctx.projectId, status: "PENDING" },
        }),
      ]);

      if (existingInvite) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An invitation is already pending for this email",
        });
      }

      // If user exists, check if already a member
      if (existingUser) {
        const existingMembership = await ctx.db.projectMembership.findUnique({
          where: {
            userId_projectId: { userId: existingUser.id, projectId: ctx.projectId },
          },
        });
        if (existingMembership) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User is already a member of this project",
          });
        }
      }

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

      // If user exists, auto-accept in a transaction
      if (existingUser) {
        await ctx.db.$transaction([
          ctx.db.membershipInvitation.create({
            data: {
              email: input.email,
              projectId: ctx.projectId,
              role: input.role,
              invitedByUserId: ctx.user.id,
              token,
              expiresAt,
              status: "ACCEPTED",
            },
          }),
          ctx.db.projectMembership.create({
            data: {
              userId: existingUser.id,
              projectId: ctx.projectId,
              role: input.role,
            },
          }),
        ]);
        return { invited: true, autoAccepted: true };
      }

      await ctx.db.membershipInvitation.create({
        data: {
          email: input.email,
          projectId: ctx.projectId,
          role: input.role,
          invitedByUserId: ctx.user.id,
          token,
          expiresAt,
        },
      });

      return { invited: true, autoAccepted: false, token };
    }),

  updateRole: projectAdminProcedure
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string(),
        role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot change your own role",
        });
      }

      const target = await ctx.db.projectMembership.findUnique({
        where: {
          userId_projectId: { userId: input.userId, projectId: ctx.projectId },
        },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      }

      if (input.role === "OWNER" && ctx.membership.role !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners can assign the owner role",
        });
      }

      if (target.role === "OWNER" && input.role !== "OWNER") {
        await ensureNotLastOwner(ctx.db, ctx.projectId);
      }

      return ctx.db.projectMembership.update({
        where: {
          userId_projectId: { userId: input.userId, projectId: ctx.projectId },
        },
        data: { role: input.role },
      });
    }),

  remove: projectAdminProcedure
    .input(z.object({ projectId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use 'leave' to remove yourself",
        });
      }

      const target = await ctx.db.projectMembership.findUnique({
        where: {
          userId_projectId: { userId: input.userId, projectId: ctx.projectId },
        },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (target.role === "OWNER" && ctx.membership.role !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners can remove other owners",
        });
      }

      await ctx.db.projectMembership.delete({
        where: {
          userId_projectId: { userId: input.userId, projectId: ctx.projectId },
        },
      });
      return { success: true };
    }),

  leave: projectProcedure.input(z.object({ projectId: z.string() })).mutation(async ({ ctx }) => {
    if (ctx.membership.role === "OWNER") {
      await ensureNotLastOwner(ctx.db, ctx.projectId);
    }

    await ctx.db.projectMembership.delete({
      where: {
        userId_projectId: { userId: ctx.user.id, projectId: ctx.projectId },
      },
    });
    return { success: true };
  }),

  listInvitations: projectAdminProcedure.query(async ({ ctx }) => {
    return ctx.db.membershipInvitation.findMany({
      where: { projectId: ctx.projectId, status: "PENDING" },
      include: {
        invitedBy: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  cancelInvitation: projectAdminProcedure
    .input(z.object({ projectId: z.string(), invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.membershipInvitation.findFirst({
        where: {
          id: input.invitationId,
          projectId: ctx.projectId,
          status: "PENDING",
        },
      });
      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.db.membershipInvitation.delete({
        where: { id: invitation.id },
      });
      return { success: true };
    }),

  myInvitations: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.membershipInvitation.findMany({
      where: {
        email: ctx.user.email,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        project: { select: { id: true, name: true } },
        invitedBy: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  acceptInvitation: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.membershipInvitation.findUnique({
        where: { token: input.token },
      });
      if (!invitation || invitation.status !== "PENDING") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
      }
      if (invitation.expiresAt < new Date()) {
        await ctx.db.membershipInvitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation has expired" });
      }
      if (invitation.email !== ctx.user.email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invitation is for a different email address",
        });
      }

      const existing = await ctx.db.projectMembership.findUnique({
        where: {
          userId_projectId: {
            userId: ctx.user.id,
            projectId: invitation.projectId,
          },
        },
      });
      if (existing) {
        await ctx.db.membershipInvitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED" },
        });
        return { projectId: invitation.projectId };
      }

      await ctx.db.$transaction([
        ctx.db.projectMembership.create({
          data: {
            userId: ctx.user.id,
            projectId: invitation.projectId,
            role: invitation.role,
          },
        }),
        ctx.db.membershipInvitation.update({
          where: { id: invitation.id },
          data: { status: "ACCEPTED" },
        }),
      ]);

      return { projectId: invitation.projectId };
    }),

  declineInvitation: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.membershipInvitation.findUnique({
        where: { token: input.token },
      });
      if (!invitation || invitation.email !== ctx.user.email) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.db.membershipInvitation.delete({
        where: { id: invitation.id },
      });
      return { success: true };
    }),
});
