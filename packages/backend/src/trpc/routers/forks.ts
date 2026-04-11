import { randomUUID } from "crypto";
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
      const forkedTraceId = randomUUID();

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

      // Phase B: Invoke tool + optionally replay with modified messages
      const forkPointParentId = forkPoint.parentObservationId
        ? (observationIdMap[forkPoint.parentObservationId] ?? null)
        : null;

      let invocationResult: InvokeDevServerResult;
      let replayResult: { output: unknown; error?: string; durationMs: number } | null = null;

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

          // Step 2: If tool succeeded, try to continue the agent via checkpoint replay
          if (!invocationResult.error) {
            // Find the fork point's checkpoint, then get the one after it
            const forkPointCheckpoint = await ctx.db.checkpoint.findFirst({
              where: { traceId: input.sourceTraceId, observationId: forkPoint.id },
              select: { stepIndex: true },
            });
            const checkpoint = await ctx.db.checkpoint.findFirst({
              where: {
                traceId: input.sourceTraceId,
                stepIndex: { gt: forkPointCheckpoint?.stepIndex ?? -1 },
              },
              orderBy: { stepIndex: "asc" },
            });

            if (checkpoint) {
              const state = checkpoint.state as Record<string, unknown>;
              const messages = state.messages as unknown[] | undefined;

              if (messages && Array.isArray(messages)) {
                // Replace the tool result matching this fork point's tool_call_id
                // Fall back to matching the LAST tool message with this name
                const toolCallId = forkPoint.toolCallId;
                let lastMatchIdx = -1;
                const modifiedMessages = messages.map((msg, idx) => {
                  const m = msg as Record<string, unknown>;
                  if (m.role === "tool") {
                    if (toolCallId && m.tool_call_id === toolCallId) {
                      return {
                        ...m,
                        content:
                          typeof invocationResult.output === "string"
                            ? invocationResult.output
                            : JSON.stringify(invocationResult.output),
                      };
                    }
                    if (!toolCallId && m.name === toolName) {
                      lastMatchIdx = idx;
                    }
                  }
                  return msg;
                });

                // If no tool_call_id match, replace the last name-matched message
                if (!toolCallId && lastMatchIdx >= 0) {
                  const m = modifiedMessages[lastMatchIdx] as Record<string, unknown>;
                  modifiedMessages[lastMatchIdx] = {
                    ...m,
                    content:
                      typeof invocationResult.output === "string"
                        ? invocationResult.output
                        : JSON.stringify(invocationResult.output),
                  };
                }

                try {
                  replayResult = await replayOnDevServer({
                    callbackUrl: registration.callbackUrl,
                    messages: modifiedMessages,
                    tools: state.tools as unknown[] | undefined,
                    model: state.model as string | undefined,
                    system: state.system,
                    context: input.context,
                    apiKeyPublic: apiKey?.publicKey,
                    timeoutMs: input.timeoutMs,
                  });
                } catch (err) {
                  const message =
                    err instanceof Error
                      ? err.name === "TimeoutError" || err.name === "AbortError"
                        ? `Replay timed out after ${input.timeoutMs}ms`
                        : err.message
                      : "Replay failed";
                  replayResult = { output: null, error: message, durationMs: 0 };
                }
              }
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

      // If replay succeeded, create a GENERATION observation for the continuation
      if (replayResult && !replayResult.error) {
        await ctx.db.observation.create({
          data: {
            id: randomUUID(),
            traceId: forkedTraceId,
            projectId: ctx.projectId,
            type: ObservationType.GENERATION,
            name: "continuation (replay)",
            startTime: new Date(),
            endTime: new Date(),
            output: (replayResult.output as object) ?? undefined,
            parentObservationId: forkPointParentId,
            level: ObservationLevel.DEFAULT,
          },
        });
      }

      await updateTraceAggregates(ctx.db, forkedTraceId);
      publishTraceUpdate(ctx.projectId, forkedTraceId);

      return {
        forkId: traceFork.id,
        forkedTraceId,
        invocationResult,
        replayResult,
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
