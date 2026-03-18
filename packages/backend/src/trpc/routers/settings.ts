import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { router, projectProcedure, projectAdminProcedure } from "../context";

export const settingsRouter = router({
  listApiKeys: projectProcedure.query(async ({ ctx }) => {
    const keys = await ctx.db.apiKey.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        publicKey: true,
        displaySecretKey: true,
        note: true,
        createdAt: true,
      },
    });
    return keys;
  }),

  createApiKey: projectAdminProcedure
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
          projectId: ctx.projectId,
        },
      });

      return { publicKey, secretKey };
    }),

  deleteApiKey: projectAdminProcedure
    .input(z.object({ projectId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Ensure the key belongs to this project
      await ctx.db.apiKey.deleteMany({
        where: { id: input.id, projectId: ctx.projectId },
      });
      return { success: true };
    }),
});
