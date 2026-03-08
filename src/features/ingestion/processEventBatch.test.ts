import { describe, it, expect, vi, beforeEach } from "vitest";
import { processEventBatch } from "./processEventBatch";

// Mock db
const mockUpsert = vi.fn().mockResolvedValue({});
const mockCreate = vi.fn().mockResolvedValue({});
const mockFindUnique = vi.fn().mockResolvedValue(null);

vi.mock("@/server/db", () => ({
  db: {
    trace: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    observation: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
    score: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

describe("processEventBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
  });

  it("should process an empty batch", async () => {
    const result = await processEventBatch([], "project-1");
    expect(result.successes).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should process a trace-create event", async () => {
    const events = [
      {
        id: "evt-1",
        type: "trace-create",
        timestamp: "2024-01-01T00:00:00Z",
        body: {
          id: "trace-1",
          name: "test trace",
          input: { prompt: "hello" },
          tags: ["test"],
        },
      },
    ];

    const result = await processEventBatch(events, "project-1");

    expect(result.successes).toHaveLength(1);
    expect(result.successes[0]).toEqual({ id: "evt-1", status: 201 });
    expect(result.errors).toHaveLength(0);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("should process a generation-create event and auto-create trace", async () => {
    const events = [
      {
        id: "evt-1",
        type: "generation-create",
        timestamp: "2024-01-01T00:00:00Z",
        body: {
          id: "gen-1",
          traceId: "trace-1",
          name: "GPT-4 Call",
          model: "gpt-4",
          startTime: "2024-01-01T00:00:00Z",
          endTime: "2024-01-01T00:00:01Z",
          usage: { input: 10, output: 20, total: 30 },
        },
      },
    ];

    const result = await processEventBatch(events, "project-1");

    expect(result.successes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    // Should have created the trace (findUnique returns null) + upserted observation
    expect(mockCreate).toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("should process a span-create event", async () => {
    // Trace already exists
    mockFindUnique.mockResolvedValue({ id: "trace-1" });

    const events = [
      {
        id: "evt-1",
        type: "span-create",
        timestamp: "2024-01-01T00:00:00Z",
        body: {
          id: "span-1",
          traceId: "trace-1",
          name: "retrieval",
          startTime: "2024-01-01T00:00:00Z",
        },
      },
    ];

    const result = await processEventBatch(events, "project-1");

    expect(result.successes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should process a score-create event", async () => {
    mockFindUnique.mockResolvedValue({ id: "trace-1" });

    const events = [
      {
        id: "evt-1",
        type: "score-create",
        timestamp: "2024-01-01T00:00:00Z",
        body: {
          traceId: "trace-1",
          name: "accuracy",
          value: 0.95,
        },
      },
    ];

    const result = await processEventBatch(events, "project-1");

    expect(result.successes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle sdk-log events by acknowledging them", async () => {
    const events = [
      {
        id: "evt-1",
        type: "sdk-log",
        timestamp: "2024-01-01T00:00:00Z",
        body: { message: "SDK initialized" },
      },
    ];

    const result = await processEventBatch(events, "project-1");

    expect(result.successes).toHaveLength(1);
    expect(result.successes[0]).toEqual({ id: "evt-1", status: 201 });
  });

  it("should return validation errors for invalid events", async () => {
    const events = [
      {
        id: "evt-bad",
        type: "invalid-type-that-does-not-exist",
        timestamp: "2024-01-01T00:00:00Z",
        body: {},
      },
    ];

    const result = await processEventBatch(events, "project-1");

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].id).toBe("evt-bad");
    expect(result.errors[0].status).toBe(400);
    expect(result.successes).toHaveLength(0);
  });

  it("should handle mixed success and error events in a batch", async () => {
    mockFindUnique.mockResolvedValue({ id: "trace-1" });

    const events = [
      {
        id: "evt-1",
        type: "trace-create",
        timestamp: "2024-01-01T00:00:00Z",
        body: { id: "trace-1", name: "good trace" },
      },
      {
        id: "evt-2",
        type: "bad-type",
        timestamp: "2024-01-01T00:00:00Z",
        body: {},
      },
      {
        id: "evt-3",
        type: "score-create",
        timestamp: "2024-01-01T00:00:00Z",
        body: { traceId: "trace-1", name: "score", value: 1.0 },
      },
    ];

    const result = await processEventBatch(events, "project-1");

    expect(result.successes).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].id).toBe("evt-2");
  });

  it("should handle database errors gracefully", async () => {
    mockUpsert.mockRejectedValueOnce(new Error("Connection refused"));

    const events = [
      {
        id: "evt-1",
        type: "trace-create",
        timestamp: "2024-01-01T00:00:00Z",
        body: { id: "trace-1", name: "failing trace" },
      },
    ];

    const result = await processEventBatch(events, "project-1");

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].status).toBe(500);
    expect(result.errors[0].message).toContain("Connection refused");
  });

  it("should process a span-update event", async () => {
    mockFindUnique.mockResolvedValue({ id: "trace-1" });

    const events = [
      {
        id: "evt-1",
        type: "span-update",
        timestamp: "2024-01-01T00:00:01Z",
        body: {
          id: "span-1",
          traceId: "trace-1",
          endTime: "2024-01-01T00:00:01.000Z",
          output: { results: [1, 2, 3] },
        },
      },
    ];

    const result = await processEventBatch(events, "project-1");

    expect(result.successes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should process a generation-update event", async () => {
    mockFindUnique.mockResolvedValue({ id: "trace-1" });

    const events = [
      {
        id: "evt-1",
        type: "generation-update",
        timestamp: "2024-01-01T00:00:01Z",
        body: {
          id: "gen-1",
          traceId: "trace-1",
          endTime: "2024-01-01T00:00:02.000Z",
          output: { role: "assistant", content: "updated" },
          usage: { input: 50, output: 100 },
        },
      },
    ];

    const result = await processEventBatch(events, "project-1");

    expect(result.successes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should process observation-create as SPAN", async () => {
    mockFindUnique.mockResolvedValue({ id: "trace-1" });

    const events = [
      {
        id: "evt-1",
        type: "observation-create",
        timestamp: "2024-01-01T00:00:00Z",
        body: {
          id: "obs-1",
          traceId: "trace-1",
          name: "legacy observation",
        },
      },
    ];

    const result = await processEventBatch(events, "project-1");

    expect(result.successes).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("should extract event id from raw event for error reporting", async () => {
    const events = [
      {
        id: "known-id",
        type: "totally-bogus",
        timestamp: "bad",
        body: null,
      },
    ];

    const result = await processEventBatch(events, "project-1");

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].id).toBe("known-id");
  });
});
