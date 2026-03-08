import { describe, it, expect } from "vitest";
import { ingestionEvent, ingestionBatchSchema, normalizeUsage } from "./schemas";

describe("ingestionEvent schema", () => {
  it("should validate a trace-create event", () => {
    const event = {
      id: "evt-1",
      type: "trace-create",
      timestamp: "2024-01-01T00:00:00Z",
      body: {
        id: "trace-1",
        name: "test trace",
        input: { prompt: "hello" },
        output: { response: "world" },
        tags: ["test"],
      },
    };

    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("should validate a generation-create event", () => {
    const event = {
      id: "evt-2",
      type: "generation-create",
      timestamp: "2024-01-01T00:00:00Z",
      body: {
        id: "gen-1",
        traceId: "trace-1",
        name: "GPT-4 Call",
        model: "gpt-4",
        input: [{ role: "user", content: "hello" }],
        output: { role: "assistant", content: "world" },
        startTime: "2024-01-01T00:00:00.100Z",
        endTime: "2024-01-01T00:00:01.500Z",
        usage: { input: 10, output: 20, total: 30 },
      },
    };

    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("should validate a generation-create event with legacy usage format", () => {
    const event = {
      id: "evt-3",
      type: "generation-create",
      timestamp: "2024-01-01T00:00:00Z",
      body: {
        id: "gen-2",
        traceId: "trace-1",
        name: "Legacy Call",
        model: "gpt-3.5-turbo",
        usage: {
          promptTokens: 100,
          completionTokens: 200,
          totalTokens: 300,
        },
      },
    };

    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("should validate a span-create event", () => {
    const event = {
      id: "evt-4",
      type: "span-create",
      timestamp: "2024-01-01T00:00:00Z",
      body: {
        id: "span-1",
        traceId: "trace-1",
        name: "retrieval",
        startTime: "2024-01-01T00:00:00Z",
        endTime: "2024-01-01T00:00:00.500Z",
        metadata: { source: "vector-db" },
      },
    };

    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("should validate a span-update event", () => {
    const event = {
      id: "evt-5",
      type: "span-update",
      timestamp: "2024-01-01T00:00:01Z",
      body: {
        id: "span-1",
        endTime: "2024-01-01T00:00:01.000Z",
        output: { results: [1, 2, 3] },
      },
    };

    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("should validate an event-create event", () => {
    const event = {
      id: "evt-6",
      type: "event-create",
      timestamp: "2024-01-01T00:00:00Z",
      body: {
        id: "event-1",
        traceId: "trace-1",
        name: "user-feedback",
        input: { rating: 5 },
      },
    };

    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("should validate a score-create event", () => {
    const event = {
      id: "evt-7",
      type: "score-create",
      timestamp: "2024-01-01T00:00:00Z",
      body: {
        traceId: "trace-1",
        name: "accuracy",
        value: 0.95,
        comment: "looks good",
      },
    };

    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("should validate an sdk-log event", () => {
    const event = {
      id: "evt-8",
      type: "sdk-log",
      timestamp: "2024-01-01T00:00:00Z",
      body: { message: "SDK initialized" },
    };

    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(true);
  });

  it("should reject an event with unknown type", () => {
    const event = {
      id: "evt-bad",
      type: "unknown-type",
      timestamp: "2024-01-01T00:00:00Z",
      body: {},
    };

    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("should reject an event without id", () => {
    const event = {
      type: "trace-create",
      timestamp: "2024-01-01T00:00:00Z",
      body: { name: "test" },
    };

    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(false);
  });

  it("should validate a generation-create with cost fields", () => {
    const event = {
      id: "evt-cost",
      type: "generation-create",
      timestamp: "2024-01-01T00:00:00Z",
      body: {
        id: "gen-cost",
        model: "gpt-4",
        usage: {
          input: 1000,
          output: 500,
          inputCost: 0.03,
          outputCost: 0.06,
          totalCost: 0.09,
        },
      },
    };

    const result = ingestionEvent.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe("ingestionBatchSchema", () => {
  it("should validate a batch with multiple events", () => {
    const batch = {
      batch: [
        {
          id: "evt-1",
          type: "trace-create",
          timestamp: "2024-01-01T00:00:00Z",
          body: { id: "trace-1", name: "test" },
        },
        {
          id: "evt-2",
          type: "generation-create",
          timestamp: "2024-01-01T00:00:00Z",
          body: { id: "gen-1", traceId: "trace-1" },
        },
      ],
      metadata: { sdk_name: "langfuse-python", sdk_version: "2.0.0" },
    };

    const result = ingestionBatchSchema.safeParse(batch);
    expect(result.success).toBe(true);
  });

  it("should validate a batch without metadata", () => {
    const batch = {
      batch: [
        {
          id: "evt-1",
          type: "trace-create",
          timestamp: "2024-01-01T00:00:00Z",
          body: { name: "test" },
        },
      ],
    };

    const result = ingestionBatchSchema.safeParse(batch);
    expect(result.success).toBe(true);
  });

  it("should reject a batch without batch array", () => {
    const result = ingestionBatchSchema.safeParse({ events: [] });
    expect(result.success).toBe(false);
  });

  it("should validate an empty batch", () => {
    const result = ingestionBatchSchema.safeParse({ batch: [] });
    expect(result.success).toBe(true);
  });
});

describe("normalizeUsage", () => {
  it("should normalize new format (input/output/total)", () => {
    const result = normalizeUsage({ input: 10, output: 20, total: 30 });
    expect(result).toEqual({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      inputCost: null,
      outputCost: null,
      totalCost: null,
    });
  });

  it("should normalize legacy format (promptTokens/completionTokens)", () => {
    const result = normalizeUsage({
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
    });
    expect(result).toEqual({
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
      inputCost: null,
      outputCost: null,
      totalCost: null,
    });
  });

  it("should calculate totalTokens if not provided", () => {
    const result = normalizeUsage({ input: 50, output: 75 });
    expect(result.totalTokens).toBe(125);
  });

  it("should handle null usage", () => {
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

  it("should handle undefined usage", () => {
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

  it("should preserve cost fields", () => {
    const result = normalizeUsage({
      input: 1000,
      output: 500,
      inputCost: 0.03,
      outputCost: 0.06,
      totalCost: 0.09,
    });
    expect(result.inputCost).toBe(0.03);
    expect(result.outputCost).toBe(0.06);
    expect(result.totalCost).toBe(0.09);
  });

  it("should prefer legacy fields over new fields", () => {
    const result = normalizeUsage({
      input: 10,
      output: 20,
      promptTokens: 100,
      completionTokens: 200,
    });
    expect(result.promptTokens).toBe(100);
    expect(result.completionTokens).toBe(200);
  });
});
