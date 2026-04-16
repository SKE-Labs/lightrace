import { randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ObservationType, ObservationLevel } from "@prisma/client";
import { router, projectProcedure } from "../context";
import { updateTraceAggregates } from "../../ingestion/updateTraceAggregates";
import { publishTraceUpdate } from "../../realtime/pubsub";
import { checkDevServerHealth, invokeDevServer, replayOnDevServer } from "../../lib/dev-server";
import type { InvokeDevServerResult } from "../../lib/dev-server";

export const forksRouter = router({
  /** Create a fork from a TOOL observation with modified input. */
  create: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        sourceTraceId: z.string(),
        forkPointObservationId: z.string(),
        modifiedInput: z.unknown(),
        context: z.record(z.unknown()).optional(),
        timeoutMs: z.number().min(1000).max(120_000).default(30_000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const sourceTrace = await ctx.db.trace.findFirst({
        where: { id: input.sourceTraceId, projectId: ctx.projectId },
        include: { observations: { orderBy: { startTime: "asc" } } },
      });
      if (!sourceTrace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Source trace not found" });
      }

      const forkPoint = sourceTrace.observations.find((o) => o.id === input.forkPointObservationId);
      if (!forkPoint) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fork point observation not found in trace",
        });
      }
      if (forkPoint.type !== ObservationType.TOOL) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only TOOL observations can be forked. Got: " + forkPoint.type,
        });
      }

      const toolName = forkPoint.name ?? forkPoint.id;
      const [registration, apiKey] = await Promise.all([
        ctx.db.toolRegistration.findFirst({
          where: { projectId: ctx.projectId, toolName },
        }),
        ctx.db.apiKey.findFirst({
          where: { projectId: ctx.projectId },
        }),
      ]);

      // Phase A: Create fork structure (transaction)
      // Use 32-char hex (same format as OTel trace IDs) so the SDK's
      // callback handler OTel spans land on this exact trace.
      const forkedTraceId = randomBytes(16).toString("hex");

      const preForkObservations = sourceTrace.observations.filter(
        (o) => o.startTime < forkPoint.startTime,
      );

      const observationIdMap: Record<string, string> = {};
      for (const obs of preForkObservations) {
        observationIdMap[obs.id] = randomUUID();
      }

      const traceFork = await ctx.db.$transaction(async (tx) => {
        await tx.trace.create({
          data: {
            id: forkedTraceId,
            projectId: ctx.projectId,
            timestamp: new Date(),
            name: sourceTrace.name ? `${sourceTrace.name} (fork)` : "(fork)",
            input: sourceTrace.input ?? undefined,
            output: undefined,
            metadata: sourceTrace.metadata ?? undefined,
            sessionId: sourceTrace.sessionId,
            userId: sourceTrace.userId,
            release: sourceTrace.release,
            version: sourceTrace.version,
            tags: sourceTrace.tags,
            isFork: true,
          },
        });

        if (preForkObservations.length > 0) {
          await tx.observation.createMany({
            data: preForkObservations.map((obs) => ({
              id: observationIdMap[obs.id]!,
              traceId: forkedTraceId,
              projectId: ctx.projectId,
              type: obs.type,
              name: obs.name,
              startTime: obs.startTime,
              endTime: obs.endTime,
              completionStartTime: obs.completionStartTime,
              input: obs.input ?? undefined,
              output: obs.output ?? undefined,
              metadata: obs.metadata ?? undefined,
              model: obs.model,
              modelParameters: obs.modelParameters ?? undefined,
              parentObservationId: obs.parentObservationId
                ? (observationIdMap[obs.parentObservationId] ?? null)
                : null,
              level: obs.level,
              statusMessage: obs.statusMessage,
              version: obs.version,
              promptTokens: obs.promptTokens,
              completionTokens: obs.completionTokens,
              totalTokens: obs.totalTokens,
              inputCost: obs.inputCost,
              outputCost: obs.outputCost,
              totalCost: obs.totalCost,
            })),
          });
        }

        return tx.traceFork.create({
          data: {
            sourceTraceId: input.sourceTraceId,
            forkedTraceId,
            forkPointId: input.forkPointObservationId,
            modifiedInput: (input.modifiedInput as object) ?? undefined,
            observationIdMap,
            projectId: ctx.projectId,
          },
        });
      });

      // Phase B: Invoke tool + optionally replay via LangGraph checkpoint
      const forkPointParentId = forkPoint.parentObservationId
        ? (observationIdMap[forkPoint.parentObservationId] ?? null)
        : null;

      let invocationResult: InvokeDevServerResult;

      if (!registration?.callbackUrl) {
        invocationResult = {
          output: null,
          error: registration
            ? `Tool "${toolName}" has no callback URL. Start your SDK with devServer: true.`
            : `Tool "${toolName}" is not registered. Make sure your SDK is running.`,
          durationMs: 0,
        };
      } else {
        const health = await checkDevServerHealth(registration.callbackUrl);
        if (health.status !== "healthy") {
          invocationResult = {
            output: null,
            error: `Dev server at ${registration.callbackUrl} is ${health.status}: ${health.message ?? "unknown"}`,
            durationMs: 0,
          };
        } else {
          // Step 1: Invoke tool with modified input
          try {
            invocationResult = await invokeDevServer({
              callbackUrl: registration.callbackUrl,
              toolName,
              input: input.modifiedInput,
              context: input.context,
              apiKeyPublic: apiKey?.publicKey,
              timeoutMs: input.timeoutMs,
            });
          } catch (err) {
            const message =
              err instanceof Error
                ? err.name === "TimeoutError" || err.name === "AbortError"
                  ? `Tool invocation timed out after ${input.timeoutMs}ms`
                  : err.message
                : "Tool invocation failed";
            invocationResult = { output: null, error: message, durationMs: 0 };
          }

          // Step 2: If tool succeeded, fire-and-forget replay via LangGraph.
          //         The SDK runs the graph in the background and traces
          //         observations to the forked trace via OTel in real-time.
          if (!invocationResult.error) {
            const threadId = sourceTrace.sessionId;
            const capabilities = registration.capabilities as
              | Record<string, unknown>
              | null
              | undefined;

            if (threadId && capabilities?.graph) {
              const newContent =
                typeof invocationResult.output === "string"
                  ? invocationResult.output
                  : JSON.stringify(invocationResult.output);

              // Fire-and-forget — don't await, observations arrive via OTel
              replayOnDevServer({
                callbackUrl: registration.callbackUrl,
                threadId,
                toolCallId: forkPoint.toolCallId ?? undefined,
                toolName,
                modifiedContent: newContent,
                forkedTraceId,
                context: input.context,
                apiKeyPublic: apiKey?.publicKey,
                timeoutMs: input.timeoutMs,
              }).catch((err) => {
                console.error("[forks] replay request failed:", err);
              });
            }
          }
        }
      }

      // Create fork-point TOOL observation with the re-run result
      await ctx.db.observation.create({
        data: {
          id: randomUUID(),
          traceId: forkedTraceId,
          projectId: ctx.projectId,
          type: ObservationType.TOOL,
          name: toolName,
          startTime: new Date(),
          endTime: new Date(),
          input: (input.modifiedInput as object) ?? undefined,
          output: (invocationResult.output as object) ?? undefined,
          parentObservationId: forkPointParentId,
          level: invocationResult.error ? ObservationLevel.ERROR : ObservationLevel.DEFAULT,
          statusMessage: invocationResult.error ?? null,
        },
      });

      // Continuation observations are created by the SDK via OTel in real-time
      // (no longer created here from the replay result).

      await updateTraceAggregates(ctx.db, forkedTraceId);
      publishTraceUpdate(ctx.projectId, forkedTraceId);

      return {
        forkId: traceFork.id,
        forkedTraceId,
        invocationResult,
      };
    }),

  /** Get fork metadata for a trace (is it a fork? does it have forks?). */
  byTraceId: projectProcedure
    .input(z.object({ projectId: z.string(), traceId: z.string() }))
    .query(async ({ input, ctx }) => {
      const [forkedFrom, forks] = await Promise.all([
        ctx.db.traceFork.findUnique({
          where: { forkedTraceId: input.traceId },
        }),
        ctx.db.traceFork.findMany({
          where: { sourceTraceId: input.traceId },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      return { forkedFrom, forks };
    }),

  /** Fetch both traces with observations for side-by-side comparison. */
  compare: projectProcedure
    .input(z.object({ projectId: z.string(), forkId: z.string() }))
    .query(async ({ input, ctx }) => {
      const fork = await ctx.db.traceFork.findFirst({
        where: { id: input.forkId, projectId: ctx.projectId },
      });
      if (!fork) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fork not found" });
      }

      const [sourceTrace, forkedTrace] = await Promise.all([
        ctx.db.trace.findFirst({
          where: { id: fork.sourceTraceId, projectId: ctx.projectId },
          include: { observations: { orderBy: { startTime: "asc" } } },
        }),
        ctx.db.trace.findFirst({
          where: { id: fork.forkedTraceId, projectId: ctx.projectId },
          include: { observations: { orderBy: { startTime: "asc" } } },
        }),
      ]);

      if (!sourceTrace || !forkedTrace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Source or forked trace not found" });
      }

      return {
        fork,
        sourceTrace,
        forkedTrace,
        observationIdMap: (fork.observationIdMap as Record<string, string>) ?? {},
      };
    }),
});
