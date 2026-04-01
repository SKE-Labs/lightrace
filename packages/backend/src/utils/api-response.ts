import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function apiResponse(c: Context, code: number, message: string, response: unknown = null) {
  return c.json({ code, message, response }, code as ContentfulStatusCode);
}
