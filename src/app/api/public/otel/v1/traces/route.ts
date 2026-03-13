import { NextRequest, NextResponse } from "next/server";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import { authenticateApiKey } from "@/features/ingestion/apiAuth";
import { processOtelResourceSpans } from "@/features/ingestion/otel/processOtelSpans";

const gunzipAsync = promisify(gunzip);

import { $root } from "@/features/ingestion/otel/proto/root";

const ExportTraceServiceRequest =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ($root as any).opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-langfuse-sdk-name, x-langfuse-sdk-version, x-langfuse-public-key",
};

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await authenticateApiKey(request.headers.get("authorization"));
    if (!authResult.valid) {
      console.warn("[otel] Auth failed:", authResult.error);
      return NextResponse.json({ error: authResult.error }, { status: 401, headers: corsHeaders });
    }
    console.log("[otel] Authenticated for project:", authResult.projectId);

    // Read raw body
    let buffer = Buffer.from(await request.arrayBuffer());
    console.log(
      "[otel] Received %d bytes, content-type: %s",
      buffer.length,
      request.headers.get("content-type"),
    );

    // Handle gzip compression
    const encoding = request.headers.get("content-encoding");
    if (encoding === "gzip") {
      buffer = await gunzipAsync(buffer);
    }

    // Deserialize based on content type
    const contentType = request.headers.get("content-type") ?? "";
    let resourceSpans: unknown[];

    if (
      contentType.includes("application/x-protobuf") ||
      contentType.includes("application/protobuf")
    ) {
      const decoded = ExportTraceServiceRequest.decode(buffer);
      const obj = ExportTraceServiceRequest.toObject(decoded, {
        longs: String,
        bytes: Array,
        defaults: true,
      });
      resourceSpans = obj.resourceSpans ?? [];
    } else {
      // JSON fallback
      const parsed = JSON.parse(buffer.toString("utf-8"));
      resourceSpans = parsed.resourceSpans ?? parsed.resource_spans ?? [];
    }

    // Count total spans for logging
    let spanCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const rs of resourceSpans as any[]) {
      for (const ss of rs?.scopeSpans ?? []) {
        spanCount += ss?.spans?.length ?? 0;
      }
    }
    console.log(
      "[otel] Decoded %d resourceSpans containing %d spans",
      resourceSpans.length,
      spanCount,
    );

    // Process spans
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await processOtelResourceSpans(resourceSpans as any[], authResult.projectId);
    console.log("[otel] Successfully processed %d spans", spanCount);

    return NextResponse.json({}, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("[otel] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
