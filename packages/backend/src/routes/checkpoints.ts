/**
 * HTTP endpoint for checkpoint ingestion.
 *
 * SDKs send state snapshots (messages + tools + model + system) at each
 * GENERATION step. These checkpoints enable framework-agnostic fork & replay.
 */
import { Hono } from "hono";
import { z } from "zod";
import { authenticateApiKey } from "@lightrace/shared/auth/apiAuth";
import { db } from "@lightrace/shared/db";
import { apiResponse } from "../utils/api-response";

export const checkpointRoutes = new Hono();

const checkpointSchema = z.object({
  traceId: z.string(),
  observationId: z.string(),
  threadId: z.string(),
  stepIndex: z.number().int().min(0),
  state: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
});

const batchSchema = z.object({
  checkpoints: z.array(checkpointSchema).max(100),
});

/**
 * POST /api/public/checkpoints
 * SDK sends checkpoint state snapshots during tracing.
 */
checkpointRoutes.post("/", async (c) => {
  const authResult = await authenticateApiKey(c.req.header("authorization") ?? null);
  if (!authResult.valid) {
    return apiResponse(c, 401, authResult.error);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return apiResponse(c, 400, "Invalid request body", { details: parsed.error.flatten() });
  }

  const { checkpoints } = parsed.data;
  const { projectId } = authResult;

  if (checkpoints.length === 0) {
    return apiResponse(c, 200, "No checkpoints to store");
  }

  await db.checkpoint.createMany({
    data: checkpoints.map((cp) => ({
      projectId,
      traceId: cp.traceId,
      observationId: cp.observationId,
      threadId: cp.threadId,
      stepIndex: cp.stepIndex,
      state: cp.state as object,
      metadata: (cp.metadata as object) ?? undefined,
    })),
    skipDuplicates: true,
  });

  return apiResponse(c, 200, "Checkpoints stored", { count: checkpoints.length });
});

/**
 * GET /api/public/checkpoints/:traceId
 * List checkpoints for a trace (ordered by step).
 */
checkpointRoutes.get("/:traceId", async (c) => {
  const authResult = await authenticateApiKey(c.req.header("authorization") ?? null);
  if (!authResult.valid) {
    return apiResponse(c, 401, authResult.error);
  }

  const traceId = c.req.param("traceId");
  const checkpoints = await db.checkpoint.findMany({
    where: { traceId, projectId: authResult.projectId },
    orderBy: { stepIndex: "asc" },
  });

  return apiResponse(c, 200, "OK", checkpoints);
});
