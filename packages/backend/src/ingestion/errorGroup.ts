import { createHash } from "crypto";

const KNOWN_BUCKETS = new Set([
  "rate_limit",
  "insufficient_quota",
  "context_length_exceeded",
  "overloaded",
  "auth_error",
  "timeout",
]);

export function normalizeErrorMessage(message: string): string {
  if (!message || typeof message !== "string") return "";
  let normalized = message.trim();

  // UUID
  normalized = normalized.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    "<uuid>",
  );
  // Email
  normalized = normalized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "<email>");
  // IP
  normalized = normalized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "<ip>");
  // Hex hash 32+ chars (after UUID to avoid double)
  normalized = normalized.replace(/\b[0-9a-f]{32,}\b/gi, "<hash>");
  // Numbers with 3+ digits (including inside tokens like 10000ms)
  normalized = normalized.replace(/\d{3,}/g, "<num>");

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();

  // Truncate
  if (normalized.length > 500) {
    normalized = normalized.slice(0, 500);
  }
  return normalized;
}

export function bucketStatusMessage(message: string): string {
  if (!message || typeof message !== "string") return "";
  const lower = message.toLowerCase();

  // Rate limit - check before quota since both may contain numbers
  if (
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("ratelimit") ||
    lower.includes("429") ||
    lower.includes("too many requests")
  ) {
    return "rate_limit";
  }
  if (
    lower.includes("insufficient_quota") ||
    lower.includes("insufficient quota") ||
    lower.includes("credit balance") ||
    lower.includes("billing quota") ||
    (lower.includes("quota exceeded") && !lower.includes("rate"))
  ) {
    return "insufficient_quota";
  }
  if (
    lower.includes("context_length") ||
    lower.includes("context length") ||
    lower.includes("maximum context")
  ) {
    return "context_length_exceeded";
  }
  if (lower.includes("overloaded")) {
    return "overloaded";
  }
  if (
    lower.includes("authentication") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api key") ||
    lower.includes("401")
  ) {
    return "auth_error";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "timeout";
  }

  // No bucket - return original (trimmed) message, but normalized whitespace already?
  // For consistency, return original message trimmed
  return message.trim();
}

export function parseErrorTypeAndValue(message: string): {
  errorType: string | null;
  errorValue: string;
} {
  if (!message || typeof message !== "string" || message.trim() === "") {
    return { errorType: null, errorValue: "" };
  }
  const trimmed = message.trim();
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx === -1) {
    return { errorType: null, errorValue: trimmed };
  }
  const errorType = trimmed.slice(0, colonIdx).trim();
  const errorValue = trimmed.slice(colonIdx + 1).trim();
  // If errorType is empty after trim, treat as no type
  if (!errorType) {
    return { errorType: null, errorValue: trimmed };
  }
  return { errorType, errorValue };
}

export function buildTitle(params: {
  toolName?: string;
  errorValue?: string;
  errorType?: string;
  name?: string;
}): string {
  const value =
    params.errorValue?.trim() || params.errorType?.trim() || params.name?.trim() || "Unknown error";
  let truncated = value;
  if (truncated.length > 120) {
    truncated = truncated.slice(0, 120);
  }
  if (params.toolName) {
    return `${params.toolName}: ${truncated}`;
  }
  return truncated;
}

export type FingerprintParams = {
  type: "TOOL" | "GENERATION" | "SPAN" | "CHAIN" | "EVENT";
  projectId: string;
  toolName?: string | null;
  name?: string | null;
  model?: string | null;
  statusMessage?: string | null;
  errorType?: string | null;
  errorValue?: string | null;
  stacktrace?: string | null;
};

export function fingerprintAny(params: FingerprintParams): string {
  const { type, projectId } = params;
  if (!projectId) throw new Error("projectId is required for fingerprint");
  if (!type) throw new Error("type is required for fingerprint");

  // Use original statusMessage for bucketing before normalization to preserve codes like 429/401
  const originalMessage = params.statusMessage || "";
  const bucketedOriginal = bucketStatusMessage(originalMessage);
  const isBucketed = KNOWN_BUCKETS.has(bucketedOriginal);

  if (type === "TOOL") {
    const toolName = params.toolName;
    if (!toolName || toolName.trim() === "") {
      throw new Error("toolName is mandatory for TOOL fingerprint");
    }
    // Prefer explicit errorType/errorValue if provided, else parse from original
    let errorType = params.errorType;
    let effectiveMessage = originalMessage;
    if (params.errorValue) {
      effectiveMessage = params.errorValue;
    } else if (!errorType) {
      const parsed = parseErrorTypeAndValue(originalMessage);
      errorType = parsed.errorType;
      // If parsed has errorValue, use that for effective (without type prefix)
      if (parsed.errorType && parsed.errorValue) {
        effectiveMessage = parsed.errorValue;
      }
    }
    errorType = errorType || "unknown";
    const effective = isBucketed ? bucketedOriginal : normalizeErrorMessage(effectiveMessage);
    const input = `${projectId}:TOOL:${toolName}:${errorType}:${effective}`;
    return createHash("sha256").update(input).digest("hex");
  }

  if (type === "GENERATION") {
    const model = params.model || params.name || "unknown";
    let errorType = params.errorType;
    let effectiveMessage = originalMessage;
    if (params.errorValue) {
      effectiveMessage = params.errorValue;
    } else if (!errorType) {
      const parsed = parseErrorTypeAndValue(originalMessage);
      if (parsed.errorType) {
        errorType = parsed.errorType;
        effectiveMessage = parsed.errorValue || originalMessage;
      }
    }
    errorType = errorType || "unknown";
    const effective = isBucketed ? bucketedOriginal : normalizeErrorMessage(effectiveMessage);
    const input = `${projectId}:GENERATION:${model}:${errorType}:${effective}`;
    return createHash("sha256").update(input).digest("hex");
  }

  if (type === "SPAN" || type === "CHAIN") {
    const name = params.name || "unknown";
    let errorType = params.errorType;
    let effectiveMessage = originalMessage;
    if (params.errorValue) {
      effectiveMessage = params.errorValue;
    }
    if (!errorType) {
      const parsed = parseErrorTypeAndValue(originalMessage);
      errorType = parsed.errorType;
      if (parsed.errorType && parsed.errorValue) {
        effectiveMessage = parsed.errorValue;
      }
    }
    errorType = errorType || "unknown";
    // For SPAN, check bucket on effectiveMessage original before normalize
    const bucketedEffective = bucketStatusMessage(effectiveMessage);
    const isEffectiveBucketed = KNOWN_BUCKETS.has(bucketedEffective);
    const effective = isEffectiveBucketed
      ? bucketedEffective
      : normalizeErrorMessage(effectiveMessage);
    const input = `${projectId}:${type}:${name}:${errorType}:${effective}`;
    return createHash("sha256").update(input).digest("hex");
  }

  if (type === "EVENT") {
    const name = params.name || "unknown";
    const effective = isBucketed ? bucketedOriginal : normalizeErrorMessage(originalMessage);
    const input = `${projectId}:EVENT:${name}:${effective}`;
    return createHash("sha256").update(input).digest("hex");
  }

  throw new Error(`Unsupported type for fingerprint: ${type}`);
}

export function calcPriority(params: {
  level?: string | null;
  count24h?: number;
  isEscalating?: boolean;
  handled?: boolean | null;
}): "HIGH" | "MEDIUM" | "LOW" {
  if (params.handled) return "LOW";
  if (params.isEscalating) return "HIGH";
  const count24h = params.count24h ?? 0;
  const level = params.level ? params.level.toUpperCase() : "DEFAULT";
  if (level === "ERROR" && count24h > 100) return "HIGH";
  if (level === "ERROR") return "MEDIUM";
  if (level === "WARNING") return "MEDIUM";
  if (level === "DEBUG") return "LOW";
  if (level === "DEFAULT") return "LOW";
  // Fallback for unknown levels
  return "MEDIUM";
}
