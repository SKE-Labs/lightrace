import { randomUUID } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, projectProcedure } from "../context";
import { toToolDto } from "../../routes/tools-registry";

/** Ping a single callbackUrl and return its health status. */
async function checkDevServerHealth(
  callbackUrl: string | null,
): Promise<{ status: "healthy" | "unhealthy" | "unreachable" | "unavailable"; message?: string }> {
  if (!callbackUrl) {
    return { status: "unavailable", message: "No callback URL registered" };
  }
  try {
    const res = await fetch(`${callbackUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return { status: "healthy" };
    return { status: "unhealthy", message: `HTTP ${res.status}` };
  } catch (err) {
    return {
      status: "unreachable",
      message:
        err instanceof Error
          ? err.name === "AbortError"
            ? "Timeout"
            : err.message
          : "Unknown error",
    };
  }
}

export const toolsRouter = router({
  /** List all registered tools for the project. */
  list: projectProcedure.query(async ({ ctx }) => {
    const tools = await ctx.db.toolRegistration.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { toolName: "asc" },
    });

    return tools.map(toToolDto);
  }),

  /** Check health of a single tool's dev server. */
  healthCheck: projectProcedure
    .input(z.object({ projectId: z.string(), toolName: z.string() }))
    .query(async ({ input, ctx }) => {
      const registration = await ctx.db.toolRegistration.findFirst({
        where: { projectId: ctx.projectId, toolName: input.toolName },
      });
      const result = await checkDevServerHealth(registration?.callbackUrl ?? null);
      return { ...result, callbackUrl: registration?.callbackUrl ?? null };
    }),

  /** Batch health check for all tools in a project. */
  healthCheckAll: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx }) => {
      const registrations = await ctx.db.toolRegistration.findMany({
        where: { projectId: ctx.projectId },
      });

      const results: Record<string, { status: string; message?: string }> = {};

      await Promise.allSettled(
        registrations.map(async (reg) => {
          results[reg.toolName] = await checkDevServerHealth(reg.callbackUrl || null);
        }),
      );

      return results;
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
          message: `Tool "${input.toolName}" is not registered. Make sure your SDK is running with @trace(type="tool") decorated functions.`,
        });
      }

      if (!registration.callbackUrl) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Tool "${input.toolName}" has no callback URL. Start your SDK with dev_server=True (Python) or devServer: true (JS).`,
        });
      }

      // Pre-invoke health check — fail fast with a clear message instead of waiting for a 30s timeout
      try {
        const healthRes = await fetch(`${registration.callbackUrl}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!healthRes.ok) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `SDK dev server at ${registration.callbackUrl} returned HTTP ${healthRes.status}. Restart your SDK.`,
          });
        }
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot reach SDK dev server at ${registration.callbackUrl}. Is your SDK still running?${
            registration.callbackUrl.includes("127.0.0.1")
              ? " If using Docker, set LIGHTRACE_DEV_SERVER_HOST to your host IP or host.docker.internal."
              : ""
          }`,
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
              ? `Tool invocation timed out after ${input.timeoutMs}ms. The SDK dev server may be overloaded or unresponsive.`
              : err.message.includes("ECONNREFUSED")
                ? `Cannot connect to SDK dev server at ${registration.callbackUrl}. Is your SDK still running?`
                : err.message
            : "Tool invocation failed";

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),
});
