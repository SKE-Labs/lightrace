import { NextResponse } from "next/server";
import { auth } from "@/server/auth";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "dev-internal-secret";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3002";
const WS_PORT = process.env.WS_PORT || "3003";

/**
 * Returns WebSocket connection parameters for the authenticated user.
 * The frontend calls this to get the WS URL with embedded auth.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { code: 401, message: "Unauthorized", response: null },
      { status: 401 },
    );
  }

  // Build WS URL with auth params
  const backendHost = new URL(BACKEND_URL).hostname;
  const params = new URLSearchParams({
    secret: INTERNAL_SECRET,
    userId: session.user.id ?? "",
    userEmail: session.user.email ?? "",
  });

  return NextResponse.json({
    code: 200,
    message: "OK",
    response: { wsUrl: `ws://${backendHost}:${WS_PORT}?${params.toString()}` },
  });
}
