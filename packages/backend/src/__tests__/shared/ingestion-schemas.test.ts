import { describe, it, expect } from "vitest";
import { normalizeUsage, ingestionEvent } from "@lightrace/shared/schemas/ingestion";

describe("normalizeUsage", () => {
  it("returns zeros and null costs for null input", () => {
    const result = normalizeUsage(null);
    expect(result).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      inputCost: null,
      outputCost: null,
      totalCost: null,
    });
  });

  it("returns zeros and null costs for undefined input", () => {
    const result = normalizeUsage(undefined);
    expect(result).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      inputCost: null,
      outputCost: null,
      totalCost: null,
    });
  });

  it("maps promptTokens/completionTokens format and computes total", () => {
    const result = normalizeUsage({ promptTokens: 100, completionTokens: 50 });
    expect(result.promptTokens).toBe(100);
    expect(result.completionTokens).toBe(50);
    expect(result.totalTokens).toBe(150);
  });

  it("maps input/output format to promptTokens/completionTokens", () => {
    const result = normalizeUsage({ input: 200, output: 100 });
    expect(result.promptTokens).toBe(200);
    expect(result.completionTokens).toBe(100);
    expect(result.totalTokens).toBe(300);
  });

  it("uses explicit totalTokens/total when present", () => {
    const result = normalizeUsage({ promptTokens: 10, completionTokens: 5, totalTokens: 999 });
    expect(result.totalTokens).toBe(999);

    const result2 = normalizeUsage({ input: 10, output: 5, total: 888 });
    expect(result2.totalTokens).toBe(888);
  });

  it("preserves cost fields when present", () => {
    const result = normalizeUsage({
      inputCost: 0.01,
      outputCost: 0.02,
      totalCost: 0.03,
    });
    expect(result.inputCost).toBe(0.01);
    expect(result.outputCost).toBe(0.02);
    expect(result.totalCost).toBe(0.03);
  });

  it("defaults absent costs to null", () => {
    const result = normalizeUsage({ promptTokens: 100 });
    expect(result.inputCost).toBeNull();
    expect(result.outputCost).toBeNull();
    expect(result.totalCost).toBeNull();
  });

  it("promptTokens takes precedence over input", () => {
    const result = normalizeUsage({ promptTokens: 200, input: 100 });
    expect(result.promptTokens).toBe(200);
  });
});

describe("ingestionEvent Zod schema", () => {
  it("parses a valid trace-create event", () => {
    const event = {
      id: "evt-1",
      type: "trace-create",
      timestamp: "2026-01-01T00:00:00Z",
      body: { id: "trace-1", name: "my-trace" },
    };
    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("parses a valid generation-create event with usage", () => {
    const event = {
      id: "evt-2",
      type: "generation-create",
      timestamp: "2026-01-01T00:00:00Z",
      body: {
        id: "obs-1",
        model: "gpt-4",
        usage: { promptTokens: 100, completionTokens: 50 },
      },
    };
    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("parses sdk-log events", () => {
    const event = {
      id: "evt-3",
      type: "sdk-log",
      timestamp: "2026-01-01T00:00:00Z",
      body: { message: "test log" },
    };
    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("rejects invalid event type", () => {
    const event = {
      id: "evt-4",
      type: "invalid-type",
      timestamp: "2026-01-01T00:00:00Z",
      body: {},
    };
    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("rejects event missing required id field", () => {
    const event = {
      type: "trace-create",
      timestamp: "2026-01-01T00:00:00Z",
      body: { name: "test" },
    };
    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("parses all observation event types", () => {
    const types = [
      "span-create",
      "span-update",
      "generation-create",
      "generation-update",
      "event-create",
      "tool-create",
      "tool-update",
      "chain-create",
      "chain-update",
      "observation-create",
      "observation-update",
    ];

    for (const type of types) {
      const event = {
        id: `evt-${type}`,
        type,
        timestamp: "2026-01-01T00:00:00Z",
        body: { id: "obs-1" },
      };
      const result = ingestionEvent.safeParse(event);
      expect(result.success, `Expected ${type} to parse`).toBe(true);
    }
  });
});
