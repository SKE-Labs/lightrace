import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer } from "ws";
import { appRouter } from "./trpc/router";
import { createTRPCContext } from "./trpc/context";
import { extractUser } from "./middleware/auth";
import { ingestionRoutes } from "./routes/ingestion";
import { otelRoutes } from "./routes/otel";
import { toolsRegistryRoutes } from "./routes/tools-registry";
import { checkpointRoutes } from "./routes/checkpoints";
import { apiResponse } from "./utils/api-response";
import { realtimeEmitter } from "./realtime/pubsub";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "dev-internal-secret";
const PORT = parseInt(process.env.PORT || "3002", 10);
const WS_PORT = parseInt(process.env.WS_PORT || "3003", 10);

const app = new Hono();

// CORS for public API endpoints (SDK ingestion + tool registration)
app.use(
  "/api/public/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-langfuse-sdk-name",
      "x-langfuse-sdk-version",
      "x-langfuse-public-key",
    ],
  }),
);

// Public ingestion endpoints (authenticated via API key, not internal secret)
app.route("/api/public/ingestion", ingestionRoutes);
app.route("/api/public/otel/v1/traces", otelRoutes);
app.route("/api/public/tools", toolsRegistryRoutes);
app.route("/api/public/checkpoints", checkpointRoutes);

// tRPC endpoint (authenticated via internal secret from frontend proxy)
app.all("/trpc/*", async (c) => {
  const secret = c.req.header("x-lightrace-internal-secret");
  const user = secret === INTERNAL_SECRET ? extractUser(c) : null;

  return fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () => createTRPCContext(user),
  });
});

// Health check
app.get("/health", (c) => apiResponse(c, 200, "OK", { status: "ok" }));

// Start HTTP server
console.log(`[backend] Starting HTTP on port ${PORT}`);
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[backend] HTTP listening on http://localhost:${info.port}`);
});

// Start WebSocket server for tRPC subscriptions (real-time dashboard updates)
const wss = new WebSocketServer({ port: WS_PORT });

applyWSSHandler({
  wss,
  router: appRouter,
  createContext: ({ req }) => {
    // Extract auth from query string or headers
    const url = new URL(req.url ?? "", `http://localhost:${WS_PORT}`);
    const secret = url.searchParams.get("secret");
    const userId = url.searchParams.get("userId");
    const userEmail = url.searchParams.get("userEmail");

    if (secret !== INTERNAL_SECRET || !userId || !userEmail) {
      return createTRPCContext(null);
    }

    return createTRPCContext({ id: userId, email: userEmail });
  },
});

console.log(`[backend] WebSocket listening on ws://localhost:${WS_PORT}`);

// Start Redis Pub/Sub subscriber
realtimeEmitter.start().catch((err) => {
  console.error("[backend] Failed to start realtime emitter:", err);
});

export { appRouter, type AppRouter } from "./trpc/router";
