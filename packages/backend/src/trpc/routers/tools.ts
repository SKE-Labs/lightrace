import { randomUUID } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, projectProcedure } from "../context";
import { toToolDto } from "../../routes/tools-registry";

export const toolsRouter = router({
  /** List all registered tools for the project. */
  list: projectProcedure.query(async ({ ctx }) => {
    const tools = await ctx.db.toolRegistration.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { toolName: "asc" },
    });

    return tools.map(toToolDto);
  }),

  /** Invoke a tool on a connected SDK via its dev server. */
  invoke: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        toolName: z.string(),
        input: z.unknown(),
        observationId: z.string().optional(),
        timeoutMs: z.number().min(1000).max(120_000).default(30_000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [registration, apiKey] = await Promise.all([
        ctx.db.toolRegistration.findFirst({
          where: { projectId: ctx.projectId, toolName: input.toolName },
        }),
        ctx.db.apiKey.findFirst({
          where: { projectId: ctx.projectId },
        }),
      ]);

      if (!registration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Tool "${input.toolName}" is not registered`,
        });
      }

      if (!registration.callbackUrl) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Tool "${input.toolName}" has no callback URL — SDK dev server may not be running`,
        });
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

        const response = await fetch(`${registration.callbackUrl}/invoke`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey.publicKey}` } : {}),
          },
          body: JSON.stringify({
            tool: input.toolName,
            input: input.input,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "Unknown error");
          throw new Error(`SDK dev server returned ${response.status}: ${errorBody}`);
        }

        const envelope = (await response.json()) as {
          code: number;
          message: string;
          response: { output: unknown; error?: string; durationMs: number };
        };
        const result = envelope.response;

        // If an observation ID was provided, create a new observation with the result
        if (input.observationId) {
          const original = await ctx.db.observation.findFirst({
            where: { id: input.observationId, projectId: ctx.projectId },
          });

          if (original) {
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
        if (err instanceof TRPCError) throw err;

        const message =
          err instanceof Error
            ? err.name === "AbortError"
              ? `Tool invocation timed out after ${input.timeoutMs}ms`
              : err.message
            : "Tool invocation failed";

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),
});
