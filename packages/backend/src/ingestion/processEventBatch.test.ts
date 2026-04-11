import { describe, it, expect } from "vitest";
import { db } from "@lightrace/shared/db";
import { processEventBatch } from "./processEventBatch";
import { createTestProject } from "../__tests__/helpers";

describe("processEventBatch", () => {
  // ── trace-create ──────────────────────────────────────────────────

  describe("trace-create", () => {
    it("creates a trace with all fields", async () => {
      const project = await createTestProject();
      const result = await processEventBatch(
        [
          {
            id: "trace-1",
            type: "trace-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: {
              id: "trace-1",
              name: "my-trace",
              tags: ["tag1", "tag2"],
              sessionId: "sess-1",
              userId: "user-1",
              input: { prompt: "hello" },
              output: { response: "world" },
              metadata: { key: "value" },
              public: true,
            },
          },
        ],
        project.id,
      );

      expect(result.successes).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const trace = await db.trace.findUnique({ where: { id: "trace-1" } });
      expect(trace).not.toBeNull();
      expect(trace!.name).toBe("my-trace");
      expect(trace!.tags).toEqual(["tag1", "tag2"]);
      expect(trace!.sessionId).toBe("sess-1");
      expect(trace!.userId).toBe("user-1");
      expect(trace!.input).toEqual({ prompt: "hello" });
      expect(trace!.output).toEqual({ response: "world" });
      expect(trace!.public).toBe(true);
    });

    it("upserts: updates only provided fields", async () => {
      const project = await createTestProject();
      // Create initial trace
      await processEventBatch(
        [
          {
            id: "trace-1",
            type: "trace-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: { id: "trace-1", name: "original", tags: ["tag1"] },
          },
        ],
        project.id,
      );

      // Update only the name
      await processEventBatch(
        [
          {
            id: "trace-1",
            type: "trace-create",
            timestamp: "2026-01-02T00:00:00Z",
            body: { id: "trace-1", name: "updated" },
          },
        ],
        project.id,
      );

      const trace = await db.trace.findUnique({ where: { id: "trace-1" } });
      expect(trace!.name).toBe("updated");
      expect(trace!.tags).toEqual(["tag1"]); // unchanged
    });

    it("uses event-level id when body.id is absent", async () => {
      const project = await createTestProject();
      await processEventBatch(
        [
          {
            id: "evt-id-fallback",
            type: "trace-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: { name: "no-body-id" },
          },
        ],
        project.id,
      );

      const trace = await db.trace.findUnique({ where: { id: "evt-id-fallback" } });
      expect(trace).not.toBeNull();
      expect(trace!.name).toBe("no-body-id");
    });
  });

  // ── observation types ──────────────────────────────────────────────

  describe("observation types", () => {
    it("span-create creates SPAN observation and implicit trace", async () => {
      const project = await createTestProject();
      await processEventBatch(
        [
          {
            id: "trace-1",
            type: "span-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: { id: "obs-1", traceId: "trace-1", name: "my-span" },
          },
        ],
        project.id,
      );

      const obs = await db.observation.findUnique({ where: { id: "obs-1" } });
      expect(obs).not.toBeNull();
      expect(obs!.type).toBe("SPAN");
      expect(obs!.name).toBe("my-span");

      // Implicit trace was created
      const trace = await db.trace.findUnique({ where: { id: "trace-1" } });
      expect(trace).not.toBeNull();
      expect(trace!.observationCount).toBe(1);
    });

    it("generation-create creates GENERATION with usage and model", async () => {
      const project = await createTestProject();
      await processEventBatch(
        [
          {
            id: "trace-1",
            type: "generation-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: {
              id: "gen-1",
              traceId: "trace-1",
              name: "llm-call",
              model: "gpt-4o",
              usage: { promptTokens: 100, completionTokens: 50 },
            },
          },
        ],
        project.id,
      );

      const obs = await db.observation.findUnique({ where: { id: "gen-1" } });
      expect(obs!.type).toBe("GENERATION");
      expect(obs!.model).toBe("gpt-4o");
      expect(obs!.promptTokens).toBe(100);
      expect(obs!.completionTokens).toBe(50);
      expect(obs!.totalTokens).toBe(150);

      const trace = await db.trace.findUnique({ where: { id: "trace-1" } });
      expect(trace!.totalTokens).toBe(150);
      expect(trace!.primaryModel).toBe("gpt-4o");
    });

    it("event-create creates EVENT observation", async () => {
      const project = await createTestProject();
      await processEventBatch(
        [
          {
            id: "trace-1",
            type: "event-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: { id: "ev-1", traceId: "trace-1", name: "log-event" },
          },
        ],
        project.id,
      );
      const obs = await db.observation.findUnique({ where: { id: "ev-1" } });
      expect(obs!.type).toBe("EVENT");
    });

    it("tool-create creates TOOL observation", async () => {
      const project = await createTestProject();
      await processEventBatch(
        [
          {
            id: "trace-1",
            type: "tool-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: { id: "tool-1", traceId: "trace-1", name: "search" },
          },
        ],
        project.id,
      );
      const obs = await db.observation.findUnique({ where: { id: "tool-1" } });
      expect(obs!.type).toBe("TOOL");
    });

    it("chain-create creates CHAIN observation", async () => {
      const project = await createTestProject();
      await processEventBatch(
        [
          {
            id: "trace-1",
            type: "chain-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: { id: "chain-1", traceId: "trace-1", name: "pipeline" },
          },
        ],
        project.id,
      );
      const obs = await db.observation.findUnique({ where: { id: "chain-1" } });
      expect(obs!.type).toBe("CHAIN");
    });

    it("observation-create maps to SPAN type", async () => {
      const project = await createTestProject();
      await processEventBatch(
        [
          {
            id: "trace-1",
            type: "observation-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: { id: "obs-generic", traceId: "trace-1" },
          },
        ],
        project.id,
      );
      const obs = await db.observation.findUnique({ where: { id: "obs-generic" } });
      expect(obs!.type).toBe("SPAN");
    });
  });

  // ── updates ────────────────────────────────────────────────────────

  describe("updates", () => {
    it("span-update performs partial update", async () => {
      const project = await createTestProject();
      // Create first
      await processEventBatch(
        [
          {
            id: "trace-1",
            type: "span-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: { id: "obs-1", traceId: "trace-1", name: "original", level: "DEFAULT" },
          },
        ],
        project.id,
      );
      // Update only level
      await processEventBatch(
        [
          {
            id: "trace-1",
            type: "span-update",
            timestamp: "2026-01-01T00:00:01Z",
            body: { id: "obs-1", level: "ERROR" },
          },
        ],
        project.id,
      );

      const obs = await db.observation.findUnique({ where: { id: "obs-1" } });
      expect(obs!.name).toBe("original"); // unchanged
      expect(obs!.level).toBe("ERROR"); // updated
    });

    it("generation-update preserves non-updated fields", async () => {
      const project = await createTestProject();
      await processEventBatch(
        [
          {
            id: "trace-1",
            type: "generation-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: {
              id: "gen-1",
              traceId: "trace-1",
              model: "gpt-4o",
              usage: { promptTokens: 100 },
            },
          },
        ],
        project.id,
      );
      // Update output only
      await processEventBatch(
        [
          {
            id: "trace-1",
            type: "generation-update",
            timestamp: "2026-01-01T00:00:01Z",
            body: { id: "gen-1", output: { text: "done" } },
          },
        ],
        project.id,
      );

      const obs = await db.observation.findUnique({ where: { id: "gen-1" } });
      expect(obs!.model).toBe("gpt-4o"); // preserved
      expect(obs!.promptTokens).toBe(100); // preserved
      expect(obs!.output).toEqual({ text: "done" }); // updated
    });
  });

  // ── batch behavior ─────────────────────────────────────────────────

  describe("batch behavior", () => {
    it("sdk-log is acknowledged with no DB changes", async () => {
      const project = await createTestProject();
      const result = await processEventBatch(
        [
          {
            id: "log-1",
            type: "sdk-log",
            timestamp: "2026-01-01T00:00:00Z",
            body: { message: "test" },
          },
        ],
        project.id,
      );

      expect(result.successes).toHaveLength(1);
      const traces = await db.trace.findMany({ where: { projectId: project.id } });
      expect(traces).toHaveLength(0);
    });

    it("processes mixed valid and invalid events", async () => {
      const project = await createTestProject();
      const result = await processEventBatch(
        [
          {
            id: "good-1",
            type: "trace-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: { id: "trace-1", name: "valid" },
          },
          {
            id: "bad-1",
            type: "invalid-type",
            timestamp: "2026-01-01T00:00:00Z",
            body: {},
          },
        ],
        project.id,
      );

      expect(result.successes).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.id).toBe("bad-1");
      expect(result.errors[0]!.status).toBe(400);
    });

    it("handles completely invalid event with id: unknown", async () => {
      const project = await createTestProject();
      const result = await processEventBatch(["not-an-object"], project.id);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.id).toBe("unknown");
    });
  });
});
