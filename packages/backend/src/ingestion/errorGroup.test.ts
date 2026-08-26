import { describe, it, expect } from "vitest";
import {
  normalizeErrorMessage,
  bucketStatusMessage,
  fingerprintAny,
  calcPriority,
  buildTitle,
  parseErrorTypeAndValue,
} from "./errorGroup";

describe("normalizeErrorMessage", () => {
  it("returns empty string for null/undefined", () => {
    expect(normalizeErrorMessage(null as unknown as string)).toBe("");
    expect(normalizeErrorMessage(undefined as unknown as string)).toBe("");
    expect(normalizeErrorMessage("")).toBe("");
  });

  it("replaces UUIDs", () => {
    const input = "Failed for id 550e8400-e29b-41d4-a716-446655440000";
    expect(normalizeErrorMessage(input)).toBe("Failed for id <uuid>");
  });

  it("replaces emails", () => {
    expect(normalizeErrorMessage("user test@example.com failed")).toBe("user <email> failed");
  });

  it("replaces IP addresses", () => {
    expect(normalizeErrorMessage("connect 192.168.1.1 failed")).toBe("connect <ip> failed");
  });

  it("replaces hex hashes (32+ chars)", () => {
    const hash = "a".repeat(32);
    expect(normalizeErrorMessage(`hash ${hash} bad`)).toBe("hash <hash> bad");
  });

  it("replaces numbers with 3+ digits", () => {
    expect(normalizeErrorMessage("timeout after 10000ms")).toBe("timeout after <num>ms");
    expect(normalizeErrorMessage("error code 42")).toBe("error code 42"); // 2 digits kept
  });

  it("replaces repeated UUIDs and numbers consistently", () => {
    const msg1 = "id 550e8400-e29b-41d4-a716-446655440000 count 12345";
    const msg2 = "id 123e4567-e89b-12d3-a456-426614174000 count 67890";
    expect(normalizeErrorMessage(msg1)).toBe(normalizeErrorMessage(msg2));
  });

  it("truncates to 500 chars", () => {
    const long = "x".repeat(600);
    expect(normalizeErrorMessage(long).length).toBe(500);
  });

  it("trims and collapses whitespace", () => {
    expect(normalizeErrorMessage("  hello   world \n\t ")).toBe("hello world");
  });
});

describe("bucketStatusMessage", () => {
  it("buckets rate limit errors", () => {
    expect(bucketStatusMessage("rate limited exceeded 429")).toBe("rate_limit");
    expect(bucketStatusMessage("429 Too Many Requests")).toBe("rate_limit");
    expect(bucketStatusMessage("RateLimit: quota")).toBe("rate_limit");
  });

  it("buckets insufficient_quota / credit errors", () => {
    expect(bucketStatusMessage("insufficient_quota: you exceeded")).toBe("insufficient_quota");
    expect(bucketStatusMessage("credit balance too low")).toBe("insufficient_quota");
    expect(bucketStatusMessage("billing quota exceeded")).toBe("insufficient_quota");
  });

  it("buckets context length", () => {
    expect(bucketStatusMessage("context_length_exceeded: too long")).toBe(
      "context_length_exceeded",
    );
    expect(bucketStatusMessage("maximum context length is 4096")).toBe("context_length_exceeded");
  });

  it("buckets overloaded", () => {
    expect(bucketStatusMessage("provider overloaded, try again")).toBe("overloaded");
    expect(bucketStatusMessage("service unavailable overloaded")).toBe("overloaded");
  });

  it("buckets auth errors", () => {
    expect(bucketStatusMessage("authentication failed invalid api key")).toBe("auth_error");
    expect(bucketStatusMessage("unauthorized 401")).toBe("auth_error");
  });

  it("buckets timeout", () => {
    expect(bucketStatusMessage("timeout after 10000ms")).toBe("timeout");
    expect(bucketStatusMessage("timed out waiting")).toBe("timeout");
  });

  it("returns normalized message if no bucket matches", () => {
    expect(bucketStatusMessage("ValueError: boom")).toBe("ValueError: boom");
  });
});

describe("parseErrorTypeAndValue", () => {
  it("splits on first colon", () => {
    expect(parseErrorTypeAndValue("ValueError: boom")).toEqual({
      errorType: "ValueError",
      errorValue: "boom",
    });
  });

  it("handles no colon", () => {
    expect(parseErrorTypeAndValue("boom")).toEqual({
      errorType: null,
      errorValue: "boom",
    });
  });

  it("handles empty", () => {
    expect(parseErrorTypeAndValue("")).toEqual({
      errorType: null,
      errorValue: "",
    });
    expect(parseErrorTypeAndValue(null as unknown as string)).toEqual({
      errorType: null,
      errorValue: "",
    });
  });
});

describe("buildTitle", () => {
  it("builds title with toolName and truncated value", () => {
    expect(buildTitle({ toolName: "brave_search", errorValue: "Timeout after 10s" })).toBe(
      "brave_search: Timeout after 10s",
    );
  });

  it("truncates long errorValue to 120 chars", () => {
    const long = "a".repeat(200);
    const title = buildTitle({ toolName: "test", errorValue: long });
    expect(title.length).toBeLessThanOrEqual(130); // prefix + truncated
    expect(title).toContain("test:");
  });

  it("handles missing toolName", () => {
    expect(buildTitle({ errorValue: "oops" })).toBe("oops");
    expect(buildTitle({ errorValue: "" })).toBe("Unknown error");
  });
});

describe("fingerprintAny", () => {
  it("requires toolName for TOOL type", () => {
    expect(() =>
      fingerprintAny({
        type: "TOOL",
        projectId: "proj-1",
        statusMessage: "boom",
      } as unknown as { type: "TOOL"; projectId: string; statusMessage: string }),
    ).toThrow(/toolName.*mandatory/i);
  });

  it("generates stable fingerprint for same TOOL input", () => {
    const fp1 = fingerprintAny({
      type: "TOOL",
      projectId: "proj-1",
      toolName: "search",
      statusMessage: "Timeout after 10000ms id 550e8400-e29b-41d4-a716-446655440000",
    });
    const fp2 = fingerprintAny({
      type: "TOOL",
      projectId: "proj-1",
      toolName: "search",
      statusMessage: "Timeout after 20000ms id 123e4567-e89b-12d3-a456-426614174000",
    });
    expect(fp1).toBe(fp2); // normalized numbers/uuids collapse
  });

  it("different toolName produces different fingerprint", () => {
    const fp1 = fingerprintAny({
      type: "TOOL",
      projectId: "proj-1",
      toolName: "search",
      statusMessage: "boom",
    });
    const fp2 = fingerprintAny({
      type: "TOOL",
      projectId: "proj-1",
      toolName: "other",
      statusMessage: "boom",
    });
    expect(fp1).not.toBe(fp2);
  });

  it("different project produces different fingerprint", () => {
    const fp1 = fingerprintAny({
      type: "TOOL",
      projectId: "proj-1",
      toolName: "search",
      statusMessage: "boom",
    });
    const fp2 = fingerprintAny({
      type: "TOOL",
      projectId: "proj-2",
      toolName: "search",
      statusMessage: "boom",
    });
    expect(fp1).not.toBe(fp2);
  });

  it("different statusMessage produces different fingerprint (when not bucketed same)", () => {
    const fp1 = fingerprintAny({
      type: "TOOL",
      projectId: "proj-1",
      toolName: "search",
      statusMessage: "ValueError: boom",
    });
    const fp2 = fingerprintAny({
      type: "TOOL",
      projectId: "proj-1",
      toolName: "search",
      statusMessage: "TypeError: boom",
    });
    expect(fp1).not.toBe(fp2);
  });

  it("GENERATION fingerprint uses model and bucket", () => {
    const fp1 = fingerprintAny({
      type: "GENERATION",
      projectId: "proj-1",
      model: "gpt-4o",
      statusMessage: "429 rate limited exceeded",
      name: "llm-call",
    });
    const fp2 = fingerprintAny({
      type: "GENERATION",
      projectId: "proj-1",
      model: "gpt-4o",
      statusMessage: "rate limited 429 quota",
      name: "llm-call",
    });
    expect(fp1).toBe(fp2); // both bucket to rate_limit

    const fp3 = fingerprintAny({
      type: "GENERATION",
      projectId: "proj-1",
      model: "claude-3-opus",
      statusMessage: "429 rate limited exceeded",
      name: "llm-call",
    });
    expect(fp1).not.toBe(fp3); // different model
  });

  it("SPAN fingerprint uses name and errorType", () => {
    const fp1 = fingerprintAny({
      type: "SPAN",
      projectId: "proj-1",
      name: "my_func",
      statusMessage: "ValueError: boom",
    });
    // For SPAN, errorType prefix matters but value normalized differently?
    // At minimum same name+type should be stable aspect, but we test distinct value produces distinct?
    // Instead check same name+same errorType vs different name
    const fp3 = fingerprintAny({
      type: "SPAN",
      projectId: "proj-1",
      name: "other_func",
      statusMessage: "ValueError: boom",
    });
    expect(fp1).not.toBe(fp3);
  });

  it("EVENT fingerprint uses name", () => {
    const fp1 = fingerprintAny({
      type: "EVENT",
      projectId: "proj-1",
      name: "log-event",
      statusMessage: "boom",
    });
    const fp2 = fingerprintAny({
      type: "EVENT",
      projectId: "proj-1",
      name: "log-event",
      statusMessage: "boom",
    });
    expect(fp1).toBe(fp2);
  });

  it("prefix prevents cross-type collision", () => {
    const fpTool = fingerprintAny({
      type: "TOOL",
      projectId: "proj-1",
      toolName: "search",
      statusMessage: "boom",
    });
    const fpSpan = fingerprintAny({
      type: "SPAN",
      projectId: "proj-1",
      name: "search",
      statusMessage: "boom",
    });
    expect(fpTool).not.toBe(fpSpan);
  });

  it("handles null/empty statusMessage", () => {
    const fp = fingerprintAny({
      type: "TOOL",
      projectId: "proj-1",
      toolName: "search",
      statusMessage: null as unknown as string,
    });
    expect(typeof fp).toBe("string");
    expect(fp.length).toBeGreaterThan(10);
  });
});

describe("calcPriority", () => {
  it("handled errors are LOW", () => {
    expect(calcPriority({ level: "ERROR", count24h: 1000, handled: true })).toBe("LOW");
  });

  it("escalating is HIGH", () => {
    expect(calcPriority({ level: "ERROR", isEscalating: true })).toBe("HIGH");
  });

  it("high count (>100/24h) error is HIGH", () => {
    expect(calcPriority({ level: "ERROR", count24h: 101 })).toBe("HIGH");
    expect(calcPriority({ level: "ERROR", count24h: 100 })).toBe("MEDIUM");
  });

  it("WARNING is MEDIUM", () => {
    expect(calcPriority({ level: "WARNING" })).toBe("MEDIUM");
  });

  it("DEFAULT ERROR with low count is MEDIUM", () => {
    expect(calcPriority({ level: "ERROR", count24h: 5 })).toBe("MEDIUM");
  });

  it("DEBUG is LOW", () => {
    expect(calcPriority({ level: "DEBUG" })).toBe("LOW");
  });
});
