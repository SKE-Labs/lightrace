import { describe, it, expect, vi, afterEach } from "vitest";
import { checkDevServerHealth, invokeDevServer, replayOnDevServer } from "./dev-server";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("checkDevServerHealth", () => {
  it("returns unavailable when callbackUrl is null", async () => {
    const result = await checkDevServerHealth(null);
    expect(result.status).toBe("unavailable");
    expect(result.message).toBe("No callback URL registered");
  });

  it("returns healthy when server responds 200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await checkDevServerHealth("http://localhost:9999");
    expect(result.status).toBe("healthy");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:9999/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns unhealthy when server responds non-200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const result = await checkDevServerHealth("http://localhost:9999");
    expect(result.status).toBe("unhealthy");
    expect(result.message).toBe("HTTP 503");
  });

  it("returns unreachable when fetch throws a network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await checkDevServerHealth("http://localhost:9999");
    expect(result.status).toBe("unreachable");
    expect(result.message).toBe("ECONNREFUSED");
  });

  it("returns unreachable with Timeout when fetch times out", async () => {
    const err = new Error("timeout");
    err.name = "TimeoutError";
    globalThis.fetch = vi.fn().mockRejectedValue(err);
    const result = await checkDevServerHealth("http://localhost:9999");
    expect(result.status).toBe("unreachable");
    expect(result.message).toBe("Timeout");
  });
});

describe("invokeDevServer", () => {
  it("returns the envelope response on success", async () => {
    const envelope = {
      code: 200,
      message: "OK",
      response: { output: "hello", durationMs: 100 },
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(envelope),
    });

    const result = await invokeDevServer({
      callbackUrl: "http://localhost:9999",
      toolName: "my-tool",
      input: { x: 1 },
      timeoutMs: 5000,
    });
    expect(result).toEqual({ output: "hello", durationMs: 100 });
  });

  it("throws on non-OK response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(
      invokeDevServer({
        callbackUrl: "http://localhost:9999",
        toolName: "my-tool",
        input: {},
        timeoutMs: 5000,
      }),
    ).rejects.toThrow("SDK dev server returned 500: Internal Server Error");
  });

  it("sends Authorization header when apiKeyPublic is provided", async () => {
    const envelope = { code: 200, message: "OK", response: { output: null, durationMs: 0 } };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(envelope),
    });

    await invokeDevServer({
      callbackUrl: "http://localhost:9999",
      toolName: "my-tool",
      input: {},
      apiKeyPublic: "pk-lt-abc",
      timeoutMs: 5000,
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const opts = fetchCall[1] as RequestInit;
    expect((opts.headers as Record<string, string>).Authorization).toBe("Bearer pk-lt-abc");
  });

  it("includes context in body when provided", async () => {
    const envelope = { code: 200, message: "OK", response: { output: null, durationMs: 0 } };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(envelope),
    });

    await invokeDevServer({
      callbackUrl: "http://localhost:9999",
      toolName: "my-tool",
      input: { a: 1 },
      context: { thread_id: "t1" },
      timeoutMs: 5000,
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(fetchCall[1].body as string);
    expect(body.context).toEqual({ thread_id: "t1" });
    expect(body.tool).toBe("my-tool");
    expect(body.input).toEqual({ a: 1 });
  });
});

describe("replayOnDevServer", () => {
  it("returns the envelope response on success", async () => {
    const envelope = {
      code: 200,
      message: "OK",
      response: { output: "replayed", durationMs: 200 },
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(envelope),
    });

    await replayOnDevServer({
      callbackUrl: "http://localhost:9999",
      threadId: "thread-1",
      toolName: "search",
      modifiedContent: "new result",
      forkedTraceId: "fork-trace-1",
      timeoutMs: 5000,
    });
  });

  it("throws on non-OK response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Error"),
    });

    await expect(
      replayOnDevServer({
        callbackUrl: "http://localhost:9999",
        threadId: "thread-1",
        toolName: "search",
        modifiedContent: "content",
        forkedTraceId: "fork-trace-1",
        timeoutMs: 5000,
      }),
    ).rejects.toThrow("SDK dev server returned 500: Error");
  });

  it("sends all optional fields in body when provided", async () => {
    const envelope = { code: 200, message: "OK", response: { output: null, durationMs: 0 } };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(envelope),
    });

    await replayOnDevServer({
      callbackUrl: "http://localhost:9999",
      threadId: "thread-1",
      toolCallId: "call_123",
      toolName: "search",
      modifiedContent: "new result",
      forkedTraceId: "fork-trace-1",
      context: { user_id: "u1" },
      apiKeyPublic: "pk-lt-xyz",
      timeoutMs: 5000,
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(fetchCall[0]).toBe("http://localhost:9999/replay");
    const body = JSON.parse(fetchCall[1].body as string);
    expect(body.thread_id).toBe("thread-1");
    expect(body.tool_call_id).toBe("call_123");
    expect(body.tool_name).toBe("search");
    expect(body.modified_content).toBe("new result");
    expect(body.context).toEqual({ user_id: "u1" });
    const headers = fetchCall[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer pk-lt-xyz");
  });

  it("omits optional fields from body when not provided", async () => {
    const envelope = { code: 200, message: "OK", response: { output: null, durationMs: 0 } };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(envelope),
    });

    await replayOnDevServer({
      callbackUrl: "http://localhost:9999",
      threadId: "thread-1",
      toolName: "search",
      modifiedContent: "content",
      forkedTraceId: "fork-trace-1",
      timeoutMs: 5000,
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(fetchCall[1].body as string);
    expect(body.thread_id).toBe("thread-1");
    expect(body.tool_name).toBe("search");
    expect(body.modified_content).toBe("content");
    expect(body.tool_call_id).toBeUndefined();
    expect(body.context).toBeUndefined();
  });
});
