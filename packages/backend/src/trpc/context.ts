import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
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
