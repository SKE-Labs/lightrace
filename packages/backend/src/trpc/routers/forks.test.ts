import { describe, it, expect, vi, afterEach } from "vitest";
import { db } from "@lightrace/shared/db";
import {
  createTestUser,
  createTestProject,
  createTestMembership,
  createTestTrace,
  createTestObservation,
  createTestToolRegistration,
  createTestApiKey,
  createTestCheckpoint,
  createCaller,
} from "../../__tests__/helpers";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("forks.create", () => {
  // ── Phase A: Transaction ──────────────────────────────────────────

  describe("Phase A — fork structure", () => {
    it("creates forked trace with (fork) suffix and isFork=true", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const trace = await createTestTrace({ projectId: project.id, name: "original" });
      const toolObs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "TOOL",
        name: "search",
        startTime: new Date("2026-01-01T00:01:00Z"),
      });
      await createTestToolRegistration({
        projectId: project.id,
        toolName: "search",
        callbackUrl: "",
      });

      // Mock fetch to avoid actual dev server calls
      globalThis.fetch = vi.fn();

      const caller = createCaller(user.id, user.email);
      const result = await caller.forks.create({
        projectId: project.id,
        sourceTraceId: trace.id,
        forkPointObservationId: toolObs.id,
        modifiedInput: { query: "new" },
      });

      const forkedTrace = await db.trace.findUnique({ where: { id: result.forkedTraceId } });
      expect(forkedTrace).not.toBeNull();
      expect(forkedTrace!.name).toBe("original (fork)");
      expect(forkedTrace!.isFork).toBe(true);
    });

    it("copies only pre-fork observations with new IDs", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const now = new Date();
      const trace = await createTestTrace({ projectId: project.id, timestamp: now });

      const preObs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "SPAN",
        name: "pre-fork",
        startTime: new Date(now.getTime()),
        endTime: new Date(now.getTime() + 1000),
      });
      const toolObs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "TOOL",
        name: "search",
        startTime: new Date(now.getTime() + 2000),
        endTime: new Date(now.getTime() + 3000),
      });
      await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "SPAN",
        name: "post-fork",
        startTime: new Date(now.getTime() + 4000),
        endTime: new Date(now.getTime() + 5000),
      });
      await createTestToolRegistration({
        projectId: project.id,
        toolName: "search",
        callbackUrl: "",
      });

      globalThis.fetch = vi.fn();

      const caller = createCaller(user.id, user.email);
      const result = await caller.forks.create({
        projectId: project.id,
        sourceTraceId: trace.id,
        forkPointObservationId: toolObs.id,
        modifiedInput: {},
      });

      const forkedObs = await db.observation.findMany({
        where: { traceId: result.forkedTraceId },
        orderBy: { startTime: "asc" },
      });

      // Pre-fork obs copied + the new tool obs = 2, post-fork NOT copied
      const copiedNames = forkedObs.map((o) => o.name);
      expect(copiedNames).toContain("pre-fork");
      expect(copiedNames).not.toContain("post-fork");
      // The copied pre-fork obs has a new ID
      expect(forkedObs.find((o) => o.name === "pre-fork")!.id).not.toBe(preObs.id);
    });

    it("remaps parentObservationId in copied observations", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const now = new Date();
      const trace = await createTestTrace({ projectId: project.id, timestamp: now });

      const parent = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "SPAN",
        name: "parent-span",
        startTime: now,
        endTime: new Date(now.getTime() + 1000),
      });
      await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "SPAN",
        name: "child-span",
        parentObservationId: parent.id,
        startTime: new Date(now.getTime() + 500),
        endTime: new Date(now.getTime() + 1000),
      });
      const toolObs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "TOOL",
        name: "search",
        startTime: new Date(now.getTime() + 2000),
        endTime: new Date(now.getTime() + 3000),
      });
      await createTestToolRegistration({
        projectId: project.id,
        toolName: "search",
        callbackUrl: "",
      });

      globalThis.fetch = vi.fn();

      const caller = createCaller(user.id, user.email);
      const result = await caller.forks.create({
        projectId: project.id,
        sourceTraceId: trace.id,
        forkPointObservationId: toolObs.id,
        modifiedInput: {},
      });

      const forkedObs = await db.observation.findMany({
        where: { traceId: result.forkedTraceId },
      });

      // Find the copied observations by name
      const copiedChild = forkedObs.find((o) => o.name === "child-span");
      const copiedParent = forkedObs.find((o) => o.name === "parent-span");
      expect(copiedChild).toBeDefined();
      expect(copiedParent).toBeDefined();
      expect(copiedChild!.parentObservationId).toBe(copiedParent!.id);
    });

    it("creates TraceFork record", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const trace = await createTestTrace({ projectId: project.id });
      const toolObs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "TOOL",
        name: "search",
        startTime: new Date("2026-01-01T00:01:00Z"),
      });
      await createTestToolRegistration({
        projectId: project.id,
        toolName: "search",
        callbackUrl: "",
      });
      globalThis.fetch = vi.fn();

      const caller = createCaller(user.id, user.email);
      const result = await caller.forks.create({
        projectId: project.id,
        sourceTraceId: trace.id,
        forkPointObservationId: toolObs.id,
        modifiedInput: { x: 1 },
      });

      const fork = await db.traceFork.findUnique({
        where: { forkedTraceId: result.forkedTraceId },
      });
      expect(fork).not.toBeNull();
      expect(fork!.sourceTraceId).toBe(trace.id);
      expect(fork!.forkPointId).toBe(toolObs.id);
      expect(fork!.modifiedInput).toEqual({ x: 1 });
    });

    it("rejects fork on non-TOOL observation", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const trace = await createTestTrace({ projectId: project.id });
      const spanObs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "SPAN",
      });

      const caller = createCaller(user.id, user.email);
      await expect(
        caller.forks.create({
          projectId: project.id,
          sourceTraceId: trace.id,
          forkPointObservationId: spanObs.id,
          modifiedInput: {},
        }),
      ).rejects.toThrow("Only TOOL observations can be forked");
    });
  });

  // ── Phase B: Tool invocation ───────────────────────────────────────

  describe("Phase B — tool invocation", () => {
    it("creates TOOL observation with output on healthy dev server", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      await createTestApiKey({ projectId: project.id });
      const trace = await createTestTrace({ projectId: project.id });
      const toolObs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "TOOL",
        name: "search",
        startTime: new Date("2026-01-01T00:01:00Z"),
      });
      await createTestToolRegistration({
        projectId: project.id,
        toolName: "search",
        callbackUrl: "http://localhost:9999",
      });

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200 }) // health check
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              code: 200,
              message: "OK",
              response: { output: "search result", durationMs: 50 },
            }),
        }); // invoke

      const caller = createCaller(user.id, user.email);
      const result = await caller.forks.create({
        projectId: project.id,
        sourceTraceId: trace.id,
        forkPointObservationId: toolObs.id,
        modifiedInput: { q: "test" },
      });

      expect(result.invocationResult.output).toBe("search result");
      expect(result.invocationResult.error).toBeUndefined();

      // Check the TOOL observation was created in the forked trace
      const obs = await db.observation.findMany({
        where: { traceId: result.forkedTraceId, type: "TOOL" },
      });
      expect(obs.some((o) => o.name === "search" && o.level === "DEFAULT")).toBe(true);
    });

    it("creates ERROR observation when dev server is unhealthy", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const trace = await createTestTrace({ projectId: project.id });
      const toolObs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "TOOL",
        name: "search",
        startTime: new Date("2026-01-01T00:01:00Z"),
      });
      await createTestToolRegistration({
        projectId: project.id,
        toolName: "search",
        callbackUrl: "http://localhost:9999",
      });

      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

      const caller = createCaller(user.id, user.email);
      const result = await caller.forks.create({
        projectId: project.id,
        sourceTraceId: trace.id,
        forkPointObservationId: toolObs.id,
        modifiedInput: {},
      });

      expect(result.invocationResult.error).toContain("unhealthy");

      const toolObsForked = await db.observation.findMany({
        where: { traceId: result.forkedTraceId, type: "TOOL" },
      });
      expect(toolObsForked.some((o) => o.level === "ERROR")).toBe(true);
    });

    it("returns error when tool is not registered", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const trace = await createTestTrace({ projectId: project.id });
      const toolObs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "TOOL",
        name: "unregistered",
        startTime: new Date("2026-01-01T00:01:00Z"),
      });

      globalThis.fetch = vi.fn();

      const caller = createCaller(user.id, user.email);
      const result = await caller.forks.create({
        projectId: project.id,
        sourceTraceId: trace.id,
        forkPointObservationId: toolObs.id,
        modifiedInput: {},
      });

      expect(result.invocationResult.error).toContain("not registered");
    });
  });

  // ── Phase C: Checkpoint replay ─────────────────────────────────────

  describe("Phase C — checkpoint replay", () => {
    it("replays via checkpoint when tool succeeds and checkpoint exists", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      await createTestApiKey({ projectId: project.id });
      const now = new Date();
      const trace = await createTestTrace({ projectId: project.id, timestamp: now });

      // Pre-fork obs
      const genObs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "GENERATION",
        startTime: now,
        endTime: new Date(now.getTime() + 1000),
      });

      // Fork-point TOOL observation
      const toolObs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "TOOL",
        name: "search",
        toolCallId: "call_123",
        startTime: new Date(now.getTime() + 2000),
        endTime: new Date(now.getTime() + 3000),
      });

      await createTestToolRegistration({
        projectId: project.id,
        toolName: "search",
        callbackUrl: "http://localhost:9999",
      });

      // Checkpoint at the fork point
      await createTestCheckpoint({
        projectId: project.id,
        traceId: trace.id,
        observationId: toolObs.id,
        threadId: "t1",
        stepIndex: 0,
        state: { messages: [{ role: "user", content: "hi" }] },
      });

      // Checkpoint AFTER the fork point (continuation state)
      await createTestCheckpoint({
        projectId: project.id,
        traceId: trace.id,
        observationId: genObs.id, // different obs
        threadId: "t1",
        stepIndex: 1,
        state: {
          messages: [
            { role: "user", content: "hi" },
            { role: "assistant", content: "hello", tool_calls: [{ id: "call_123" }] },
            { role: "tool", content: "old result", tool_call_id: "call_123", name: "search" },
          ],
          tools: [{ name: "search" }],
          model: "gpt-4",
        },
      });

      // Mock: health check → invoke → replay
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true }) // health check
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              code: 200,
              message: "OK",
              response: { output: "new tool result", durationMs: 50 },
            }),
        }) // invoke
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              code: 200,
              message: "OK",
              response: { output: "continued generation", durationMs: 100 },
            }),
        }); // replay

      const caller = createCaller(user.id, user.email);
      const result = await caller.forks.create({
        projectId: project.id,
        sourceTraceId: trace.id,
        forkPointObservationId: toolObs.id,
        modifiedInput: { q: "new query" },
      });

      // Replay succeeded
      expect(result.replayResult).not.toBeNull();
      expect(result.replayResult!.output).toBe("continued generation");

      // Check that a GENERATION observation was created for the replay
      const genObs2 = await db.observation.findMany({
        where: { traceId: result.forkedTraceId, type: "GENERATION" },
      });
      expect(genObs2.some((o) => o.name === "continuation (replay)")).toBe(true);

      // Verify the replay call had modified messages (tool result replaced)
      const replayCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[2]!;
      const replayBody = JSON.parse(replayCall[1].body as string);
      const toolMsg = replayBody.messages.find((m: Record<string, unknown>) => m.role === "tool");
      expect(toolMsg.content).toBe("new tool result");
    });

    it("replaces tool result by name fallback when no toolCallId", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      await createTestApiKey({ projectId: project.id });
      const trace = await createTestTrace({ projectId: project.id });

      const toolObs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "TOOL",
        name: "search",
        startTime: new Date("2026-01-01T00:01:00Z"),
        // no toolCallId
      });

      await createTestToolRegistration({
        projectId: project.id,
        toolName: "search",
        callbackUrl: "http://localhost:9999",
      });

      // Fork-point checkpoint
      await createTestCheckpoint({
        projectId: project.id,
        traceId: trace.id,
        observationId: toolObs.id,
        threadId: "t1",
        stepIndex: 0,
        state: {},
      });

      // Continuation checkpoint with tool message matched by name
      const otherObs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "GENERATION",
        startTime: new Date("2026-01-01T00:02:00Z"),
      });
      await createTestCheckpoint({
        projectId: project.id,
        traceId: trace.id,
        observationId: otherObs.id,
        threadId: "t1",
        stepIndex: 1,
        state: {
          messages: [{ role: "tool", content: "old", name: "search" }],
          model: "gpt-4",
        },
      });

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              code: 200,
              message: "OK",
              response: { output: "new result", durationMs: 50 },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              code: 200,
              message: "OK",
              response: { output: "replayed", durationMs: 100 },
            }),
        });

      const caller = createCaller(user.id, user.email);
      await caller.forks.create({
        projectId: project.id,
        sourceTraceId: trace.id,
        forkPointObservationId: toolObs.id,
        modifiedInput: {},
      });

      // The replay call should have replaced the tool message
      const replayCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[2]!;
      const replayBody = JSON.parse(replayCall[1].body as string);
      expect(replayBody.messages[0].content).toBe("new result");
    });

    it("skips replay when no checkpoint exists", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      await createTestApiKey({ projectId: project.id });
      const trace = await createTestTrace({ projectId: project.id });
      const toolObs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "TOOL",
        name: "search",
        startTime: new Date("2026-01-01T00:01:00Z"),
      });
      await createTestToolRegistration({
        projectId: project.id,
        toolName: "search",
        callbackUrl: "http://localhost:9999",
      });

      // No checkpoints created

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              code: 200,
              message: "OK",
              response: { output: "result", durationMs: 50 },
            }),
        });

      const caller = createCaller(user.id, user.email);
      const result = await caller.forks.create({
        projectId: project.id,
        sourceTraceId: trace.id,
        forkPointObservationId: toolObs.id,
        modifiedInput: {},
      });

      expect(result.replayResult).toBeNull();
      // Only 2 fetch calls (health + invoke), no replay
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  // ── Validation ─────────────────────────────────────────────────────

  describe("validation", () => {
    it("rejects missing source trace", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });

      const caller = createCaller(user.id, user.email);
      await expect(
        caller.forks.create({
          projectId: project.id,
          sourceTraceId: "nonexistent",
          forkPointObservationId: "obs-1",
          modifiedInput: {},
        }),
      ).rejects.toThrow("Source trace not found");
    });

    it("rejects missing fork point observation", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const trace = await createTestTrace({ projectId: project.id });

      const caller = createCaller(user.id, user.email);
      await expect(
        caller.forks.create({
          projectId: project.id,
          sourceTraceId: trace.id,
          forkPointObservationId: "nonexistent",
          modifiedInput: {},
        }),
      ).rejects.toThrow("Fork point observation not found");
    });
  });
});

// ── byTraceId & compare ──────────────────────────────────────────────

describe("forks.byTraceId", () => {
  it("returns fork metadata", async () => {
    const user = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project.id });
    const trace = await createTestTrace({ projectId: project.id });
    const forkedTrace = await createTestTrace({ projectId: project.id, isFork: true });

    await db.traceFork.create({
      data: {
        sourceTraceId: trace.id,
        forkedTraceId: forkedTrace.id,
        forkPointId: "obs-1",
        projectId: project.id,
      },
    });

    const caller = createCaller(user.id, user.email);
    const result = await caller.forks.byTraceId({ projectId: project.id, traceId: trace.id });
    expect(result.forks).toHaveLength(1);
    expect(result.forkedFrom).toBeNull();

    const forkedResult = await caller.forks.byTraceId({
      projectId: project.id,
      traceId: forkedTrace.id,
    });
    expect(forkedResult.forkedFrom).not.toBeNull();
    expect(forkedResult.forkedFrom!.sourceTraceId).toBe(trace.id);
  });
});

describe("forks.compare", () => {
  it("returns both traces with observations", async () => {
    const user = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project.id });
    const source = await createTestTrace({ projectId: project.id });
    const forked = await createTestTrace({ projectId: project.id, isFork: true });
    await createTestObservation({ traceId: source.id, projectId: project.id, type: "SPAN" });
    await createTestObservation({ traceId: forked.id, projectId: project.id, type: "SPAN" });

    const fork = await db.traceFork.create({
      data: {
        sourceTraceId: source.id,
        forkedTraceId: forked.id,
        forkPointId: "obs-1",
        observationIdMap: { old: "new" },
        projectId: project.id,
      },
    });

    const caller = createCaller(user.id, user.email);
    const result = await caller.forks.compare({ projectId: project.id, forkId: fork.id });
    expect(result.sourceTrace.id).toBe(source.id);
    expect(result.forkedTrace.id).toBe(forked.id);
    expect(result.observationIdMap).toEqual({ old: "new" });
  });

  it("throws NOT_FOUND for nonexistent fork", async () => {
    const user = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project.id });

    const caller = createCaller(user.id, user.email);
    await expect(
      caller.forks.compare({ projectId: project.id, forkId: "nonexistent" }),
    ).rejects.toThrow("Fork not found");
  });
});
