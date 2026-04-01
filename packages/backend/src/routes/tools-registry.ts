/**
 * HTTP endpoints for tool registration and listing.
 *
 * Replaces the WebSocket-based tool registration. SDKs register their
 * tool definitions + dev server callbackUrl via HTTP POST.
 */
import { Hono } from "hono";
import { z } from "zod";
import { authenticateApiKey } from "@lightrace/shared/auth/apiAuth";
import { db } from "@lightrace/shared/db";
import { apiResponse } from "../utils/api-response";

export const toolsRegistryRoutes = new Hono();

/** Shared DTO shape for tool registrations (used by both HTTP and tRPC). */
export function toToolDto(t: {
  id: string;
  toolName: string;
  description: string | null;
  inputSchema: unknown;
  callbackUrl: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    toolName: t.toolName,
    description: t.description as string | null,
    inputSchema: t.inputSchema as Record<string, unknown> | null,
    callbackUrl: t.callbackUrl as string,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

const registerSchema = z.object({
  callbackUrl: z.string().url(),
  tools: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().nullish(),
      inputSchema: z.unknown().optional(),
    }),
  ),
});

/**
 * POST /api/public/tools/register
 * SDK registers tool definitions with a callbackUrl for invocation.
 */
toolsRegistryRoutes.post("/register", async (c) => {
  const authResult = await authenticateApiKey(c.req.header("authorization") ?? null);
  if (!authResult.valid) {
    return apiResponse(c, 401, authResult.error);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return apiResponse(c, 400, "Invalid request body", { details: parsed.error.flatten() });
  }

  const { callbackUrl, tools } = parsed.data;
  const { projectId } = authResult;
  const toolNames = tools.map((t) => t.name);

  await db.$transaction([
    ...tools.map((tool) =>
      db.toolRegistration.upsert({
        where: {
          projectId_toolName: {
            projectId,
            toolName: tool.name,
          },
        },
        create: {
          projectId,
          toolName: tool.name,
          description: tool.description ?? null,
          inputSchema: (tool.inputSchema as object) ?? undefined,
          callbackUrl,
        },
        update: {
          description: tool.description ?? null,
          inputSchema: (tool.inputSchema as object) ?? undefined,
          callbackUrl,
        },
      }),
    ),
    db.toolRegistration.deleteMany({
      where: {
        projectId,
        callbackUrl,
        toolName: { notIn: toolNames },
      },
    }),
  ]);

  console.log(
    `[tools-registry] Registered ${toolNames.length} tool(s) for project ${projectId}: ${toolNames.join(", ")}`,
  );

  return apiResponse(c, 200, "Tools registered", { registered: toolNames });
});

/**
 * GET /api/public/tools
 * List registered tools for a project.
 */
toolsRegistryRoutes.get("/", async (c) => {
  const authResult = await authenticateApiKey(c.req.header("authorization") ?? null);
  if (!authResult.valid) {
    return apiResponse(c, 401, authResult.error);
  }

  const tools = await db.toolRegistration.findMany({
    where: { projectId: authResult.projectId },
    orderBy: { toolName: "asc" },
  });

  return apiResponse(c, 200, "OK", tools.map(toToolDto));
});

/**
 * DELETE /api/public/tools/:name
 * Unregister a tool.
 */
toolsRegistryRoutes.delete("/:name", async (c) => {
  const authResult = await authenticateApiKey(c.req.header("authorization") ?? null);
  if (!authResult.valid) {
    return apiResponse(c, 401, authResult.error);
  }

  const toolName = c.req.param("name");

  const deleted = await db.toolRegistration.deleteMany({
    where: {
      projectId: authResult.projectId,
      toolName,
    },
  });

  if (deleted.count === 0) {
    return apiResponse(c, 404, `Tool not found: ${toolName}`);
  }

  return apiResponse(c, 200, "Tool deleted", { deleted: toolName });
});
