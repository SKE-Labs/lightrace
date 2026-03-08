import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "../auth";
import { db } from "../db";

export const createTRPCContext = async () => {
  const session = await auth();
  return { db, session };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, session: ctx.session },
  });
});
