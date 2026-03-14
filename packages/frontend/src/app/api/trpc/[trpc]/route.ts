import { auth } from "@/server/auth";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3002";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "dev-internal-secret";

async function handler(req: Request) {
  const session = await auth();

  const url = new URL(req.url);
  const trpcPath = url.pathname.replace("/api/trpc", "/trpc");
  const targetUrl = `${BACKEND_URL}${trpcPath}${url.search}`;

  const headers = new Headers(req.headers);
  headers.set("x-lightrace-internal-secret", INTERNAL_SECRET);
  if (session?.user) {
    headers.set("x-lightrace-user-id", session.user.id ?? "");
    headers.set("x-lightrace-user-email", session.user.email ?? "");
  }

  // Remove host header to avoid conflicts
  headers.delete("host");

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: req.method !== "GET" ? req.body : undefined,
    // @ts-expect-error duplex needed for streaming body
    duplex: "half",
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export { handler as GET, handler as POST };
