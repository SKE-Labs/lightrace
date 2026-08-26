import { createHash, randomBytes } from "crypto";
import { Prisma, ObservationLevel, ObservationType } from "@prisma/client";
import {
  normalizeErrorMessage,
  fingerprintAny,
  calcPriority,
  buildTitle,
  parseErrorTypeAndValue,
} from "./errorGroup";

type TxClient = Prisma.TransactionClient;

function generateShortId(): string {
  return `ERR-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export type UpsertErrorIssueParams = {
  projectId: string;
  traceId: string;
  observationId: string;
  type: ObservationType;
  name?: string | null;
  model?: string | null;
  statusMessage?: string | null;
  level?: string | null;
  timestamp?: Date;
  errorType?: string | null;
  errorValue?: string | null;
  stacktrace?: string | null;
  handled?: boolean | null;
  tags?: unknown;
};

export async function upsertErrorIssue(
  tx: TxClient,
  params: UpsertErrorIssueParams,
): Promise<void> {
  const levelUpper = params.level ? String(params.level).toUpperCase() : "DEFAULT";
  if (levelUpper !== "ERROR") return;

  const type = params.type;
  const projectId = params.projectId;
  const traceId = params.traceId;
  const observationId = params.observationId;
  const timestamp = params.timestamp ?? new Date();
  const statusMessage = params.statusMessage ?? "";
  const name = params.name ?? null;
  const model = params.model ?? null;

  // Parse error type/value if not provided - avoid duplication when statusMessage already contains type prefix
  let errorType = params.errorType ?? null;
  let errorValue = params.errorValue ?? null;
  if (!errorType && !errorValue && statusMessage) {
    const parsed = parseErrorTypeAndValue(statusMessage);
    errorType = parsed.errorType;
    errorValue = parsed.errorValue || statusMessage;
  } else if (!errorValue && statusMessage) {
    const parsed = parseErrorTypeAndValue(statusMessage);
    // If parsed type matches supplied type, use parsed value without prefix to avoid "ValueError: ValueError: boom"
    if (parsed.errorType && parsed.errorType === errorType && parsed.errorValue) {
      errorValue = parsed.errorValue;
    } else {
      errorValue = statusMessage;
    }
  }

  // Build fingerprint - include explicit errorType/errorValue for accurate grouping
  const fingerprintParams: Record<string, unknown> = {
    type,
    projectId,
    statusMessage: errorValue || statusMessage,
    name,
    model,
    errorType,
    errorValue,
  };
  if (type === "TOOL") {
    fingerprintParams.toolName = name;
  } else if (type === "GENERATION") {
    fingerprintParams.model = model;
    fingerprintParams.name = name;
  } else {
    fingerprintParams.name = name;
  }

  let fingerprint: string;
  try {
    fingerprint = fingerprintAny(fingerprintParams as Parameters<typeof fingerprintAny>[0]);
  } catch {
    // Fallback to simple hash if fingerprint fails (e.g., missing toolName)
    const fallback = `${projectId}:${type}:${name || "unknown"}:${normalizeErrorMessage(statusMessage)}`;
    fingerprint = createHash("sha256").update(fallback).digest("hex");
  }

  let title: string;
  if (type === "TOOL") {
    title = buildTitle({
      toolName: name ?? undefined,
      errorValue: errorValue || statusMessage || undefined,
      errorType: errorType || undefined,
    });
  } else if (type === "GENERATION") {
    const modelOrName = model || name || "generation";
    const val = errorValue || errorType || statusMessage || "Unknown error";
    let truncated = val;
    if (truncated.length > 120) truncated = truncated.slice(0, 120);
    title = `${modelOrName}: ${truncated}`;
  } else {
    const val = errorValue || errorType || statusMessage || "Unknown error";
    let truncated = val;
    if (truncated.length > 120) truncated = truncated.slice(0, 120);
    title = name ? `${name}: ${truncated}` : truncated;
  }

  const culprit = name || model || null;

  // Dedupe: if ErrorEvent already exists for this observation, update it instead of incrementing count
  const existingEvent = await tx.errorEvent.findUnique({
    where: { observationId },
  });
  if (existingEvent) {
    // Update existing event (e.g., statusMessage changed) but don't increment issue count
    await tx.errorEvent.update({
      where: { observationId },
      data: {
        errorType,
        errorValue,
        stacktrace: params.stacktrace ?? existingEvent.stacktrace,
        handled: params.handled ?? existingEvent.handled,
        ...(params.tags ? { tags: params.tags as unknown as Prisma.InputJsonValue } : {}),
        timestamp,
        expiresAt: new Date(new Date(timestamp).setDate(new Date(timestamp).getDate() + 90)),
      },
    });
    // Also update issue lastSeen if newer
    const linkedIssue = await tx.errorIssue.findUnique({ where: { id: existingEvent.issueId } });
    if (linkedIssue && timestamp > linkedIssue.lastSeen) {
      await tx.errorIssue.update({
        where: { id: linkedIssue.id },
        data: { lastSeen: timestamp, lastTraceId: traceId },
      });
    }
    return;
  }

  const expiresAt = new Date(timestamp);
  expiresAt.setDate(expiresAt.getDate() + 90);

  // Truncate stacktrace to 8000 for storage
  const truncatedStacktrace = params.stacktrace
    ? params.stacktrace.length > 8000
      ? params.stacktrace.slice(0, 8000)
      : params.stacktrace
    : null;

  // Try to create or update issue atomically with retry for race conditions
  // Use loop to handle unique constraint violations for fingerprint and shortId
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await tx.errorIssue.findUnique({
      where: { projectId_fingerprint: { projectId, fingerprint } },
    });

    if (!existing) {
      const shortId = generateShortId();
      const priority = calcPriority({
        level: levelUpper,
        count24h: 1,
        handled: params.handled ?? false,
      });
      try {
        const issue = await tx.errorIssue.create({
          data: {
            id: randomBytes(12).toString("hex"),
            shortId,
            projectId,
            fingerprint,
            type,
            toolName: type === "TOOL" ? name : null,
            title,
            culprit,
            level: ObservationLevel.ERROR,
            status: "UNRESOLVED",
            priority,
            count: 1,
            traceCount: 1,
            userCount: 0,
            firstSeen: timestamp,
            lastSeen: timestamp,
            firstTraceId: traceId,
            lastTraceId: traceId,
            firstRelease: null,
            lastRelease: null,
          },
        });

        await tx.errorEvent.create({
          data: {
            id: observationId,
            issueId: issue.id,
            projectId,
            observationId,
            traceId,
            timestamp,
            errorType,
            errorValue,
            stacktrace: truncatedStacktrace,
            handled: params.handled ?? null,
            tags: params.tags ? (params.tags as unknown as Prisma.InputJsonValue) : undefined,
            expiresAt,
          },
        });
        return;
      } catch (e: unknown) {
        // Handle unique constraint violation for fingerprint (race) or shortId
        const prismaError = e as { code?: string; meta?: { target?: string[] } };
        if (prismaError?.code === "P2002") {
          // If fingerprint collision, retry to find existing and update
          const target = prismaError?.meta?.target as string[] | undefined;
          if (target && target.includes("fingerprint")) {
            continue; // retry loop will find existing now
          }
          if (target && target.includes("short_id")) {
            continue; // retry with new shortId
          }
          // Generic unique violation - retry
          continue;
        }
        throw e;
      }
    } else {
      // Update existing issue - check if trace is distinct for traceCount
      const existingTrace = await tx.errorEvent.findFirst({
        where: { issueId: existing.id, traceId },
        select: { id: true },
      });
      const isNewTrace = !existingTrace;
      const newCount = existing.count + 1;
      const newTraceCount = isNewTrace ? existing.traceCount + 1 : existing.traceCount;
      const isEscalating = existing.status === "ARCHIVED" && newCount > existing.count * 3;

      // Query 24h count for priority: count events in last 24h for this issue
      const twentyFourHoursAgo = new Date(timestamp.getTime() - 24 * 60 * 60 * 1000);
      let count24h = newCount;
      try {
        count24h = await tx.errorEvent.count({
          where: { issueId: existing.id, timestamp: { gte: twentyFourHoursAgo } },
        });
        // Include current event if not yet counted (since we haven't created it)
        count24h = count24h + 1;
      } catch {
        count24h = newCount;
      }

      const newPriority = calcPriority({
        level: levelUpper,
        count24h,
        isEscalating,
        handled: params.handled ?? false,
      });

      await tx.errorIssue.update({
        where: { id: existing.id },
        data: {
          count: newCount,
          traceCount: newTraceCount,
          lastSeen: timestamp > existing.lastSeen ? timestamp : existing.lastSeen,
          lastTraceId: traceId,
          priority: newPriority,
          status: isEscalating ? "ESCALATING" : existing.status,
          updatedAt: new Date(),
        },
      });

      await tx.errorEvent.create({
        data: {
          id: observationId,
          issueId: existing.id,
          projectId,
          observationId,
          traceId,
          timestamp,
          errorType,
          errorValue,
          stacktrace: truncatedStacktrace,
          handled: params.handled ?? null,
          tags: params.tags ? (params.tags as unknown as Prisma.InputJsonValue) : undefined,
          expiresAt,
        },
      });
      return;
    }
  }

  // Fallback if retries exhausted - try once more with direct create and let it throw
  throw new Error("Failed to upsert ErrorIssue after retries");
}
