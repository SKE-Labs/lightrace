import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { db } from "@lightrace/shared/db";
import { checkpointRoutes } from "./checkpoints";
import {
  createTestProject,
  createTestApiKey,
  createTestTrace,
  createTestObservation,
  buildBasicAuthHeader,
} from "../__tests__/helpers";

// Mount the checkpoint routes on a test Hono app
const app = new Hono();
app.route("/api/public/checkpoints", checkpointRoutes);

async function post(path: string, body: unknown, authHeader?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authHeader) headers.Authorization = authHeader;
  const req = new Request(`http://localhost${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return app.request(req);
}

async function get(path: string, authHeader?: string) {
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;
  return app.request(new Request(`http://localhost${path}`, { headers }));
}

describe("POST /api/public/checkpoints", () => {
  it("stores checkpoints and returns count", async () => {
    const project = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project.id });
    const trace = await createTestTrace({ projectId: project.id });
    const obs = await createTestObservation({
      traceId: trace.id,
      projectId: project.id,
      type: "GENERATION",
    });
    const auth = buildBasicAuthHeader(publicKey, secretKey);

    const res = await post(
      "/api/public/checkpoints",
      {
        checkpoints: [
          {
            traceId: trace.id,
            observationId: obs.id,
            threadId: "thread-1",
            stepIndex: 0,
            state: { messages: [{ role: "user", content: "hi" }] },
          },
        ],
      },
      auth,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { response: { count: number } };
    expect(body.response.count).toBe(1);

    const stored = await db.checkpoint.findMany({ where: { traceId: trace.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0]!.threadId).toBe("thread-1");
  });

  it("returns 200 for empty checkpoints array", async () => {
    const project = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project.id });
    const auth = buildBasicAuthHeader(publicKey, secretKey);

    const res = await post("/api/public/checkpoints", { checkpoints: [] }, auth);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("No checkpoints");
  });

  it("returns 401 for invalid auth", async () => {
    const res = await post("/api/public/checkpoints", { checkpoints: [] }, "Basic invalid");
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    const project = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project.id });
    const auth = buildBasicAuthHeader(publicKey, secretKey);

    const res = await post("/api/public/checkpoints", { invalid: true }, auth);
    expect(res.status).toBe(400);
  });

  it("handles duplicate checkpoints with skipDuplicates", async () => {
    const project = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project.id });
    const trace = await createTestTrace({ projectId: project.id });
    const obs = await createTestObservation({
      traceId: trace.id,
      projectId: project.id,
      type: "GENERATION",
    });
    const auth = buildBasicAuthHeader(publicKey, secretKey);
    const checkpoint = {
      traceId: trace.id,
      observationId: obs.id,
      threadId: "thread-1",
      stepIndex: 0,
      state: { v: 1 },
    };

    // First request
    await post("/api/public/checkpoints", { checkpoints: [checkpoint] }, auth);
    // Duplicate — should not throw
    const res = await post("/api/public/checkpoints", { checkpoints: [checkpoint] }, auth);
    expect(res.status).toBe(200);

    const stored = await db.checkpoint.findMany({ where: { traceId: trace.id } });
    expect(stored).toHaveLength(1);
  });
});

describe("GET /api/public/checkpoints/:traceId", () => {
  it("returns checkpoints ordered by stepIndex", async () => {
    const project = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project.id });
    const trace = await createTestTrace({ projectId: project.id });
    const auth = buildBasicAuthHeader(publicKey, secretKey);

    // Create checkpoints in reverse order
    for (const idx of [2, 0, 1]) {
      const obs = await createTestObservation({
        traceId: trace.id,
        projectId: project.id,
        type: "GENERATION",
      });
      await db.checkpoint.create({
        data: {
          projectId: project.id,
          traceId: trace.id,
          observationId: obs.id,
          threadId: "t1",
          stepIndex: idx,
          state: { step: idx },
        },
      });
    }

    const res = await get(`/api/public/checkpoints/${trace.id}`, auth);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response: Array<{ stepIndex: number }> };
    expect(body.response).toHaveLength(3);
    expect(body.response[0]!.stepIndex).toBe(0);
    expect(body.response[1]!.stepIndex).toBe(1);
    expect(body.response[2]!.stepIndex).toBe(2);
  });

  it("returns empty for a different project's trace", async () => {
    const project1 = await createTestProject();
    const project2 = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project2.id });
    const trace = await createTestTrace({ projectId: project1.id });
    const obs = await createTestObservation({
      traceId: trace.id,
      projectId: project1.id,
      type: "SPAN",
    });
    await db.checkpoint.create({
      data: {
        projectId: project1.id,
        traceId: trace.id,
        observationId: obs.id,
        threadId: "t1",
        stepIndex: 0,
        state: {},
      },
    });

    const auth = buildBasicAuthHeader(publicKey, secretKey);
    const res = await get(`/api/public/checkpoints/${trace.id}`, auth);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response: unknown[] };
    expect(body.response).toHaveLength(0);
  });

  it("returns 401 for invalid auth", async () => {
    const res = await get("/api/public/checkpoints/some-trace-id");
    expect(res.status).toBe(401);
  });
});
