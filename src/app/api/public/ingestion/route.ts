import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/features/ingestion/apiAuth";
import { ingestionBatchSchema } from "@/features/ingestion/schemas";
import { processEventBatch } from "@/features/ingestion/processEventBatch";

export async function POST(request: NextRequest) {
  // CORS headers for SDK compatibility
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    // Authenticate
    const authResult = await authenticateApiKey(
      request.headers.get("authorization")
    );

    if (!authResult.valid) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse body
    const rawBody = await request.json();
    const parsed = ingestionBatchSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.message },
        { status: 400, headers: corsHeaders }
      );
    }

    // Process batch
    const result = await processEventBatch(
      parsed.data.batch,
      authResult.projectId
    );

    return NextResponse.json(result, { status: 207, headers: corsHeaders });
  } catch (error) {
    console.error("[ingestion] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
