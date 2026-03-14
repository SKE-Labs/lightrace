import type { Context, Next } from "hono";

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "dev-internal-secret";

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Validates requests coming from the frontend proxy.
 * The frontend sends x-lightrace-internal-secret + user info headers.
 */
export async function internalAuthMiddleware(c: Context, next: Next) {
  const secret = c.req.header("x-lightrace-internal-secret");
  if (secret !== INTERNAL_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
}

/**
 * Extracts user info from internal headers set by the frontend proxy.
 */
export function extractUser(c: Context): AuthUser | null {
  const id = c.req.header("x-lightrace-user-id");
  const email = c.req.header("x-lightrace-user-email");
  if (!id || !email) return null;
  return { id, email };
}
