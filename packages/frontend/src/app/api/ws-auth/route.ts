import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/server/auth";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "dev-internal-secret";

/**
 * Returns WebSocket connection parameters for the authenticated user.
 * The WS URL uses the /ws path which Caddy proxies to the backend WS server.
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { code: 401, message: "Unauthorized", response: null },
      { status: 401 },
    );
  }

  // Derive WS URL from the incoming request's host (works behind Caddy/reverse proxy)
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") === "https" ? "wss" : "ws";

  const params = new URLSearchParams({
    secret: INTERNAL_SECRET,
    userId: session.user.id ?? "",
    userEmail: session.user.email ?? "",
  });

  return NextResponse.json({
    code: 200,
    message: "OK",
    response: { wsUrl: `${proto}://${host}/ws?${params.toString()}` },
  });
}
