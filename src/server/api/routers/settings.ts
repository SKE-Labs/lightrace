import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { router, protectedProcedure } from "../trpc";

export const settingsRouter = router({
  listApiKeys: protectedProcedure.query(async ({ ctx }) => {
    const keys = await ctx.db.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        publicKey: true,
        displaySecretKey: true,
        note: true,
        createdAt: true,
        project: { select: { name: true } },
      },
    });
    return keys;
  }),

  createApiKey: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const publicKey = `pk-lt-${randomBytes(16).toString("hex")}`;
      const secretKey = `sk-lt-${randomBytes(24).toString("hex")}`;
      const hashedSecretKey = createHash("sha256").update(secretKey).digest("hex");
      const displaySecretKey = `sk-lt-...${secretKey.slice(-4)}`;

      await ctx.db.apiKey.create({
        data: {
          publicKey,
          hashedSecretKey,
          displaySecretKey,
          note: input.note,
          projectId: input.projectId,
        },
      });

      return { publicKey, secretKey };
    }),

  deleteApiKey: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.apiKey.delete({ where: { id: input.id } });
      return { success: true };
    }),

  listProjects: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.project.findMany({
      orderBy: { createdAt: "desc" },
    });
  }),
});
