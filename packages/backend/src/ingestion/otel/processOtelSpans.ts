import { db } from "@lightrace/shared/db";
import { ObservationType, ObservationLevel } from "@prisma/client";
import { LangfuseOtelSpanAttributes } from "./attributes";

// ── Types ────────────────────────────────────────────────────────────

type NanoTimestamp = number | string | { high: number; low: number } | null | undefined;

interface OtelKeyValue {
  key: string;
  value: {
    stringValue?: string;
    intValue?: number | string;
    doubleValue?: number;
    boolValue?: boolean;
    arrayValue?: { values?: Array<{ stringValue?: string }> };
    bytesValue?: Uint8Array;
  };
}

interface OtelSpan {
  traceId: Buffer | Uint8Array | string;
  spanId: Buffer | Uint8Array | string;
  parentSpanId?: Buffer | Uint8Array | string;
  name: string;
  kind?: number;
  startTimeUnixNano?: NanoTimestamp;
  endTimeUnixNano?: NanoTimestamp;
  attributes?: OtelKeyValue[];
  status?: { code?: number; message?: string };
  events?: unknown[];
}

interface ScopeSpan {
  scope?: { name?: string; version?: string; attributes?: OtelKeyValue[] };
  spans?: OtelSpan[];
}

export interface ResourceSpan {
  resource?: { attributes?: OtelKeyValue[] };
  scopeSpans?: ScopeSpan[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function parseId(data: unknown): string {
  if (typeof data === "string") return data;
  if (data instanceof Uint8Array || Buffer.isBuffer(data)) {
    return Buffer.from(data).toString("hex");
  }
  if (Array.isArray(data)) {
    return Buffer.from(data).toString("hex");
  }
  if (data && typeof data === "object" && "data" in data) {
    return Buffer.from((data as { data: number[] }).data).toString("hex");
  }
  return "";
}

function convertNanoTimestampToISO(timestamp: NanoTimestamp): string | undefined {
  if (timestamp == null) return undefined;

  try {
    const NANOS_PER_MS = BigInt("1000000");
    if (typeof timestamp === "string") {
      const nanos = BigInt(timestamp);
      const ms = Number(nanos / NANOS_PER_MS);
      return new Date(ms).toISOString();
    }
    if (typeof timestamp === "number") {
      const ms = timestamp > 1e15 ? timestamp / 1e6 : timestamp;
      return new Date(ms).toISOString();
    }
    if (typeof timestamp === "object" && "high" in timestamp && "low" in timestamp) {
      const nanos = BigInt(timestamp.high) * BigInt("4294967296") + BigInt(timestamp.low >>> 0);
      const ms = Number(nanos / NANOS_PER_MS);
      return new Date(ms).toISOString();
    }
  } catch {
    // Fallthrough
  }
  return undefined;
}

function extractAttributeValue(value: OtelKeyValue["value"]): unknown {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.intValue !== undefined) {
    return typeof value.intValue === "string" ? parseInt(value.intValue, 10) : value.intValue;
  }
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.arrayValue?.values) {
    return value.arrayValue.values.map((v) => v.stringValue ?? "");
  }
  return undefined;
}

function extractAttributes(kvList?: OtelKeyValue[]): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  if (!kvList) return attrs;
  for (const kv of kvList) {
    if (kv.key && kv.value) {
      attrs[kv.key] = extractAttributeValue(kv.value);
    }
  }
  return attrs;
}

function safeJsonParse(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseLevel(level?: unknown): ObservationLevel {
  if (!level) return ObservationLevel.DEFAULT;
  const upper = String(level).toUpperCase();
  if (upper in ObservationLevel) return upper as ObservationLevel;
  return ObservationLevel.DEFAULT;
}

// ── Attribute extraction ──

function extractUserId(attrs: Record<string, unknown>): string | null {
  for (const key of [
    LangfuseOtelSpanAttributes.TRACE_COMPAT_USER_ID,
    LangfuseOtelSpanAttributes.TRACE_USER_ID,
  ]) {
    if (attrs[key]) return String(attrs[key]);
  }
  return null;
}

function extractSessionId(attrs: Record<string, unknown>): string | null {
  for (const key of [
    LangfuseOtelSpanAttributes.TRACE_COMPAT_SESSION_ID,
    LangfuseOtelSpanAttributes.TRACE_SESSION_ID,
    "gen_ai.conversation.id",
  ]) {
    if (attrs[key]) return String(attrs[key]);
  }
  return null;
}

function extractModelName(attrs: Record<string, unknown>): string | null {
  for (const key of [
    LangfuseOtelSpanAttributes.OBSERVATION_MODEL,
    "gen_ai.response.model",
    "gen_ai.request.model",
    "ai.model.id",
    "llm.response.model",
    "llm.model_name",
    "model",
  ]) {
    if (attrs[key]) return String(attrs[key]);
  }
  return null;
}

function extractObservationType(attrs: Record<string, unknown>): ObservationType {
  const explicitType = attrs[LangfuseOtelSpanAttributes.OBSERVATION_TYPE];
  if (explicitType) {
    const upper = String(explicitType).toUpperCase();
    if (upper === "GENERATION") return ObservationType.GENERATION;
    if (upper === "EVENT") return ObservationType.EVENT;
    if (upper === "SPAN") return ObservationType.SPAN;
  }

  const genAiOp = attrs["gen_ai.operation.name"];
  if (genAiOp === "chat" || genAiOp === "completion" || genAiOp === "text_completion") {
    return ObservationType.GENERATION;
  }

  if (extractModelName(attrs)) return ObservationType.GENERATION;

  return ObservationType.SPAN;
}

function extractUsageDetails(attrs: Record<string, unknown>): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  const rawUsage = attrs[LangfuseOtelSpanAttributes.OBSERVATION_USAGE_DETAILS];
  if (rawUsage) {
    const usage = safeJsonParse(rawUsage) as Record<string, number>;
    if (typeof usage === "object" && usage !== null) {
      return {
        promptTokens: usage.input ?? usage.promptTokens ?? 0,
        completionTokens: usage.output ?? usage.completionTokens ?? 0,
        totalTokens: usage.total ?? usage.totalTokens ?? 0,
      };
    }
  }

  const input =
    (attrs["gen_ai.usage.input_tokens"] as number) ??
    (attrs["gen_ai.usage.prompt_tokens"] as number) ??
    0;
  const output =
    (attrs["gen_ai.usage.output_tokens"] as number) ??
    (attrs["gen_ai.usage.completion_tokens"] as number) ??
    0;

  return {
    promptTokens: input,
    completionTokens: output,
    totalTokens: input + output,
  };
}

function extractCostDetails(attrs: Record<string, unknown>): {
  inputCost: number | null;
  outputCost: number | null;
  totalCost: number | null;
} {
  const rawCost = attrs[LangfuseOtelSpanAttributes.OBSERVATION_COST_DETAILS];
  if (rawCost) {
    const cost = safeJsonParse(rawCost) as Record<string, number>;
    if (typeof cost === "object" && cost !== null) {
      return {
        inputCost: cost.input ?? null,
        outputCost: cost.output ?? null,
        totalCost: cost.total ?? null,
      };
    }
  }
  return { inputCost: null, outputCost: null, totalCost: null };
}

function extractTags(attrs: Record<string, unknown>): string[] {
  const raw = attrs[LangfuseOtelSpanAttributes.TRACE_TAGS] ?? attrs["langfuse.tags"];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    const parsed = safeJsonParse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
    return raw.split(",").map((s) => s.trim());
  }
  return [];
}

function extractPublic(attrs: Record<string, unknown>): boolean {
  const value = attrs[LangfuseOtelSpanAttributes.TRACE_PUBLIC] ?? attrs["langfuse.public"];
  if (value == null) return false;
  return value === true || value === "true";
}

function extractMetadata(attrs: Record<string, unknown>, prefix: string): unknown {
  const raw = attrs[prefix];
  if (!raw) return undefined;
  return safeJsonParse(raw);
}

function extractCompletionStartTime(attrs: Record<string, unknown>): Date | null {
  const raw = attrs[LangfuseOtelSpanAttributes.OBSERVATION_COMPLETION_START_TIME];
  if (!raw) return null;
  try {
    let value = raw;
    if (typeof value === "string" && value.startsWith('"')) {
      value = JSON.parse(value);
    }
    const d = new Date(value as string);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function hasTraceUpdates(attrs: Record<string, unknown>): boolean {
  return !!(
    attrs[LangfuseOtelSpanAttributes.TRACE_NAME] ||
    attrs[LangfuseOtelSpanAttributes.TRACE_USER_ID] ||
    attrs[LangfuseOtelSpanAttributes.TRACE_COMPAT_USER_ID] ||
    attrs[LangfuseOtelSpanAttributes.TRACE_SESSION_ID] ||
    attrs[LangfuseOtelSpanAttributes.TRACE_COMPAT_SESSION_ID] ||
    attrs[LangfuseOtelSpanAttributes.TRACE_TAGS] ||
    attrs[LangfuseOtelSpanAttributes.TRACE_INPUT] ||
    attrs[LangfuseOtelSpanAttributes.TRACE_OUTPUT] ||
    attrs[LangfuseOtelSpanAttributes.TRACE_METADATA] ||
    attrs[LangfuseOtelSpanAttributes.TRACE_PUBLIC]
  );
}

// ── Ensure trace exists ──────────────────────────────────────────────

async function ensureTraceExists(traceId: string, projectId: string) {
  const existing = await db.trace.findUnique({ where: { id: traceId } });
  if (!existing) {
    await db.trace.create({
      data: { id: traceId, projectId, timestamp: new Date() },
    });
  }
}

// ── Trace update builder ─────────────────────────────────────────────

function buildTraceUpdate(
  attrs: Record<string, unknown>,
  traceName: string | null,
): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  if (traceName) update.name = traceName;
  const userId = extractUserId(attrs);
  if (userId) update.userId = userId;
  const sessionId = extractSessionId(attrs);
  if (sessionId) update.sessionId = sessionId;
  if (attrs[LangfuseOtelSpanAttributes.TRACE_METADATA]) {
    update.metadata = extractMetadata(attrs, LangfuseOtelSpanAttributes.TRACE_METADATA);
  }
  if (attrs[LangfuseOtelSpanAttributes.TRACE_INPUT]) {
    update.input = safeJsonParse(attrs[LangfuseOtelSpanAttributes.TRACE_INPUT]);
  }
  if (attrs[LangfuseOtelSpanAttributes.TRACE_OUTPUT]) {
    update.output = safeJsonParse(attrs[LangfuseOtelSpanAttributes.TRACE_OUTPUT]);
  }
  if (attrs[LangfuseOtelSpanAttributes.TRACE_TAGS]) {
    update.tags = extractTags(attrs);
  }
  if (attrs[LangfuseOtelSpanAttributes.TRACE_PUBLIC] != null) {
    update.public = extractPublic(attrs);
  }
  if (attrs[LangfuseOtelSpanAttributes.RELEASE]) {
    update.release = attrs[LangfuseOtelSpanAttributes.RELEASE] as string;
  }
  if (attrs[LangfuseOtelSpanAttributes.VERSION]) {
    update.version = attrs[LangfuseOtelSpanAttributes.VERSION] as string;
  }
  return update;
}

// ── Main processor ───────────────────────────────────────────────────

export async function processOtelResourceSpans(
  resourceSpans: ResourceSpan[],
  projectId: string,
): Promise<void> {
  if (!Array.isArray(resourceSpans) || resourceSpans.length === 0) return;

  for (const resourceSpan of resourceSpans) {
    if (!resourceSpan) continue;
    const resourceAttrs = extractAttributes(resourceSpan.resource?.attributes);

    for (const scopeSpan of resourceSpan.scopeSpans ?? []) {
      for (const span of scopeSpan.spans ?? []) {
        try {
          await processSpan(span, resourceAttrs, projectId);
        } catch (error) {
          console.error(
            `[otel] Error processing span ${parseId(span.spanId)}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    }
  }
}

async function processSpan(
  span: OtelSpan,
  _resourceAttrs: Record<string, unknown>,
  projectId: string,
): Promise<void> {
  const traceId = parseId(span.traceId);
  const spanId = parseId(span.spanId);
  const parentSpanId = span.parentSpanId ? parseId(span.parentSpanId) : null;

  if (!traceId || !spanId) return;

  const attrs = extractAttributes(span.attributes);
  const startTimeISO = convertNanoTimestampToISO(span.startTimeUnixNano);
  const endTimeISO = convertNanoTimestampToISO(span.endTimeUnixNano);

  const startTime = startTimeISO ? new Date(startTimeISO) : new Date();
  const endTime = endTimeISO ? new Date(endTimeISO) : null;

  const isRootSpan = !parentSpanId || String(attrs[LangfuseOtelSpanAttributes.AS_ROOT]) === "true";

  if (isRootSpan || hasTraceUpdates(attrs)) {
    const traceName =
      (attrs[LangfuseOtelSpanAttributes.TRACE_NAME] as string) ?? (isRootSpan ? span.name : null);

    await db.trace.upsert({
      where: { id: traceId },
      create: {
        id: traceId,
        projectId,
        timestamp: startTime,
        name: traceName ?? null,
        userId: extractUserId(attrs),
        sessionId: extractSessionId(attrs),
        metadata: extractMetadata(attrs, LangfuseOtelSpanAttributes.TRACE_METADATA) ?? undefined,
        input: safeJsonParse(attrs[LangfuseOtelSpanAttributes.TRACE_INPUT]) ?? undefined,
        output: safeJsonParse(attrs[LangfuseOtelSpanAttributes.TRACE_OUTPUT]) ?? undefined,
        tags: extractTags(attrs),
        public: extractPublic(attrs),
        release: (attrs[LangfuseOtelSpanAttributes.RELEASE] as string) ?? null,
        version: (attrs[LangfuseOtelSpanAttributes.VERSION] as string) ?? null,
      },
      update: buildTraceUpdate(attrs, traceName),
    });
  } else {
    await ensureTraceExists(traceId, projectId);
  }

  const type = extractObservationType(attrs);
  const usage = extractUsageDetails(attrs);
  const costs = extractCostDetails(attrs);
  const level =
    parseLevel(attrs[LangfuseOtelSpanAttributes.OBSERVATION_LEVEL]) ??
    (span.status?.code === 2 ? ObservationLevel.ERROR : ObservationLevel.DEFAULT);

  const observationData = {
    traceId,
    projectId,
    type,
    name: span.name ?? null,
    startTime,
    endTime,
    input: safeJsonParse(attrs[LangfuseOtelSpanAttributes.OBSERVATION_INPUT]) ?? undefined,
    output: safeJsonParse(attrs[LangfuseOtelSpanAttributes.OBSERVATION_OUTPUT]) ?? undefined,
    metadata: extractMetadata(attrs, LangfuseOtelSpanAttributes.OBSERVATION_METADATA) ?? undefined,
    model: extractModelName(attrs),
    modelParameters:
      safeJsonParse(attrs[LangfuseOtelSpanAttributes.OBSERVATION_MODEL_PARAMETERS]) ?? undefined,
    parentObservationId: parentSpanId,
    level,
    statusMessage:
      (attrs[LangfuseOtelSpanAttributes.OBSERVATION_STATUS_MESSAGE] as string) ??
      span.status?.message ??
      null,
    completionStartTime: extractCompletionStartTime(attrs),
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    inputCost: costs.inputCost,
    outputCost: costs.outputCost,
    totalCost: costs.totalCost,
    version: (attrs[LangfuseOtelSpanAttributes.VERSION] as string) ?? null,
  };

  await db.observation.upsert({
    where: { id: spanId },
    create: { id: spanId, ...observationData },
    update: observationData,
  });
}
