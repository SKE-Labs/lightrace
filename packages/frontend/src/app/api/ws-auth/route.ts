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

  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") === "https" ? "wss" : "ws";

  const params = new URLSearchParams({
    secret: INTERNAL_SECRET,
    userId: session.user.id ?? "",
    userEmail: session.user.email ?? "",
  });

  let wsUrl: string;
  const wsPort = process.env.WS_PORT;
  if (wsPort && !request.headers.get("x-forwarded-host")) {
    // Dev mode: no reverse proxy, connect directly to the backend WS server
    const hostname = host.split(":")[0];
    wsUrl = `ws://${hostname}:${wsPort}?${params.toString()}`;
  } else {
    // Production (behind Caddy/reverse proxy): use /ws path
    wsUrl = `${proto}://${host}/ws?${params.toString()}`;
  }

  return NextResponse.json({
    code: 200,
    message: "OK",
    response: { wsUrl },
  });
}
