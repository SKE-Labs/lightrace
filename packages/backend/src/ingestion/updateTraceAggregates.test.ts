import { describe, it, expect } from "vitest";
import { db } from "@lightrace/shared/db";
import { updateTraceAggregates } from "./updateTraceAggregates";
import { createTestProject, createTestTrace, createTestObservation } from "../__tests__/helpers";

describe("updateTraceAggregates", () => {
  it("sets defaults when trace has no observations", async () => {
    const project = await createTestProject();
    const trace = await createTestTrace({ projectId: project.id });

    await updateTraceAggregates(db, trace.id);

    const updated = await db.trace.findUnique({ where: { id: trace.id } });
    expect(updated!.totalTokens).toBe(0);
    expect(updated!.observationCount).toBe(0);
    expect(updated!.latencyMs).toBeNull();
    expect(updated!.level).toBe("DEFAULT");
    expect(updated!.primaryModel).toBeNull();
  });

  it("aggregates a single GENERATION observation", async () => {
    const project = await createTestProject();
    const trace = await createTestTrace({ projectId: project.id });
    await createTestObservation({
      traceId: trace.id,
      projectId: project.id,
      type: "GENERATION",
      model: "gpt-4o",
      totalTokens: 150,
      promptTokens: 100,
      completionTokens: 50,
    });

    await updateTraceAggregates(db, trace.id);

    const updated = await db.trace.findUnique({ where: { id: trace.id } });
    expect(updated!.totalTokens).toBe(150);
    expect(updated!.observationCount).toBe(1);
    expect(updated!.primaryModel).toBe("gpt-4o");
  });

  it("sums tokens and counts across multiple observations", async () => {
    const project = await createTestProject();
    const trace = await createTestTrace({ projectId: project.id });
    const now = new Date();
    const later = new Date(now.getTime() + 5000);

    await createTestObservation({
      traceId: trace.id,
      projectId: project.id,
      type: "SPAN",
      totalTokens: 100,
      startTime: now,
      endTime: later,
    });
    await createTestObservation({
      traceId: trace.id,
      projectId: project.id,
      type: "GENERATION",
      model: "claude-3",
      totalTokens: 200,
      startTime: now,
      endTime: new Date(now.getTime() + 3000),
    });

    await updateTraceAggregates(db, trace.id);

    const updated = await db.trace.findUnique({ where: { id: trace.id } });
    expect(updated!.totalTokens).toBe(300);
    expect(updated!.observationCount).toBe(2);
    expect(updated!.latencyMs).toBeGreaterThanOrEqual(4000);
  });

  it("sets level to ERROR when any observation has ERROR level", async () => {
    const project = await createTestProject();
    const trace = await createTestTrace({ projectId: project.id });
    await createTestObservation({
      traceId: trace.id,
      projectId: project.id,
      type: "SPAN",
      level: "WARNING",
    });
    await createTestObservation({
      traceId: trace.id,
      projectId: project.id,
      type: "SPAN",
      level: "ERROR",
    });

    await updateTraceAggregates(db, trace.id);

    const updated = await db.trace.findUnique({ where: { id: trace.id } });
    expect(updated!.level).toBe("ERROR");
  });

  it("sets level to WARNING when highest is WARNING", async () => {
    const project = await createTestProject();
    const trace = await createTestTrace({ projectId: project.id });
    await createTestObservation({
      traceId: trace.id,
      projectId: project.id,
      type: "SPAN",
      level: "DEFAULT",
    });
    await createTestObservation({
      traceId: trace.id,
      projectId: project.id,
      type: "SPAN",
      level: "WARNING",
    });

    await updateTraceAggregates(db, trace.id);

    const updated = await db.trace.findUnique({ where: { id: trace.id } });
    expect(updated!.level).toBe("WARNING");
  });

  it("sums totalCost across observations", async () => {
    const project = await createTestProject();
    const trace = await createTestTrace({ projectId: project.id });
    await createTestObservation({
      traceId: trace.id,
      projectId: project.id,
      type: "GENERATION",
      totalCost: 0.01,
    });
    await createTestObservation({
      traceId: trace.id,
      projectId: project.id,
      type: "GENERATION",
      totalCost: 0.02,
    });

    await updateTraceAggregates(db, trace.id);

    const updated = await db.trace.findUnique({ where: { id: trace.id } });
    expect(updated!.totalCost).toBeCloseTo(0.03);
  });
});
