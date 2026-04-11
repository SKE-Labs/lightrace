import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { db } from "@lightrace/shared/db";
import { toolsRegistryRoutes } from "./tools-registry";
import { createTestProject, createTestApiKey, buildBasicAuthHeader } from "../__tests__/helpers";

const app = new Hono();
app.route("/api/public/tools", toolsRegistryRoutes);

async function req(method: string, path: string, body?: unknown, authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;
  if (body) headers["Content-Type"] = "application/json";
  return app.request(
    new Request(`http://localhost${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}

describe("POST /api/public/tools/register", () => {
  it("registers tools with capabilities", async () => {
    const project = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project.id });
    const auth = buildBasicAuthHeader(publicKey, secretKey);

    const res = await req(
      "POST",
      "/api/public/tools/register",
      {
        callbackUrl: "http://localhost:9999",
        tools: [
          { name: "search", description: "Search tool" },
          { name: "calc", description: "Calculator" },
        ],
        capabilities: { replay: true, framework: "langgraph" },
      },
      auth,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { response: { registered: string[] } };
    expect(body.response.registered).toEqual(["search", "calc"]);

    const tools = await db.toolRegistration.findMany({
      where: { projectId: project.id },
      orderBy: { toolName: "asc" },
    });
    expect(tools).toHaveLength(2);
    expect(tools[0]!.toolName).toBe("calc");
    expect(tools[0]!.capabilities).toEqual({ replay: true, framework: "langgraph" });
  });

  it("upserts on second call and cleans stale tools", async () => {
    const project = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project.id });
    const auth = buildBasicAuthHeader(publicKey, secretKey);

    // First registration
    await req(
      "POST",
      "/api/public/tools/register",
      {
        callbackUrl: "http://localhost:9999",
        tools: [{ name: "old-tool" }, { name: "keep-tool" }],
      },
      auth,
    );

    // Second registration — removes old-tool, keeps keep-tool, adds new-tool
    await req(
      "POST",
      "/api/public/tools/register",
      {
        callbackUrl: "http://localhost:9999",
        tools: [{ name: "keep-tool" }, { name: "new-tool" }],
      },
      auth,
    );

    const tools = await db.toolRegistration.findMany({
      where: { projectId: project.id },
      orderBy: { toolName: "asc" },
    });
    const names = tools.map((t) => t.toolName);
    expect(names).toEqual(["keep-tool", "new-tool"]);
  });

  it("rejects invalid auth", async () => {
    const res = await req(
      "POST",
      "/api/public/tools/register",
      {
        callbackUrl: "http://localhost:9999",
        tools: [{ name: "x" }],
      },
      "Basic invalid",
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /api/public/tools", () => {
  it("returns tools for project", async () => {
    const project = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project.id });
    const auth = buildBasicAuthHeader(publicKey, secretKey);

    await db.toolRegistration.create({
      data: {
        projectId: project.id,
        toolName: "my-tool",
        callbackUrl: "http://localhost:9999",
      },
    });

    const res = await req("GET", "/api/public/tools", undefined, auth);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response: Array<{ toolName: string }> };
    expect(body.response).toHaveLength(1);
    expect(body.response[0]!.toolName).toBe("my-tool");
  });
});

describe("DELETE /api/public/tools/:name", () => {
  it("deletes an existing tool", async () => {
    const project = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project.id });
    const auth = buildBasicAuthHeader(publicKey, secretKey);

    await db.toolRegistration.create({
      data: { projectId: project.id, toolName: "to-delete", callbackUrl: "" },
    });

    const res = await req("DELETE", "/api/public/tools/to-delete", undefined, auth);
    expect(res.status).toBe(200);

    const found = await db.toolRegistration.findFirst({
      where: { projectId: project.id, toolName: "to-delete" },
    });
    expect(found).toBeNull();
  });

  it("returns 404 for nonexistent tool", async () => {
    const project = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project.id });
    const auth = buildBasicAuthHeader(publicKey, secretKey);

    const res = await req("DELETE", "/api/public/tools/nonexistent", undefined, auth);
    expect(res.status).toBe(404);
  });
});
