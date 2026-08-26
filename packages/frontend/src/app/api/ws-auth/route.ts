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
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    // Production behind Caddy: single external port (LIGHTRACE_PORT), /ws proxied to backend:WS_PORT
    // Caddyfile: handle /ws { reverse_proxy lightrace-backend:{$WS_PORT:3003} }
    wsUrl = `${proto}://${host}/ws?${params.toString()}`;
  } else {
    // Local dev (pnpm dev): no Caddy, frontend :3001 → backend WS direct :3003
    const wsPort = process.env.WS_PORT || "3003";
    const hostname = host.split(":")[0] || "localhost";
    wsUrl = `ws://${hostname}:${wsPort}?${params.toString()}`;
  }

  return NextResponse.json({
    code: 200,
    message: "OK",
    response: { wsUrl },
  });
}
