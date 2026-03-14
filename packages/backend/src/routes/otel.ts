import { Hono } from "hono";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import { authenticateApiKey } from "@lightrace/shared/auth/apiAuth";
import { processOtelResourceSpans } from "../ingestion/otel/processOtelSpans";
import { publishTraceUpdate } from "../realtime/pubsub";

const gunzipAsync = promisify(gunzip);

// Lazy-load the protobuf descriptor to avoid startup cost
let ExportTraceServiceRequest: ReturnType<typeof getProtoType> | null = null;

function getProtoType() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { $root } = require("../ingestion/otel/proto/root");
  return $root.opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest;
}

export const otelRoutes = new Hono();

otelRoutes.post("/", async (c) => {
  try {
    const authResult = await authenticateApiKey(c.req.header("authorization") ?? null);
    if (!authResult.valid) {
      console.warn("[otel] Auth failed:", authResult.error);
      return c.json({ error: authResult.error }, 401);
    }
    console.log("[otel] Authenticated for project:", authResult.projectId);

    let buffer = Buffer.from(await c.req.arrayBuffer());
    console.log(
      "[otel] Received %d bytes, content-type: %s",
      buffer.length,
      c.req.header("content-type"),
    );

    const encoding = c.req.header("content-encoding");
    if (encoding === "gzip") {
      buffer = await gunzipAsync(buffer);
    }

    const contentType = c.req.header("content-type") ?? "";
    let resourceSpans: unknown[];

    if (
      contentType.includes("application/x-protobuf") ||
      contentType.includes("application/protobuf")
    ) {
      if (!ExportTraceServiceRequest) {
        ExportTraceServiceRequest = getProtoType();
      }
      const decoded = ExportTraceServiceRequest!.decode(buffer);
      const obj = ExportTraceServiceRequest!.toObject(decoded, {
        longs: String,
        bytes: Array,
        defaults: true,
      });
      resourceSpans = obj.resourceSpans ?? [];
    } else {
      const parsed = JSON.parse(buffer.toString("utf-8"));
      resourceSpans = parsed.resourceSpans ?? parsed.resource_spans ?? [];
    }

    let spanCount = 0;
    for (const rs of resourceSpans as Array<{ scopeSpans?: Array<{ spans?: unknown[] }> }>) {
      for (const ss of rs?.scopeSpans ?? []) {
        spanCount += ss?.spans?.length ?? 0;
      }
    }
    console.log(
      "[otel] Decoded %d resourceSpans containing %d spans",
      resourceSpans.length,
      spanCount,
    );

    await processOtelResourceSpans(
      resourceSpans as Parameters<typeof processOtelResourceSpans>[0],
      authResult.projectId,
    );
    console.log("[otel] Successfully processed %d spans", spanCount);

    // Publish real-time updates for affected traces
    const traceIds = new Set<string>();
    for (const rs of resourceSpans as Array<{
      scopeSpans?: Array<{ spans?: Array<{ traceId?: unknown }> }>;
    }>) {
      for (const ss of rs?.scopeSpans ?? []) {
        for (const span of ss?.spans ?? []) {
          if (span.traceId) {
            const id =
              typeof span.traceId === "string"
                ? span.traceId
                : Buffer.isBuffer(span.traceId) || span.traceId instanceof Uint8Array
                  ? Buffer.from(span.traceId as Uint8Array).toString("hex")
                  : Array.isArray(span.traceId)
                    ? Buffer.from(span.traceId as number[]).toString("hex")
                    : "";
            if (id) traceIds.add(id);
          }
        }
      }
    }
    for (const traceId of traceIds) {
      publishTraceUpdate(authResult.projectId, traceId);
    }

    return c.json({}, 200);
  } catch (error) {
    console.error("[otel] Unexpected error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
