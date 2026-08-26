import { describe, it, expect } from "vitest";
import { db } from "@lightrace/shared/db";
import {
  createTestUser,
  createTestProject,
  createTestMembership,
  createTestTrace,
  createCaller,
} from "../../__tests__/helpers";
import { processEventBatch } from "../../ingestion/processEventBatch";
import { randomUUID, randomBytes } from "crypto";

async function createErrorIssue(opts: {
  projectId: string;
  fingerprint?: string;
  type?: "TOOL" | "GENERATION" | "SPAN" | "CHAIN" | "EVENT";
  toolName?: string | null;
  title?: string;
  status?: "UNRESOLVED" | "RESOLVED" | "ARCHIVED" | "ESCALATING" | "REGRESSED" | "FOR_REVIEW";
  priority?: "HIGH" | "MEDIUM" | "LOW";
  count?: number;
  firstSeen?: Date;
  lastSeen?: Date;
}) {
  const now = new Date();
  return db.errorIssue.create({
    data: {
      id: randomBytes(12).toString("hex"),
      shortId: `ERR-${randomBytes(4).toString("hex").toUpperCase()}`,
      projectId: opts.projectId,
      fingerprint: opts.fingerprint ?? randomBytes(16).toString("hex"),
      type: opts.type ?? "TOOL",
      toolName: opts.toolName ?? (opts.type === "TOOL" ? "search" : null),
      title: opts.title ?? "test error",
      level: "ERROR",
      status: opts.status ?? "UNRESOLVED",
      priority: opts.priority ?? "MEDIUM",
      count: opts.count ?? 1,
      traceCount: opts.count ?? 1,
      userCount: 0,
      firstSeen: opts.firstSeen ?? now,
      lastSeen: opts.lastSeen ?? now,
      firstTraceId: randomUUID(),
      lastTraceId: randomUUID(),
    },
  });
}

async function createErrorEvent(opts: {
  issueId: string;
  projectId: string;
  traceId: string;
  observationId?: string;
  timestamp?: Date;
}) {
  const traceId = opts.traceId;
  const observationId = opts.observationId ?? randomUUID();
  // Need observation and trace to exist for FK
  // Create trace if not exists
  await db.trace.upsert({
    where: { id: traceId },
    create: { id: traceId, projectId: opts.projectId },
    update: {},
  });
  await db.observation.create({
    data: {
      id: observationId,
      traceId,
      projectId: opts.projectId,
      type: "TOOL",
      name: "test",
      level: "ERROR",
      statusMessage: "boom",
    },
  });
  const expiresAt = new Date(opts.timestamp ?? new Date());
  expiresAt.setDate(expiresAt.getDate() + 90);
  return db.errorEvent.create({
    data: {
      id: observationId,
      issueId: opts.issueId,
      projectId: opts.projectId,
      observationId,
      traceId,
      timestamp: opts.timestamp ?? new Date(),
      errorType: "ValueError",
      errorValue: "boom",
      expiresAt,
    },
  });
}

describe("errors router", () => {
  describe("list", () => {
    it("returns empty when no issues", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      const result = await caller.errors.list({ projectId: project.id });
      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it("lists issues with pagination and search", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      await createErrorIssue({
        projectId: project.id,
        title: "brave_search: timeout",
        toolName: "brave_search",
      });
      await createErrorIssue({
        projectId: project.id,
        title: "other_tool: boom",
        toolName: "other_tool",
      });
      await createErrorIssue({
        projectId: project.id,
        title: "generation: rate_limit",
        type: "GENERATION",
        toolName: null,
      });

      const all = await caller.errors.list({ projectId: project.id });
      expect(all.items).toHaveLength(3);

      const filtered = await caller.errors.list({
        projectId: project.id,
        toolName: "brave_search",
      });
      expect(filtered.items).toHaveLength(1);
      expect(filtered.items[0]!.toolName).toBe("brave_search");

      const typeFiltered = await caller.errors.list({ projectId: project.id, type: "GENERATION" });
      expect(typeFiltered.items).toHaveLength(1);
      expect(typeFiltered.items[0]!.type).toBe("GENERATION");

      const searchFiltered = await caller.errors.list({ projectId: project.id, search: "timeout" });
      expect(searchFiltered.items).toHaveLength(1);
      expect(searchFiltered.items[0]!.title).toContain("timeout");

      const paginated = await caller.errors.list({ projectId: project.id, limit: 2, page: 1 });
      expect(paginated.items).toHaveLength(2);
      expect(paginated.totalCount).toBe(3);
      expect(paginated.totalPages).toBe(2);
    });

    it("filters by status", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      await createErrorIssue({ projectId: project.id, status: "UNRESOLVED" });
      await createErrorIssue({ projectId: project.id, status: "RESOLVED" });
      await createErrorIssue({ projectId: project.id, status: "ARCHIVED" });

      const unresolved = await caller.errors.list({ projectId: project.id, status: "UNRESOLVED" });
      expect(unresolved.items).toHaveLength(1);
      expect(unresolved.items[0]!.status).toBe("UNRESOLVED");
    });

    it("sorts by count and lastSeen", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      const now = new Date();
      const earlier = new Date(now.getTime() - 100000);
      await createErrorIssue({ projectId: project.id, count: 5, lastSeen: earlier, title: "old" });
      await createErrorIssue({ projectId: project.id, count: 10, lastSeen: now, title: "new" });

      const byCount = await caller.errors.list({
        projectId: project.id,
        sortBy: "count",
        sortOrder: "desc",
      });
      expect(byCount.items[0]!.count).toBe(10);

      const byLastSeen = await caller.errors.list({
        projectId: project.id,
        sortBy: "lastSeen",
        sortOrder: "desc",
      });
      expect(byLastSeen.items[0]!.title).toBe("new");
    });

    it("forbids non-member", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      // no membership
      const caller = createCaller(user.id, user.email);
      await expect(caller.errors.list({ projectId: project.id })).rejects.toThrow(
        /FORBIDDEN|Not a member/,
      );
    });
  });

  describe("byId", () => {
    it("returns issue with recent events", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      const issue = await createErrorIssue({ projectId: project.id });
      const traceId = randomUUID();
      await createTestTrace({ id: traceId, projectId: project.id });
      await createErrorEvent({ issueId: issue.id, projectId: project.id, traceId });

      const result = await caller.errors.byId({ projectId: project.id, id: issue.id });
      expect(result).not.toBeNull();
      expect(result!.id).toBe(issue.id);
      expect(result!.recentEvents).toHaveLength(1);
    });

    it("returns null for wrong project", async () => {
      const user = await createTestUser();
      const project1 = await createTestProject();
      const project2 = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project1.id });
      await createTestMembership({ userId: user.id, projectId: project2.id });
      const caller = createCaller(user.id, user.email);

      const issue = await createErrorIssue({ projectId: project1.id });

      const result = await caller.errors.byId({ projectId: project2.id, id: issue.id });
      expect(result).toBeNull();
    });
  });

  describe("events", () => {
    it("paginates events for issue", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      const issue = await createErrorIssue({ projectId: project.id });
      for (let i = 0; i < 3; i++) {
        const traceId = randomUUID();
        await createTestTrace({ id: traceId, projectId: project.id });
        await createErrorEvent({
          issueId: issue.id,
          projectId: project.id,
          traceId,
          timestamp: new Date(Date.now() + i * 1000),
        });
      }

      const page1 = await caller.errors.events({
        projectId: project.id,
        issueId: issue.id,
        limit: 2,
        page: 1,
      });
      expect(page1.items).toHaveLength(2);
      expect(page1.totalCount).toBe(3);

      const page2 = await caller.errors.events({
        projectId: project.id,
        issueId: issue.id,
        limit: 2,
        page: 2,
      });
      expect(page2.items).toHaveLength(1);
    });
  });

  describe("update", () => {
    it("updates status and priority", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      const issue = await createErrorIssue({
        projectId: project.id,
        status: "UNRESOLVED",
        priority: "MEDIUM",
      });

      const updated = await caller.errors.update({
        projectId: project.id,
        id: issue.id,
        status: "RESOLVED",
        priority: "HIGH",
      });
      expect(updated.status).toBe("RESOLVED");
      expect(updated.priority).toBe("HIGH");

      const fetched = await db.errorIssue.findUnique({ where: { id: issue.id } });
      expect(fetched!.status).toBe("RESOLVED");
      expect(fetched!.priority).toBe("HIGH");
    });

    it("assigns user", async () => {
      const user = await createTestUser();
      const assignee = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      await createTestMembership({ userId: assignee.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      const issue = await createErrorIssue({ projectId: project.id });

      const updated = await caller.errors.update({
        projectId: project.id,
        id: issue.id,
        assigneeId: assignee.id,
      });
      expect(updated.assigneeId).toBe(assignee.id);
    });
  });

  describe("stats", () => {
    it("groups by type", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      await createErrorIssue({ projectId: project.id, type: "TOOL" });
      await createErrorIssue({ projectId: project.id, type: "TOOL" });
      await createErrorIssue({ projectId: project.id, type: "GENERATION" });

      const stats = await caller.errors.stats({ projectId: project.id, groupBy: "type" });
      expect(stats).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: "TOOL", count: 2 }),
          expect.objectContaining({ key: "GENERATION", count: 1 }),
        ]),
      );
    });

    it("groups by toolName", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      await createErrorIssue({ projectId: project.id, toolName: "search", type: "TOOL" });
      await createErrorIssue({ projectId: project.id, toolName: "search", type: "TOOL" });
      await createErrorIssue({ projectId: project.id, toolName: "other", type: "TOOL" });

      const stats = await caller.errors.stats({ projectId: project.id, groupBy: "toolName" });
      const searchStat = stats.find((s) => s.key === "search");
      expect(searchStat!.count).toBe(2);
    });

    it("sums counts correctly for stats (business logic: total events, not issue count)", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      // Create issues with different counts to verify sum vs count logic
      await createErrorIssue({ projectId: project.id, type: "TOOL", count: 5 });
      await createErrorIssue({ projectId: project.id, type: "TOOL", count: 10 });
      await createErrorIssue({ projectId: project.id, type: "SPAN", count: 3 });

      const stats = await caller.errors.stats({ projectId: project.id, groupBy: "type" });
      const toolStat = stats.find((s) => s.key === "TOOL");
      const spanStat = stats.find((s) => s.key === "SPAN");
      // Should sum counts (5+10=15) not just count issues (2)
      expect(toolStat!.count).toBe(15);
      expect(spanStat!.count).toBe(3);
    });

    it("groups unknown toolName correctly", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      await createErrorIssue({ projectId: project.id, type: "GENERATION", toolName: null });
      await createErrorIssue({ projectId: project.id, type: "SPAN", toolName: null });

      const stats = await caller.errors.stats({ projectId: project.id, groupBy: "toolName" });
      const unknownStat = stats.find((s) => s.key === "unknown");
      expect(unknownStat).toBeDefined();
      expect(unknownStat!.count).toBe(2);
    });
  });

  describe("business logic integration", () => {
    it("list reflects ingested errors via service layer (end-to-end fingerprint grouping)", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      const traceId1 = randomUUID();
      const traceId2 = randomUUID();
      await createTestTrace({ id: traceId1, projectId: project.id });
      await createTestTrace({ id: traceId2, projectId: project.id });

      // Ingest two tool errors that should group (same tool, same bucket)
      await processEventBatch(
        [
          {
            id: "evt-int-1",
            type: "tool-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: {
              id: "obs-int-1",
              traceId: traceId1,
              name: "search",
              level: "ERROR",
              statusMessage: "Timeout after 5000ms",
            },
          },
        ],
        project.id,
      );
      await processEventBatch(
        [
          {
            id: "evt-int-2",
            type: "tool-create",
            timestamp: "2026-01-01T01:00:00Z",
            body: {
              id: "obs-int-2",
              traceId: traceId2,
              name: "search",
              level: "ERROR",
              statusMessage: "Timeout after 9999ms",
            },
          },
        ],
        project.id,
      );

      const list = await caller.errors.list({ projectId: project.id });
      expect(list.items).toHaveLength(1);
      expect(list.items[0]!.count).toBe(2);
      expect(list.items[0]!.title).toContain("search");
      // Verify service correctly buckets timeout (business logic)
      const byTool = await caller.errors.list({ projectId: project.id, toolName: "search" });
      expect(byTool.items).toHaveLength(1);
    });

    it("byId returns recentEvents with enriched error data and trace linkage", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      const traceId = randomUUID();
      await createTestTrace({ id: traceId, projectId: project.id });
      await processEventBatch(
        [
          {
            id: "evt-enrich-1",
            type: "tool-create",
            timestamp: "2026-01-01T00:00:00Z",
            body: {
              id: "obs-enrich-1",
              traceId,
              name: "search",
              level: "ERROR",
              statusMessage: "ValueError: boom",
              errorType: "ValueError",
              errorStacktrace: "stack line",
              errorHandled: false,
            },
          },
        ],
        project.id,
      );

      const list = await caller.errors.list({ projectId: project.id });
      const issueId = list.items[0]!.id;

      const detail = await caller.errors.byId({ projectId: project.id, id: issueId });
      expect(detail).not.toBeNull();
      expect(detail!.recentEvents).toHaveLength(1);
      expect(detail!.recentEvents[0]!.errorType).toBe("ValueError");
      expect(detail!.recentEvents[0]!.observation.statusMessage).toBe("ValueError: boom");
      expect(detail!.recentEvents[0]!.trace.id).toBe(traceId);
    });

    it("update validates assignee is project member (business rule)", async () => {
      const user = await createTestUser();
      const outsider = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      // outsider not added to project
      const caller = createCaller(user.id, user.email);
      const issue = await createErrorIssue({ projectId: project.id });

      await expect(
        caller.errors.update({ projectId: project.id, id: issue.id, assigneeId: outsider.id }),
      ).rejects.toThrow(/not a member/i);
      await expect(
        caller.errors.update({
          projectId: project.id,
          id: issue.id,
          assigneeId: "non-existent-id",
        }),
      ).rejects.toThrow(/not found/i);

      // Valid assignee should succeed
      const member = await createTestUser();
      await createTestMembership({ userId: member.id, projectId: project.id });
      const updated = await caller.errors.update({
        projectId: project.id,
        id: issue.id,
        assigneeId: member.id,
      });
      expect(updated.assigneeId).toBe(member.id);

      // Unassign should succeed
      const unassigned = await caller.errors.update({
        projectId: project.id,
        id: issue.id,
        assigneeId: null,
      });
      expect(unassigned.assigneeId).toBeNull();
    });

    it("events pagination respects business ordering (newest first) and includes trace linkage", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      const issue = await createErrorIssue({ projectId: project.id });
      const timestamps = [
        new Date("2026-01-01T00:00:00Z"),
        new Date("2026-01-02T00:00:00Z"),
        new Date("2026-01-03T00:00:00Z"),
      ];
      for (let i = 0; i < 3; i++) {
        const traceId = randomUUID();
        await createTestTrace({ id: traceId, projectId: project.id });
        await createErrorEvent({
          issueId: issue.id,
          projectId: project.id,
          traceId,
          timestamp: timestamps[i],
        });
      }

      const page = await caller.errors.events({
        projectId: project.id,
        issueId: issue.id,
        limit: 10,
        page: 1,
      });
      expect(page.items[0]!.timestamp.toISOString()).toBe(timestamps[2]!.toISOString()); // newest first
      expect(page.items[2]!.timestamp.toISOString()).toBe(timestamps[0]!.toISOString());
      expect(page.items[0]!.trace).toBeDefined();
      expect(page.items[0]!.observation).toBeDefined();
    });

    it("list search filters by business-relevant title (case-insensitive)", async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      await createTestMembership({ userId: user.id, projectId: project.id });
      const caller = createCaller(user.id, user.email);

      await createErrorIssue({ projectId: project.id, title: "brave_search: Timeout" });
      await createErrorIssue({ projectId: project.id, title: "openai: Rate Limit" });

      const search = await caller.errors.list({ projectId: project.id, search: "BRAVE" });
      expect(search.items).toHaveLength(1);
      expect(search.items[0]!.title).toContain("brave_search");
    });
  });
});
