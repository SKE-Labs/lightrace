import { describe, it, expect } from "vitest";
import { db } from "@lightrace/shared/db";
import { processOtelResourceSpans } from "./processOtelSpans";
import { createTestProject } from "../../__tests__/helpers";

/** Helper to build a minimal OTel ResourceSpan structure. */
function buildResourceSpan(opts: {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name?: string;
  startTimeUnixNano?: string;
  endTimeUnixNano?: string;
  attributes?: Array<{ key: string; value: Record<string, unknown> }>;
  status?: { code?: number; message?: string };
}) {
  return {
    resource: { attributes: [] },
    scopeSpans: [
      {
        spans: [
          {
            traceId: opts.traceId,
            spanId: opts.spanId,
            parentSpanId: opts.parentSpanId,
            name: opts.name ?? "test-span",
            startTimeUnixNano: opts.startTimeUnixNano ?? "1700000000000000000",
            endTimeUnixNano: opts.endTimeUnixNano ?? "1700000001000000000",
            attributes: opts.attributes ?? [],
            status: opts.status,
          },
        ],
      },
    ],
  };
}

function attr(key: string, stringValue: string) {
  return { key, value: { stringValue } };
}

function attrInt(key: string, intValue: number) {
  return { key, value: { intValue } };
}

describe("processOtelResourceSpans", () => {
  // ── Core span processing ───────────────────────────────────────────

  describe("core span processing", () => {
    it("creates trace and observation from a root span", async () => {
      const project = await createTestProject();
      await processOtelResourceSpans(
        [buildResourceSpan({ traceId: "aabb", spanId: "cc11", name: "root-span" })],
        project.id,
      );

      const trace = await db.trace.findUnique({ where: { id: "aabb" } });
      expect(trace).not.toBeNull();
      expect(trace!.name).toBe("root-span");

      const obs = await db.observation.findUnique({ where: { id: "cc11" } });
      expect(obs).not.toBeNull();
      expect(obs!.traceId).toBe("aabb");
      expect(obs!.type).toBe("SPAN");
    });

    it("creates child observation with parentObservationId", async () => {
      const project = await createTestProject();
      await processOtelResourceSpans(
        [
          {
            resource: { attributes: [] },
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: "aabb",
                    spanId: "parent1",
                    name: "root",
                    startTimeUnixNano: "1700000000000000000",
                    endTimeUnixNano: "1700000001000000000",
                    attributes: [],
                  },
                  {
                    traceId: "aabb",
                    spanId: "child1",
                    parentSpanId: "parent1",
                    name: "child",
                    startTimeUnixNano: "1700000000100000000",
                    endTimeUnixNano: "1700000000900000000",
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
        project.id,
      );

      const child = await db.observation.findUnique({ where: { id: "child1" } });
      expect(child!.parentObservationId).toBe("parent1");
    });

    it("populates trace from lightrace.trace.* attributes", async () => {
      const project = await createTestProject();
      await processOtelResourceSpans(
        [
          buildResourceSpan({
            traceId: "aabb",
            spanId: "cc11",
            attributes: [
              attr("lightrace.trace.name", "custom-name"),
              attr("lightrace.trace.user_id", "user-123"),
              attr("lightrace.trace.session_id", "sess-456"),
              attr("lightrace.trace.tags", '["t1","t2"]'),
            ],
          }),
        ],
        project.id,
      );

      const trace = await db.trace.findUnique({ where: { id: "aabb" } });
      expect(trace!.name).toBe("custom-name");
      expect(trace!.userId).toBe("user-123");
      expect(trace!.sessionId).toBe("sess-456");
      expect(trace!.tags).toEqual(["t1", "t2"]);
    });

    it("populates trace from langfuse.* compat attributes", async () => {
      const project = await createTestProject();
      await processOtelResourceSpans(
        [
          buildResourceSpan({
            traceId: "aabb",
            spanId: "cc11",
            attributes: [
              attr("langfuse.trace.name", "compat-name"),
              attr("langfuse.user.id", "lf-user"),
              attr("langfuse.session.id", "lf-sess"),
            ],
          }),
        ],
        project.id,
      );

      const trace = await db.trace.findUnique({ where: { id: "aabb" } });
      expect(trace!.name).toBe("compat-name");
      expect(trace!.userId).toBe("lf-user");
      expect(trace!.sessionId).toBe("lf-sess");
    });

    it("handles empty resourceSpans as no-op", async () => {
      const project = await createTestProject();
      await processOtelResourceSpans([], project.id);
      const traces = await db.trace.findMany({ where: { projectId: project.id } });
      expect(traces).toHaveLength(0);
    });
  });

  // ── Usage and cost ─────────────────────────────────────────────────

  describe("usage and cost", () => {
    it("extracts token counts from gen_ai.usage.* attributes", async () => {
      const project = await createTestProject();
      await processOtelResourceSpans(
        [
          buildResourceSpan({
            traceId: "aabb",
            spanId: "cc11",
            attributes: [
              attrInt("gen_ai.usage.input_tokens", 100),
              attrInt("gen_ai.usage.output_tokens", 50),
            ],
          }),
        ],
        project.id,
      );

      const obs = await db.observation.findUnique({ where: { id: "cc11" } });
      expect(obs!.promptTokens).toBe(100);
      expect(obs!.completionTokens).toBe(50);
      expect(obs!.totalTokens).toBe(150);
    });

    it("parses lightrace.observation.usage_details JSON string", async () => {
      const project = await createTestProject();
      await processOtelResourceSpans(
        [
          buildResourceSpan({
            traceId: "aabb",
            spanId: "cc11",
            attributes: [
              attr(
                "lightrace.observation.usage_details",
                JSON.stringify({ input: 200, output: 100, total: 300 }),
              ),
            ],
          }),
        ],
        project.id,
      );

      const obs = await db.observation.findUnique({ where: { id: "cc11" } });
      expect(obs!.promptTokens).toBe(200);
      expect(obs!.completionTokens).toBe(100);
      expect(obs!.totalTokens).toBe(300);
    });

    it("extracts cost details", async () => {
      const project = await createTestProject();
      await processOtelResourceSpans(
        [
          buildResourceSpan({
            traceId: "aabb",
            spanId: "cc11",
            attributes: [
              attr(
                "lightrace.observation.cost_details",
                JSON.stringify({ input: 0.01, output: 0.02, total: 0.03 }),
              ),
            ],
          }),
        ],
        project.id,
      );

      const obs = await db.observation.findUnique({ where: { id: "cc11" } });
      expect(obs!.inputCost).toBeCloseTo(0.01);
      expect(obs!.outputCost).toBeCloseTo(0.02);
      expect(obs!.totalCost).toBeCloseTo(0.03);
    });
  });

  // ── Level and status ───────────────────────────────────────────────

  describe("level and status", () => {
    it("defaults to DEFAULT level when no explicit level and status code 2 (parseLevel returns DEFAULT, not null)", async () => {
      // Note: span.status.code === 2 fallback is unreachable because parseLevel always returns a value.
      // This test documents the actual behavior.
      const project = await createTestProject();
      await processOtelResourceSpans(
        [
          buildResourceSpan({
            traceId: "aabb",
            spanId: "cc11",
            status: { code: 2, message: "something failed" },
          }),
        ],
        project.id,
      );

      const obs = await db.observation.findUnique({ where: { id: "cc11" } });
      expect(obs!.level).toBe("DEFAULT");
      expect(obs!.statusMessage).toBe("something failed");
    });

    it("explicit lightrace.observation.level takes precedence", async () => {
      const project = await createTestProject();
      await processOtelResourceSpans(
        [
          buildResourceSpan({
            traceId: "aabb",
            spanId: "cc11",
            attributes: [attr("lightrace.observation.level", "WARNING")],
            status: { code: 2 },
          }),
        ],
        project.id,
      );

      const obs = await db.observation.findUnique({ where: { id: "cc11" } });
      expect(obs!.level).toBe("WARNING");
    });
  });

  // ── Tool call ID via OTel ───────────────────────────────────────────

  it("sets toolCallId on observation from lightrace.tool.call_id", async () => {
    const project = await createTestProject();
    await processOtelResourceSpans(
      [
        buildResourceSpan({
          traceId: "aabb",
          spanId: "cc11",
          attributes: [
            attr("lightrace.observation.type", "TOOL"),
            attr("lightrace.tool.call_id", "call_abc123"),
          ],
        }),
      ],
      project.id,
    );

    const obs = await db.observation.findUnique({ where: { id: "cc11" } });
    expect(obs!.toolCallId).toBe("call_abc123");
  });

  // ── Aggregates ─────────────────────────────────────────────────────

  it("updates trace aggregates after processing", async () => {
    const project = await createTestProject();
    await processOtelResourceSpans(
      [
        buildResourceSpan({
          traceId: "aabb",
          spanId: "cc11",
          attributes: [
            attrInt("gen_ai.usage.input_tokens", 100),
            attrInt("gen_ai.usage.output_tokens", 50),
          ],
        }),
      ],
      project.id,
    );

    const trace = await db.trace.findUnique({ where: { id: "aabb" } });
    expect(trace!.totalTokens).toBe(150);
    expect(trace!.observationCount).toBe(1);
  });
});
