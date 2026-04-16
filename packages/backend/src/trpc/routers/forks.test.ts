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

  // ── Phase C: LangGraph-native replay ───────────────────────────────

  describe("Phase C — LangGraph-native replay", () => {
    it("replays via LangGraph when tool succeeds and trace has sessionId + graph capability", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      await createTestApiKey({ projectId: project.id });
      const now = new Date();
      const trace = await createTestTrace({
        projectId: project.id,
        timestamp: now,
        sessionId: "thread-abc",
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
        capabilities: { replay: true, graph: true },
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

      // Replay is fire-and-forget — verify the call was made with correct params
      const replayCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[2]!;
      const replayBody = JSON.parse(replayCall[1].body as string);
      expect(replayBody.thread_id).toBe("thread-abc");
      expect(replayBody.tool_call_id).toBe("call_123");
      expect(replayBody.tool_name).toBe("search");
      expect(replayBody.modified_content).toBe("new tool result");
      expect(replayBody.forked_trace_id).toBe(result.forkedTraceId);
    });

    it("sends replay without tool_call_id when observation has none", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      await createTestApiKey({ projectId: project.id });
      const trace = await createTestTrace({
        projectId: project.id,
        sessionId: "thread-xyz",
      });

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
        capabilities: { replay: true, graph: true },
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

      // The replay call should omit tool_call_id and send tool_name
      const replayCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[2]!;
      const replayBody = JSON.parse(replayCall[1].body as string);
      expect(replayBody.thread_id).toBe("thread-xyz");
      expect(replayBody.tool_call_id).toBeUndefined();
      expect(replayBody.tool_name).toBe("search");
      expect(replayBody.modified_content).toBe("new result");
    });

    it("skips replay when trace has no sessionId", async () => {
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
        capabilities: { replay: true, graph: true },
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
              response: { output: "result", durationMs: 50 },
            }),
        });

      const caller = createCaller(user.id, user.email);
      await caller.forks.create({
        projectId: project.id,
        sourceTraceId: trace.id,
        forkPointObservationId: toolObs.id,
        modifiedInput: {},
      });

      // Only 2 fetch calls (health + invoke), no replay
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("skips replay when tool registration has no graph capability", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      await createTestApiKey({ projectId: project.id });
      const trace = await createTestTrace({
        projectId: project.id,
        sessionId: "thread-123",
      });
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
        // no capabilities — graph not supported
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
              response: { output: "result", durationMs: 50 },
            }),
        });

      const caller = createCaller(user.id, user.email);
      await caller.forks.create({
        projectId: project.id,
        sourceTraceId: trace.id,
        forkPointObservationId: toolObs.id,
        modifiedInput: {},
      });

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
