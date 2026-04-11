import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { db } from "@lightrace/shared/db";
import { ingestionRoutes } from "./ingestion";
import { createTestProject, createTestApiKey, buildBasicAuthHeader } from "../__tests__/helpers";

const app = new Hono();
app.route("/api/public/ingestion", ingestionRoutes);

async function post(body: unknown, authHeader?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authHeader) headers.Authorization = authHeader;
  return app.request(
    new Request("http://localhost/api/public/ingestion", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/public/ingestion", () => {
  it("returns 207 with successes for valid batch", async () => {
    const project = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project.id });
    const auth = buildBasicAuthHeader(publicKey, secretKey);

    const res = await post(
      {
        batch: [
          {
            id: "trace-1",
            type: "trace-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: { id: "trace-1", name: "test" },
          },
        ],
      },
      auth,
    );

    expect(res.status).toBe(207);
    const body = (await res.json()) as { response: { successes: unknown[]; errors: unknown[] } };
    expect(body.response.successes).toHaveLength(1);
    expect(body.response.errors).toHaveLength(0);

    const trace = await db.trace.findUnique({ where: { id: "trace-1" } });
    expect(trace).not.toBeNull();
  });

  it("returns 401 for invalid auth", async () => {
    const res = await post({ batch: [] }, "Basic invalid");
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    const project = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project.id });
    const auth = buildBasicAuthHeader(publicKey, secretKey);

    const res = await post({ not_a_batch: true }, auth);
    expect(res.status).toBe(400);
  });

  it("returns 207 with both successes and errors for mixed batch", async () => {
    const project = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project.id });
    const auth = buildBasicAuthHeader(publicKey, secretKey);

    const res = await post(
      {
        batch: [
          {
            id: "good",
            type: "trace-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: { id: "good-trace", name: "valid" },
          },
          {
            id: "bad",
            type: "invalid-type",
            timestamp: "2026-01-01T00:00:00Z",
            body: {},
          },
        ],
      },
      auth,
    );

    expect(res.status).toBe(207);
    const body = (await res.json()) as { response: { successes: unknown[]; errors: unknown[] } };
    expect(body.response.successes).toHaveLength(1);
    expect(body.response.errors).toHaveLength(1);
  });
});
