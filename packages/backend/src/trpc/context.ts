import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { db } from "@lightrace/shared/db";
import type { AuthUser } from "../middleware/auth";

export interface TRPCContext {
  db: typeof db;
  user: AuthUser | null;
}

export function createTRPCContext(user: AuthUser | null): TRPCContext {
  return { db, user };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, user: ctx.user },
  });
});

const ADMIN_ROLES = ["OWNER", "ADMIN"] as const;

/**
 * Base project procedure — fetches membership and adds it to context.
 * Role-restricted variants layer on top.
 */
export const projectProcedure = protectedProcedure
  .input(z.object({ projectId: z.string() }))
  .use(async ({ ctx, input, next }) => {
    const membership = await ctx.db.projectMembership.findUnique({
      where: {
        userId_projectId: { userId: ctx.user.id, projectId: input.projectId },
      },
    });
    if (!membership) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this project" });
    }
    return next({
      ctx: { ...ctx, projectId: input.projectId, membership },
    });
  });

/** Requires OWNER or ADMIN role. */
export const projectAdminProcedure = projectProcedure.use(async ({ ctx, next }) => {
  if (!ADMIN_ROLES.includes(ctx.membership.role as (typeof ADMIN_ROLES)[number])) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next();
});

/** Requires OWNER role. */
export const projectOwnerProcedure = projectProcedure.use(async ({ ctx, next }) => {
  if (ctx.membership.role !== "OWNER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Owner access required" });
  }
  return next();
});
