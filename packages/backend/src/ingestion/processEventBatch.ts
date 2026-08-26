import { db } from "@lightrace/shared/db";
import {
  ingestionEvent,
  normalizeUsage,
  type IngestionEvent,
} from "@lightrace/shared/schemas/ingestion";
import { ObservationType, ObservationLevel, Prisma } from "@prisma/client";
import { updateTraceAggregates } from "./updateTraceAggregates";
import { upsertErrorIssue } from "./errorIngestion";

type TxClient = Prisma.TransactionClient;

interface BatchResult {
  successes: { id: string; status: number }[];
  errors: { id: string; status: number; message: string; error?: string }[];
}

function parseDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

function parseLevel(level?: string): ObservationLevel {
  if (!level) return ObservationLevel.DEFAULT;
  const upper = level.toUpperCase();
  if (upper in ObservationLevel) return upper as ObservationLevel;
  return ObservationLevel.DEFAULT;
}

async function ensureTraceExists(tx: TxClient, traceId: string, projectId: string) {
  await tx.trace.upsert({
    where: { id: traceId },
    create: { id: traceId, projectId, timestamp: new Date() },
    update: {},
  });
}

async function processTraceCreate(
  tx: TxClient,
  body: IngestionEvent & { type: "trace-create" },
  projectId: string,
) {
  const data = body.body;
  const traceId = data.id ?? body.id;

  await tx.trace.upsert({
    where: { id: traceId },
    create: {
      id: traceId,
      projectId,
      timestamp: data.timestamp ? parseDate(data.timestamp) : new Date(),
      name: data.name ?? null,
      input: data.input ?? undefined,
      output: data.output ?? undefined,
      metadata: data.metadata ?? undefined,
      sessionId: data.sessionId ?? null,
      userId: data.userId ?? null,
      release: data.release ?? null,
      version: data.version ?? null,
      tags: data.tags ?? [],
      public: data.public ?? false,
    },
    update: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.timestamp && { timestamp: parseDate(data.timestamp) }),
      ...(data.input !== undefined && { input: data.input }),
      ...(data.output !== undefined && { output: data.output }),
      ...(data.metadata !== undefined && { metadata: data.metadata }),
      ...(data.sessionId !== undefined && { sessionId: data.sessionId }),
      ...(data.userId !== undefined && { userId: data.userId }),
      ...(data.release !== undefined && { release: data.release }),
      ...(data.version !== undefined && { version: data.version }),
      ...(data.tags && { tags: data.tags }),
      ...(data.public !== undefined && { public: data.public }),
    },
  });
}

async function processObservation(
  tx: TxClient,
  event: IngestionEvent,
  projectId: string,
  type: ObservationType,
  isUpdate: boolean,
) {
  const body = event.body as Record<string, unknown>;
  const observationId = body.id as string;
  const traceId = (body.traceId as string) ?? event.id;

  await ensureTraceExists(tx, traceId, projectId);

  const usage = normalizeUsage(
    "usage" in body ? (body.usage as Parameters<typeof normalizeUsage>[0]) : null,
  );

  if (isUpdate) {
    // For updates, only set fields that are present
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.startTime !== undefined) updateData.startTime = parseDate(body.startTime);
    if (body.endTime !== undefined)
      updateData.endTime = body.endTime ? parseDate(body.endTime) : null;
    if (body.input !== undefined) updateData.input = body.input;
    if (body.output !== undefined) updateData.output = body.output;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;
    if (body.level !== undefined) updateData.level = parseLevel(body.level as string);
    if (body.statusMessage !== undefined) updateData.statusMessage = body.statusMessage;
    if (body.errorType !== undefined) updateData.errorType = body.errorType;
    if (body.errorStacktrace !== undefined)
      updateData.errorStacktrace = body.errorStacktrace
        ? String(body.errorStacktrace).slice(0, 8000)
        : null;
    if (body.errorHandled !== undefined) updateData.errorHandled = body.errorHandled;
    if (body.parentObservationId !== undefined)
      updateData.parentObservationId = body.parentObservationId;
    if (body.version !== undefined) updateData.version = body.version;
    if ("completionStartTime" in body && body.completionStartTime !== undefined) {
      updateData.completionStartTime = body.completionStartTime
        ? parseDate(body.completionStartTime)
        : null;
    }
    if ("model" in body && body.model !== undefined) updateData.model = body.model;
    if ("modelParameters" in body && body.modelParameters !== undefined)
      updateData.modelParameters = body.modelParameters;
    if ("usage" in body && body.usage) {
      updateData.promptTokens = usage.promptTokens;
      updateData.completionTokens = usage.completionTokens;
      updateData.totalTokens = usage.totalTokens;
      updateData.inputCost = usage.inputCost;
      updateData.outputCost = usage.outputCost;
      updateData.totalCost = usage.totalCost;
    }

    await tx.observation.upsert({
      where: { id: observationId },
      create: {
        id: observationId,
        traceId,
        projectId,
        type,
        name: (body.name as string) ?? null,
        startTime: body.startTime ? parseDate(body.startTime) : new Date(),
        endTime: body.endTime ? parseDate(body.endTime) : null,
        input: body.input ?? undefined,
        output: body.output ?? undefined,
        metadata: body.metadata ?? undefined,
        level: parseLevel(body.level as string),
        statusMessage: (body.statusMessage as string) ?? null,
        errorType: (body.errorType as string) ?? null,
        errorStacktrace: (body.errorStacktrace as string)
          ? String(body.errorStacktrace).slice(0, 8000)
          : null,
        errorHandled: (body.errorHandled as boolean) ?? null,
        parentObservationId: (body.parentObservationId as string) ?? null,
        version: (body.version as string) ?? null,
        model: (body.model as string) ?? null,
        modelParameters: body.modelParameters ?? undefined,
        completionStartTime: body.completionStartTime ? parseDate(body.completionStartTime) : null,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        inputCost: usage.inputCost,
        outputCost: usage.outputCost,
        totalCost: usage.totalCost,
      },
      update: updateData,
    });
  } else {
    await tx.observation.upsert({
      where: { id: observationId },
      create: {
        id: observationId,
        traceId,
        projectId,
        type,
        name: (body.name as string) ?? null,
        startTime: body.startTime ? parseDate(body.startTime) : new Date(),
        endTime: body.endTime ? parseDate(body.endTime) : null,
        input: body.input ?? undefined,
        output: body.output ?? undefined,
        metadata: body.metadata ?? undefined,
        level: parseLevel(body.level as string),
        statusMessage: (body.statusMessage as string) ?? null,
        errorType: (body.errorType as string) ?? null,
        errorStacktrace: (body.errorStacktrace as string)
          ? String(body.errorStacktrace).slice(0, 8000)
          : null,
        errorHandled: (body.errorHandled as boolean) ?? null,
        parentObservationId: (body.parentObservationId as string) ?? null,
        version: (body.version as string) ?? null,
        model: (body.model as string) ?? null,
        modelParameters: body.modelParameters ?? undefined,
        completionStartTime:
          "completionStartTime" in body && body.completionStartTime
            ? parseDate(body.completionStartTime)
            : null,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        inputCost: usage.inputCost,
        outputCost: usage.outputCost,
        totalCost: usage.totalCost,
      },
      update: {
        type,
        name: (body.name as string) ?? undefined,
        startTime: body.startTime ? parseDate(body.startTime) : undefined,
        endTime: body.endTime ? parseDate(body.endTime) : undefined,
        input: body.input ?? undefined,
        output: body.output ?? undefined,
        metadata: body.metadata ?? undefined,
        level: parseLevel(body.level as string),
        statusMessage: (body.statusMessage as string) ?? undefined,
        errorType: (body.errorType as string) ?? undefined,
        errorStacktrace: (body.errorStacktrace as string)
          ? String(body.errorStacktrace).slice(0, 8000)
          : undefined,
        errorHandled: (body.errorHandled as boolean) ?? undefined,
        parentObservationId: (body.parentObservationId as string) ?? undefined,
        version: (body.version as string) ?? undefined,
        model: (body.model as string) ?? undefined,
        modelParameters: body.modelParameters ?? undefined,
        completionStartTime:
          "completionStartTime" in body && body.completionStartTime
            ? parseDate(body.completionStartTime)
            : undefined,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        inputCost: usage.inputCost,
        outputCost: usage.outputCost,
        totalCost: usage.totalCost,
      },
    });
  }

  // Update denormalized aggregates on the parent trace
  await updateTraceAggregates(tx, traceId);

  // If observation is an error, create/update ErrorIssue/ErrorEvent (any type)
  // Fetch the persisted observation to get actual fields (handles partial updates)
  try {
    const persisted = await tx.observation.findUnique({
      where: { id: observationId },
      select: {
        type: true,
        name: true,
        model: true,
        statusMessage: true,
        level: true,
        startTime: true,
        errorType: true,
        errorStacktrace: true,
        errorHandled: true,
      },
    });
    if (persisted && persisted.level === ObservationLevel.ERROR) {
      const eventTimestamp = event.timestamp
        ? parseDate(event.timestamp as string)
        : (persisted.startTime ?? new Date());
      await upsertErrorIssue(tx, {
        projectId,
        traceId,
        observationId,
        type: persisted.type,
        name: persisted.name,
        model: persisted.model,
        statusMessage: persisted.statusMessage,
        level: persisted.level,
        timestamp: eventTimestamp,
        errorType: persisted.errorType,
        stacktrace: persisted.errorStacktrace,
        handled: persisted.errorHandled,
      });
    }
  } catch (e) {
    // Log but don't fail ingestion if error grouping fails
    console.error(
      "[ingestion] error grouping failed for",
      observationId,
      e instanceof Error ? e.message : e,
    );
  }
}

export async function processEventBatch(
  rawEvents: unknown[],
  projectId: string,
): Promise<BatchResult> {
  const result: BatchResult = { successes: [], errors: [] };

  await db.$transaction(async (tx) => {
    for (const rawEvent of rawEvents) {
      const eventId =
        typeof rawEvent === "object" && rawEvent !== null && "id" in rawEvent
          ? (rawEvent as { id: string }).id
          : "unknown";

      try {
        const parsed = ingestionEvent.safeParse(rawEvent);
        if (!parsed.success) {
          result.errors.push({
            id: eventId,
            status: 400,
            message: "Validation failed",
            error: parsed.error.message,
          });
          continue;
        }

        const event = parsed.data;

        switch (event.type) {
          case "trace-create":
            await processTraceCreate(tx, event, projectId);
            break;
          case "span-create":
            await processObservation(tx, event, projectId, ObservationType.SPAN, false);
            break;
          case "span-update":
            await processObservation(tx, event, projectId, ObservationType.SPAN, true);
            break;
          case "generation-create":
            await processObservation(tx, event, projectId, ObservationType.GENERATION, false);
            break;
          case "generation-update":
            await processObservation(tx, event, projectId, ObservationType.GENERATION, true);
            break;
          case "event-create":
            await processObservation(tx, event, projectId, ObservationType.EVENT, false);
            break;
          case "tool-create":
            await processObservation(tx, event, projectId, ObservationType.TOOL, false);
            break;
          case "tool-update":
            await processObservation(tx, event, projectId, ObservationType.TOOL, true);
            break;
          case "chain-create":
            await processObservation(tx, event, projectId, ObservationType.CHAIN, false);
            break;
          case "chain-update":
            await processObservation(tx, event, projectId, ObservationType.CHAIN, true);
            break;
          case "observation-create":
            await processObservation(tx, event, projectId, ObservationType.SPAN, false);
            break;
          case "observation-update":
            await processObservation(tx, event, projectId, ObservationType.SPAN, true);
            break;
          case "sdk-log":
            // Just acknowledge
            break;
        }

        result.successes.push({ id: eventId, status: 201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`[ingestion] Error processing event ${eventId}:`, message);
        result.errors.push({ id: eventId, status: 500, message });
      }
    }
  });

  return result;
}
