import { describe, it, expect } from "vitest";
import { db } from "@lightrace/shared/db";
import {
  createTestUser,
  createTestProject,
  createTestMembership,
  createTestTrace,
  createTestObservation,
  createCaller,
} from "../../__tests__/helpers";

describe("traces.list", () => {
  it("returns paginated root traces with forks nested under their parent", async () => {
    const user = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project.id });

    const trace1 = await createTestTrace({ projectId: project.id, name: "trace-1" });
    await createTestTrace({ projectId: project.id, name: "trace-2" });
    const forked = await createTestTrace({ projectId: project.id, name: "forked", isFork: true });

    await db.traceFork.create({
      data: {
        sourceTraceId: trace1.id,
        forkedTraceId: forked.id,
        forkPointId: "obs-1",
        projectId: project.id,
      },
    });

    const caller = createCaller(user.id, user.email);
    const result = await caller.traces.list({ projectId: project.id, limit: 10, page: 1 });

    // Forks are nested under their parent — totals reflect roots only.
    expect(result.items.length).toBe(2);
    expect(result.totalCount).toBe(2);

    const t1 = result.items.find((t) => t.id === trace1.id);
    expect(t1!.forkCount).toBe(1);
    expect(t1!.forks).toHaveLength(1);
    expect(t1!.forks[0]!.id).toBe(forked.id);
    expect(t1!.forks[0]!.isFork).toBe(true);

    const t2 = result.items.find((t) => t.name === "trace-2");
    expect(t2!.forks).toHaveLength(0);

    // Forks should not appear at the root level
    expect(result.items.find((t) => t.id === forked.id)).toBeUndefined();
  });

  it("searches by name (case-insensitive)", async () => {
    const user = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project.id });
    await createTestTrace({ projectId: project.id, name: "Agent Run" });
    await createTestTrace({ projectId: project.id, name: "Pipeline" });

    const caller = createCaller(user.id, user.email);
    const result = await caller.traces.list({ projectId: project.id, search: "agent" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.name).toBe("Agent Run");
  });
});

describe("traces.byId", () => {
  it("returns trace with observations and fork metadata", async () => {
    const user = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project.id });
    const trace = await createTestTrace({ projectId: project.id });
    await createTestObservation({ traceId: trace.id, projectId: project.id, type: "SPAN" });

    const caller = createCaller(user.id, user.email);
    const result = await caller.traces.byId({ projectId: project.id, id: trace.id });
    expect(result).not.toBeNull();
    expect(result!.observations).toHaveLength(1);
  });

  it("returns null for trace in different project", async () => {
    const user = await createTestUser();
    const project1 = await createTestProject();
    const project2 = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project1.id });
    await createTestMembership({ userId: user.id, projectId: project2.id });
    const trace = await createTestTrace({ projectId: project2.id });

    const caller = createCaller(user.id, user.email);
    const result = await caller.traces.byId({ projectId: project1.id, id: trace.id });
    expect(result).toBeNull();
  });
});

describe("traces.delete", () => {
  it("admin can delete a trace", async () => {
    const user = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project.id, role: "ADMIN" });
    const trace = await createTestTrace({ projectId: project.id });

    const caller = createCaller(user.id, user.email);
    await caller.traces.delete({ projectId: project.id, id: trace.id });

    const found = await db.trace.findUnique({ where: { id: trace.id } });
    expect(found).toBeNull();
  });
});
