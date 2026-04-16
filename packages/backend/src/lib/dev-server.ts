/** Shared helpers for communicating with SDK dev servers. */

export interface DevServerHealthResult {
  status: "healthy" | "unhealthy" | "unreachable" | "unavailable";
  message?: string;
}

export async function checkDevServerHealth(
  callbackUrl: string | null,
): Promise<DevServerHealthResult> {
  if (!callbackUrl) {
    return { status: "unavailable", message: "No callback URL registered" };
  }
  try {
    const res = await fetch(`${callbackUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return { status: "healthy" };
    return { status: "unhealthy", message: `HTTP ${res.status}` };
  } catch (err) {
    return {
      status: "unreachable",
      message:
        err instanceof Error
          ? err.name === "TimeoutError" || err.name === "AbortError"
            ? "Timeout"
            : err.message
          : "Unknown error",
    };
  }
}

export interface InvokeDevServerOpts {
  callbackUrl: string;
  toolName: string;
  input: unknown;
  context?: Record<string, unknown>;
  apiKeyPublic?: string;
  timeoutMs: number;
}

export interface InvokeDevServerResult {
  output: unknown;
  error?: string;
  durationMs: number;
}

export async function invokeDevServer(opts: InvokeDevServerOpts): Promise<InvokeDevServerResult> {
  const response = await fetch(`${opts.callbackUrl}/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.apiKeyPublic ? { Authorization: `Bearer ${opts.apiKeyPublic}` } : {}),
    },
    body: JSON.stringify({
      tool: opts.toolName,
      input: opts.input,
      ...(opts.context ? { context: opts.context } : {}),
    }),
    signal: AbortSignal.timeout(opts.timeoutMs),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(`SDK dev server returned ${response.status}: ${errorBody}`);
  }

  const envelope = (await response.json()) as {
    code: number;
    message: string;
    response: InvokeDevServerResult;
  };
  return envelope.response;
}

export interface ReplayDevServerOpts {
  callbackUrl: string;
  threadId: string;
  toolCallId?: string;
  toolName: string;
  modifiedContent: string;
  forkedTraceId: string;
  context?: Record<string, unknown>;
  apiKeyPublic?: string;
  timeoutMs: number;
}

/**
 * Fire-and-forget: tells the SDK to start the fork replay in the background.
 * The SDK traces observations to the forked trace via OTel in real-time.
 * Returns once the SDK acknowledges the request (does NOT wait for completion).
 */
export async function replayOnDevServer(opts: ReplayDevServerOpts): Promise<void> {
  const response = await fetch(`${opts.callbackUrl}/replay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.apiKeyPublic ? { Authorization: `Bearer ${opts.apiKeyPublic}` } : {}),
    },
    body: JSON.stringify({
      thread_id: opts.threadId,
      ...(opts.toolCallId ? { tool_call_id: opts.toolCallId } : {}),
      tool_name: opts.toolName,
      modified_content: opts.modifiedContent,
      forked_trace_id: opts.forkedTraceId,
      ...(opts.context ? { context: opts.context } : {}),
    }),
    signal: AbortSignal.timeout(opts.timeoutMs),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(`SDK dev server returned ${response.status}: ${errorBody}`);
  }
}
