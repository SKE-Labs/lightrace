import { describe, it, expect } from "vitest";
import { db } from "@lightrace/shared/db";
import { createTestProject } from "../__tests__/helpers";
import { randomUUID, randomBytes } from "crypto";
import { pruneErrorEvents } from "./pruneErrorEvents";

async function createExpiredIssueAndEvents(
  projectId: string,
  opts: { expiredCount: number; freshCount: number },
) {
  const now = new Date();
  const expiredDate = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000); // 91 days ago
  const freshDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

  const issue = await db.errorIssue.create({
    data: {
      id: randomBytes(12).toString("hex"),
      shortId: `ERR-${randomBytes(4).toString("hex").toUpperCase()}`,
      projectId,
      fingerprint: randomBytes(16).toString("hex"),
      type: "TOOL",
      toolName: "search",
      title: "test error",
      level: "ERROR",
      status: "UNRESOLVED",
      priority: "MEDIUM",
      count: opts.expiredCount + opts.freshCount,
      traceCount: opts.expiredCount + opts.freshCount,
      userCount: 0,
      firstSeen: expiredDate,
      lastSeen: freshDate,
      firstTraceId: randomUUID(),
      lastTraceId: randomUUID(),
    },
  });

  // Create expired events
  for (let i = 0; i < opts.expiredCount; i++) {
    const traceId = randomUUID();
    await db.trace.upsert({
      where: { id: traceId },
      create: { id: traceId, projectId },
      update: {},
    });
    const obsId = randomUUID();
    await db.observation.create({
      data: {
        id: obsId,
        traceId,
        projectId,
        type: "TOOL",
        name: "search",
        level: "ERROR",
        statusMessage: "boom",
      },
    });
    const expiresAt = new Date(expiredDate);
    expiresAt.setDate(expiresAt.getDate() + 90); // expires 1 day ago (91-90=1 day ago)
    await db.errorEvent.create({
      data: {
        id: obsId,
        issueId: issue.id,
        projectId,
        observationId: obsId,
        traceId,
        timestamp: expiredDate,
        errorValue: "boom",
        expiresAt,
      },
    });
  }

  // Create fresh events
  for (let i = 0; i < opts.freshCount; i++) {
    const traceId = randomUUID();
    await db.trace.upsert({
      where: { id: traceId },
      create: { id: traceId, projectId },
      update: {},
    });
    const obsId = randomUUID();
    await db.observation.create({
      data: {
        id: obsId,
        traceId,
        projectId,
        type: "TOOL",
        name: "search",
        level: "ERROR",
        statusMessage: "boom",
      },
    });
    const expiresAt = new Date(freshDate);
    expiresAt.setDate(expiresAt.getDate() + 90); // expires in 80 days
    await db.errorEvent.create({
      data: {
        id: obsId,
        issueId: issue.id,
        projectId,
        observationId: obsId,
        traceId,
        timestamp: freshDate,
        errorValue: "boom",
        expiresAt,
      },
    });
  }

  return issue;
}

describe("pruneErrorEvents", () => {
  it("deletes expired events and updates issue count", async () => {
    const project = await createTestProject();
    const issue = await createExpiredIssueAndEvents(project.id, { expiredCount: 2, freshCount: 1 });

    const initialEvents = await db.errorEvent.count({ where: { issueId: issue.id } });
    expect(initialEvents).toBe(3);

    const result = await pruneErrorEvents();
    expect(result.deletedEvents).toBe(2);

    const remainingEvents = await db.errorEvent.count({ where: { issueId: issue.id } });
    expect(remainingEvents).toBe(1);

    const updatedIssue = await db.errorIssue.findUnique({ where: { id: issue.id } });
    expect(updatedIssue!.count).toBe(1);
    expect(updatedIssue!.traceCount).toBe(1);
    expect(updatedIssue!.status).toBe("UNRESOLVED"); // still has events
  });

  it("archives issue when all events pruned", async () => {
    const project = await createTestProject();
    const issue = await createExpiredIssueAndEvents(project.id, { expiredCount: 2, freshCount: 0 });

    await pruneErrorEvents();

    const updatedIssue = await db.errorIssue.findUnique({ where: { id: issue.id } });
    expect(updatedIssue!.count).toBe(0);
    expect(updatedIssue!.status).toBe("ARCHIVED");
  });

  it("does not delete fresh events", async () => {
    const project = await createTestProject();
    const issue = await createExpiredIssueAndEvents(project.id, { expiredCount: 0, freshCount: 2 });

    const result = await pruneErrorEvents();
    expect(result.deletedEvents).toBe(0);

    const remaining = await db.errorEvent.count({ where: { issueId: issue.id } });
    expect(remaining).toBe(2);
  });

  it("handles multiple issues", async () => {
    const project = await createTestProject();
    await createExpiredIssueAndEvents(project.id, { expiredCount: 1, freshCount: 0 });
    await createExpiredIssueAndEvents(project.id, { expiredCount: 1, freshCount: 1 });

    const result = await pruneErrorEvents();
    expect(result.deletedEvents).toBe(2);

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(2);
    const archived = issues.find((i) => i.count === 0);
    const active = issues.find((i) => i.count === 1);
    expect(archived!.status).toBe("ARCHIVED");
    expect(active!.status).toBe("UNRESOLVED");
  });

  it("is idempotent (running twice doesn't double-delete)", async () => {
    const project = await createTestProject();
    await createExpiredIssueAndEvents(project.id, { expiredCount: 1, freshCount: 0 });

    const first = await pruneErrorEvents();
    expect(first.deletedEvents).toBe(1);

    const second = await pruneErrorEvents();
    expect(second.deletedEvents).toBe(0);
  });
});
