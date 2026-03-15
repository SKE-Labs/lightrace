/**
 * WebSocket handler for SDK tool connections.
 * SDKs connect here to register invocable tools and receive invoke commands.
 */
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import type { WebSocket } from "ws";
import { authenticateApiKey } from "@lightrace/shared/auth/apiAuth";
import { db } from "@lightrace/shared/db";

/** A connected SDK instance. */
interface ConnectedAgent {
  ws: WebSocket;
  projectId: string;
  sdkInstanceId: string;
  sessionToken: string;
  tools: string[];
}

/** Pending invocation awaiting a result. */
interface PendingInvocation {
  resolve: (result: InvokeResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface InvokeResult {
  output: unknown;
  error?: string;
  durationMs: number;
}

/** In-memory map of connected SDK agents. */
const agents = new Map<string, ConnectedAgent>();

/** Pending invocations keyed by nonce. */
const pendingInvocations = new Map<string, PendingInvocation>();

/** Used nonces (replay prevention). */
const usedNonces = new Set<string>();

function signHmac(sessionToken: string, nonce: string, tool: string, data: unknown): string {
  const payload = nonce + tool + JSON.stringify(data, Object.keys((data as object) ?? {}).sort());
  return createHmac("sha256", sessionToken).update(payload).digest("hex");
}

/**
 * Handle a new WebSocket connection from an SDK.
 * Called from the WS server's connection handler after URL path matching.
 */
export async function handleToolConnection(
  ws: WebSocket,
  authHeader: string | null,
): Promise<void> {
  // Authenticate via API key
  const authResult = await authenticateApiKey(authHeader);
  if (!authResult.valid) {
    ws.send(JSON.stringify({ type: "error", message: authResult.error }));
    ws.close(4001, "Unauthorized");
    return;
  }

  const { projectId } = authResult;
  const sessionToken = randomUUID();

  // Send connected message with session token
  ws.send(JSON.stringify({ type: "connected", sessionToken }));

  let agentKey: string | null = null;

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      switch (msg.type) {
        case "register":
          agentKey = await handleRegister(ws, projectId, sessionToken, msg);
          break;
        case "result":
          handleResult(msg);
          break;
        case "heartbeat":
          ws.send(JSON.stringify({ type: "heartbeat_ack" }));
          if (agentKey) {
            // Update heartbeat in DB
            const agent = agents.get(agentKey);
            if (agent) {
              await db.toolRegistration
                .updateMany({
                  where: {
                    projectId,
                    sdkInstanceId: agent.sdkInstanceId,
                  },
                  data: { lastHeartbeat: new Date() },
                })
                .catch(() => {});
            }
          }
          break;
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on("close", async () => {
    if (agentKey) {
      const agent = agents.get(agentKey);
      if (agent) {
        // Mark tools as offline in DB
        await db.toolRegistration
          .updateMany({
            where: {
              projectId,
              sdkInstanceId: agent.sdkInstanceId,
            },
            data: { status: "offline" },
          })
          .catch(() => {});
        agents.delete(agentKey);
      }
    }
  });
}

async function handleRegister(
  ws: WebSocket,
  projectId: string,
  sessionToken: string,
  msg: {
    sdkInstanceId: string;
    tools: Array<{ name: string; inputSchema: unknown }>;
  },
): Promise<string> {
  const { sdkInstanceId, tools } = msg;
  const agentKey = `${projectId}:${sdkInstanceId}`;
  const toolNames = tools.map((t) => t.name);

  // Store in memory
  agents.set(agentKey, {
    ws,
    projectId,
    sdkInstanceId,
    sessionToken,
    tools: toolNames,
  });

  // Upsert tool registrations in DB
  for (const tool of tools) {
    await db.toolRegistration.upsert({
      where: {
        projectId_sdkInstanceId_toolName: {
          projectId,
          sdkInstanceId,
          toolName: tool.name,
        },
      },
      create: {
        projectId,
        sdkInstanceId,
        toolName: tool.name,
        inputSchema: (tool.inputSchema as object) ?? undefined,
        status: "online",
        lastHeartbeat: new Date(),
      },
      update: {
        inputSchema: (tool.inputSchema as object) ?? undefined,
        status: "online",
        lastHeartbeat: new Date(),
      },
    });
  }

  // Remove stale registrations for tools no longer present
  await db.toolRegistration.deleteMany({
    where: {
      projectId,
      sdkInstanceId,
      toolName: { notIn: toolNames },
    },
  });

  ws.send(JSON.stringify({ type: "registered", tools: toolNames }));
  console.log(
    `[tools-ws] Agent ${sdkInstanceId} registered ${toolNames.length} tool(s): ${toolNames.join(", ")}`,
  );

  return agentKey;
}

function handleResult(msg: {
  nonce: string;
  output: unknown;
  error?: string;
  durationMs: number;
}): void {
  const pending = pendingInvocations.get(msg.nonce);
  if (!pending) return;

  clearTimeout(pending.timer);
  pendingInvocations.delete(msg.nonce);

  pending.resolve({
    output: msg.output,
    error: msg.error,
    durationMs: msg.durationMs,
  });
}

/**
 * Invoke a tool on a connected SDK agent.
 * Returns a promise that resolves when the SDK sends the result.
 */
export async function invokeToolOnAgent(params: {
  projectId: string;
  toolName: string;
  input: unknown;
  timeoutMs?: number;
}): Promise<InvokeResult> {
  const { projectId, toolName, input, timeoutMs = 30_000 } = params;

  // Find a connected agent that has this tool
  let targetAgent: ConnectedAgent | null = null;
  for (const agent of agents.values()) {
    if (agent.projectId === projectId && agent.tools.includes(toolName)) {
      targetAgent = agent;
      break;
    }
  }

  if (!targetAgent) {
    throw new Error(`No connected agent has tool "${toolName}"`);
  }

  if (targetAgent.ws.readyState !== 1 /* OPEN */) {
    throw new Error(`Agent is not connected`);
  }

  const nonce = randomUUID();
  const signature = signHmac(targetAgent.sessionToken, nonce, toolName, input);

  // Track nonce to prevent replay
  usedNonces.add(nonce);
  setTimeout(() => usedNonces.delete(nonce), 60_000);

  return new Promise<InvokeResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingInvocations.delete(nonce);
      reject(new Error(`Tool invocation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pendingInvocations.set(nonce, { resolve, timer });

    targetAgent!.ws.send(
      JSON.stringify({
        type: "invoke",
        nonce,
        tool: toolName,
        input,
        signature,
      }),
    );
  });
}

/** Get all connected agents for a project. */
export function getConnectedAgents(projectId: string): Array<{
  sdkInstanceId: string;
  tools: string[];
}> {
  const result: Array<{ sdkInstanceId: string; tools: string[] }> = [];
  for (const agent of agents.values()) {
    if (agent.projectId === projectId) {
      result.push({
        sdkInstanceId: agent.sdkInstanceId,
        tools: agent.tools,
      });
    }
  }
  return result;
}
