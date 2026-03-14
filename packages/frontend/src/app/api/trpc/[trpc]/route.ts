import { auth } from "@/server/auth";
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3002";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "dev-internal-secret";

async function handler(req: Request) {
  const session = await auth();

  const url = new URL(req.url);
  const trpcPath = url.pathname.replace("/api/trpc", "/trpc");
  const targetUrl = `${BACKEND_URL}${trpcPath}${url.search}`;

  const headers = new Headers();
  headers.set("content-type", req.headers.get("content-type") || "application/json");
  headers.set("x-lightrace-internal-secret", INTERNAL_SECRET);
  if (session?.user) {
    headers.set("x-lightrace-user-id", session.user.id ?? "");
    headers.set("x-lightrace-user-email", session.user.email ?? "");
  }

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: req.method !== "GET" ? await req.text() : undefined,
  });

  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  });
}

export { handler as GET, handler as POST };
