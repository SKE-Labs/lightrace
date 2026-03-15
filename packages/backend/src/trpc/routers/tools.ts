import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../context";
import { invokeToolOnAgent, getConnectedAgents } from "../../routes/tools-ws";

const DEMO_PROJECT_ID = "demo-project";

export const toolsRouter = router({
  /** List all registered tools for the project. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const tools = await ctx.db.toolRegistration.findMany({
      where: { projectId: DEMO_PROJECT_ID },
      orderBy: [{ status: "asc" }, { toolName: "asc" }],
    });

    // Enrich with live connection status
    const connectedAgents = getConnectedAgents(DEMO_PROJECT_ID);
    const liveTools = new Set(
      connectedAgents.flatMap((a) => a.tools.map((t) => `${a.sdkInstanceId}:${t}`)),
    );

    return tools.map((t) => ({
      id: t.id,
      toolName: t.toolName,
      sdkInstanceId: t.sdkInstanceId,
      inputSchema: t.inputSchema,
      status: liveTools.has(`${t.sdkInstanceId}:${t.toolName}`) ? "online" : "offline",
      lastHeartbeat: t.lastHeartbeat,
      createdAt: t.createdAt,
    }));
  }),

  /** Invoke a tool on a connected SDK agent. */
  invoke: protectedProcedure
    .input(
      z.object({
        toolName: z.string(),
        input: z.unknown(),
        observationId: z.string().optional(),
        timeoutMs: z.number().min(1000).max(120_000).default(30_000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await invokeToolOnAgent({
          projectId: DEMO_PROJECT_ID,
          toolName: input.toolName,
          input: input.input,
          timeoutMs: input.timeoutMs,
        });

        // If an observation ID was provided, create a new observation with the result
        if (input.observationId) {
          const original = await ctx.db.observation.findUnique({
            where: { id: input.observationId },
          });

          if (original) {
            const { randomUUID } = await import("crypto");
            await ctx.db.observation.create({
              data: {
                id: randomUUID(),
                traceId: original.traceId,
                projectId: original.projectId,
                type: "TOOL",
                name: `${original.name ?? input.toolName} (re-run)`,
                startTime: new Date(),
                endTime: new Date(),
                input: (input.input as object) ?? undefined,
                output: (result.output as object) ?? undefined,
                parentObservationId: original.parentObservationId,
                level: result.error ? "ERROR" : "DEFAULT",
                statusMessage: result.error ?? null,
              },
            });
          }
        }

        return result;
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Tool invocation failed",
        });
      }
    }),
});
