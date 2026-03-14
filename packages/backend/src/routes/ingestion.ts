import { Hono } from "hono";
import { authenticateApiKey } from "@lightrace/shared/auth/apiAuth";
import { ingestionBatchSchema } from "@lightrace/shared/schemas/ingestion";
import { processEventBatch } from "../ingestion/processEventBatch";
import { publishTraceUpdate } from "../realtime/pubsub";

export const ingestionRoutes = new Hono();

ingestionRoutes.post("/", async (c) => {
  try {
    const authResult = await authenticateApiKey(c.req.header("authorization") ?? null);

    if (!authResult.valid) {
      return c.json({ error: authResult.error }, 401);
    }

    const rawBody = await c.req.json();
    const parsed = ingestionBatchSchema.safeParse(rawBody);

    if (!parsed.success) {
      return c.json({ error: "Invalid request body", details: parsed.error.message }, 400);
    }

    const result = await processEventBatch(parsed.data.batch, authResult.projectId);

    // Publish real-time updates for affected traces
    const traceIds = new Set<string>();
    for (const event of parsed.data.batch) {
      if (typeof event === "object" && event !== null) {
        const body = (event as Record<string, unknown>).body as Record<string, unknown> | undefined;
        const traceId = body?.traceId ?? body?.id ?? (event as Record<string, unknown>).id;
        if (typeof traceId === "string") traceIds.add(traceId);
      }
    }
    for (const traceId of traceIds) {
      publishTraceUpdate(authResult.projectId, traceId);
    }

    return c.json(result, 207);
  } catch (error) {
    console.error("[ingestion] Unexpected error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
