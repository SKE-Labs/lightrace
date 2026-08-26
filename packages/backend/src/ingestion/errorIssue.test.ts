import { describe, it, expect } from "vitest";
import { db } from "@lightrace/shared/db";
import { processEventBatch } from "./processEventBatch";
import { processOtelResourceSpans } from "./otel/processOtelSpans";
import { createTestProject, createTestTrace } from "../__tests__/helpers";

describe("error ingestion - processEventBatch", () => {
  it("creates ErrorIssue and ErrorEvent for TOOL ERROR observation", async () => {
    const project = await createTestProject();
    const traceId = "trace-err-1";
    await createTestTrace({ id: traceId, projectId: project.id });

    await processEventBatch(
      [
        {
          id: "evt-1",
          type: "tool-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-tool-err-1",
            traceId,
            name: "brave_search",
            level: "ERROR",
            statusMessage: "Timeout after 1000ms",
          },
        },
      ],
      project.id,
    );

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.toolName).toBe("brave_search");
    expect(issues[0]!.type).toBe("TOOL");
    expect(issues[0]!.count).toBe(1);
    expect(issues[0]!.title).toContain("brave_search");
    expect(issues[0]!.status).toBe("UNRESOLVED");
    expect(issues[0]!.priority).toBe("MEDIUM");

    const events = await db.errorEvent.findMany({ where: { projectId: project.id } });
    expect(events).toHaveLength(1);
    expect(events[0]!.observationId).toBe("obs-tool-err-1");
    expect(events[0]!.issueId).toBe(issues[0]!.id);
    expect(events[0]!.traceId).toBe(traceId);
    // expiresAt = timestamp + 90 days
    const expectedExpires = new Date("2026-01-01T00:00:00Z");
    expectedExpires.setDate(expectedExpires.getDate() + 90);
    expect(events[0]!.expiresAt.toISOString().slice(0, 10)).toBe(
      expectedExpires.toISOString().slice(0, 10),
    );
  });

  it("groups same TOOL error with normalized message into same issue (count increment)", async () => {
    const project = await createTestProject();
    const traceId1 = "trace-err-2a";
    const traceId2 = "trace-err-2b";
    await createTestTrace({ id: traceId1, projectId: project.id });
    await createTestTrace({ id: traceId2, projectId: project.id });

    const msg1 = "Timeout after 10000ms id 550e8400-e29b-41d4-a716-446655440000";
    const msg2 = "Timeout after 20000ms id 123e4567-e89b-12d3-a456-426614174000";

    // Both should normalize to same fingerprint and group
    await processEventBatch(
      [
        {
          id: "evt-2a",
          type: "tool-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-tool-2a",
            traceId: traceId1,
            name: "search",
            level: "ERROR",
            statusMessage: msg1,
          },
        },
      ],
      project.id,
    );
    await processEventBatch(
      [
        {
          id: "evt-2b",
          type: "tool-create",
          timestamp: "2026-01-01T01:00:00Z",
          body: {
            id: "obs-tool-2b",
            traceId: traceId2,
            name: "search",
            level: "ERROR",
            statusMessage: msg2,
          },
        },
      ],
      project.id,
    );

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.count).toBe(2);
    expect(issues[0]!.lastSeen.toISOString()).toBe(new Date("2026-01-01T01:00:00Z").toISOString());
    expect(issues[0]!.traceCount).toBe(2);

    const events = await db.errorEvent.findMany({ where: { issueId: issues[0]!.id } });
    expect(events).toHaveLength(2);
  });

  it("creates separate issues for different toolName", async () => {
    const project = await createTestProject();
    const traceId = "trace-err-3";
    await createTestTrace({ id: traceId, projectId: project.id });

    await processEventBatch(
      [
        {
          id: "evt-3a",
          type: "tool-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: { id: "obs-3a", traceId, name: "search", level: "ERROR", statusMessage: "boom" },
        },
        {
          id: "evt-3b",
          type: "tool-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: { id: "obs-3b", traceId, name: "other", level: "ERROR", statusMessage: "boom" },
        },
      ],
      project.id,
    );

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(2);
    const toolNames = issues.map((i) => i.toolName).sort();
    expect(toolNames).toEqual(["other", "search"]);
  });

  it("groups GENERATION errors by model and bucket (rate_limit)", async () => {
    const project = await createTestProject();
    const traceId1 = "trace-gen-1";
    const traceId2 = "trace-gen-2";
    await createTestTrace({ id: traceId1, projectId: project.id });
    await createTestTrace({ id: traceId2, projectId: project.id });

    await processEventBatch(
      [
        {
          id: "evt-gen-1",
          type: "generation-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-gen-1",
            traceId: traceId1,
            name: "llm-call",
            model: "gpt-4o",
            level: "ERROR",
            statusMessage: "429 rate limited exceeded",
          },
        },
      ],
      project.id,
    );
    await processEventBatch(
      [
        {
          id: "evt-gen-2",
          type: "generation-create",
          timestamp: "2026-01-01T01:00:00Z",
          body: {
            id: "obs-gen-2",
            traceId: traceId2,
            name: "llm-call",
            model: "gpt-4o",
            level: "ERROR",
            statusMessage: "rate limited 429 quota",
          },
        },
      ],
      project.id,
    );

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe("GENERATION");
    expect(issues[0]!.count).toBe(2);
  });

  it("creates separate GENERATION issues for different model", async () => {
    const project = await createTestProject();
    const traceId = "trace-gen-3";
    await createTestTrace({ id: traceId, projectId: project.id });

    await processEventBatch(
      [
        {
          id: "evt-gen-3a",
          type: "generation-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-gen-3a",
            traceId,
            model: "gpt-4o",
            level: "ERROR",
            statusMessage: "rate limited",
          },
        },
        {
          id: "evt-gen-3b",
          type: "generation-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-gen-3b",
            traceId,
            model: "claude-3-opus",
            level: "ERROR",
            statusMessage: "rate limited",
          },
        },
      ],
      project.id,
    );

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(2);
  });

  it("handles SPAN errors grouped by name and errorType", async () => {
    const project = await createTestProject();
    const traceId = "trace-span-1";
    await createTestTrace({ id: traceId, projectId: project.id });

    await processEventBatch(
      [
        {
          id: "evt-span-1",
          type: "span-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-span-1",
            traceId,
            name: "my_func",
            level: "ERROR",
            statusMessage: "ValueError: boom",
          },
        },
      ],
      project.id,
    );

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe("SPAN");
    expect(issues[0]!.title).toContain("my_func");
  });

  it("does not create ErrorIssue for non-ERROR level", async () => {
    const project = await createTestProject();
    const traceId = "trace-no-err";
    await createTestTrace({ id: traceId, projectId: project.id });

    await processEventBatch(
      [
        {
          id: "evt-no-err",
          type: "tool-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-no-err",
            traceId,
            name: "search",
            level: "DEFAULT",
            statusMessage: "ok",
          },
        },
      ],
      project.id,
    );

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(0);
    const events = await db.errorEvent.findMany({ where: { projectId: project.id } });
    expect(events).toHaveLength(0);
  });

  it("sets priority HIGH when count exceeds 100", async () => {
    const project = await createTestProject();
    // Create 101 errors with same fingerprint (bypassing processEventBatch for speed, directly via DB logic would be slower)
    // We'll simulate by calling processEventBatch 101 times with same tool error
    for (let i = 0; i < 101; i++) {
      const traceId = `trace-prio-${i}`;
      await createTestTrace({ id: traceId, projectId: project.id });
      await processEventBatch(
        [
          {
            id: `evt-prio-${i}`,
            type: "tool-create",
            timestamp: new Date(Date.now() + i * 1000).toISOString(),
            body: {
              id: `obs-prio-${i}`,
              traceId,
              name: "search",
              level: "ERROR",
              statusMessage: "boom",
            },
          },
        ],
        project.id,
      );
    }
    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.count).toBe(101);
    expect(issues[0]!.priority).toBe("HIGH");
  });

  it("isolates issues per project (same fingerprint different project)", async () => {
    const project1 = await createTestProject();
    const project2 = await createTestProject();
    const traceId1 = "trace-iso-1";
    const traceId2 = "trace-iso-2";
    await createTestTrace({ id: traceId1, projectId: project1.id });
    await createTestTrace({ id: traceId2, projectId: project2.id });

    await processEventBatch(
      [
        {
          id: "evt-iso-1",
          type: "tool-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-iso-1",
            traceId: traceId1,
            name: "search",
            level: "ERROR",
            statusMessage: "boom",
          },
        },
      ],
      project1.id,
    );
    await processEventBatch(
      [
        {
          id: "evt-iso-2",
          type: "tool-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-iso-2",
            traceId: traceId2,
            name: "search",
            level: "ERROR",
            statusMessage: "boom",
          },
        },
      ],
      project2.id,
    );

    const issues1 = await db.errorIssue.findMany({ where: { projectId: project1.id } });
    const issues2 = await db.errorIssue.findMany({ where: { projectId: project2.id } });
    expect(issues1).toHaveLength(1);
    expect(issues2).toHaveLength(1);
    expect(issues1[0]!.id).not.toBe(issues2[0]!.id);
  });

  it("stores explicit errorType/errorStacktrace/handled from SDK and uses them for grouping", async () => {
    const project = await createTestProject();
    const traceId = "trace-sdk-1";
    await createTestTrace({ id: traceId, projectId: project.id });

    await processEventBatch(
      [
        {
          id: "evt-sdk-1",
          type: "tool-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-sdk-1",
            traceId,
            name: "search",
            level: "ERROR",
            statusMessage: "boom",
            errorType: "ValueError",
            errorStacktrace: "Traceback line 1\nline 2",
            errorHandled: false,
          },
        },
      ],
      project.id,
    );

    const obs = await db.observation.findUnique({ where: { id: "obs-sdk-1" } });
    expect(obs!.errorType).toBe("ValueError");
    expect(obs!.errorStacktrace).toContain("line 1");
    expect(obs!.errorHandled).toBe(false);

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    // Title should contain the error value, and the issue should store the type separately (business logic: type is stored, title is user-facing)
    expect(issues[0]!.title).toContain("boom");
    const events = await db.errorEvent.findMany({ where: { projectId: project.id } });
    expect(events[0]!.errorType).toBe("ValueError");
    expect(events[0]!.stacktrace).toContain("line 1");
    expect(events[0]!.handled).toBe(false);
  });

  it("separates same message with different errorType into different issues (TOOL)", async () => {
    const project = await createTestProject();
    const traceId = "trace-type-1";
    await createTestTrace({ id: traceId, projectId: project.id });

    await processEventBatch(
      [
        {
          id: "evt-type-1",
          type: "tool-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-type-1",
            traceId,
            name: "search",
            level: "ERROR",
            statusMessage: "boom",
            errorType: "ValueError",
          },
        },
        {
          id: "evt-type-2",
          type: "tool-create",
          timestamp: "2026-01-01T00:01:00Z",
          body: {
            id: "obs-type-2",
            traceId,
            name: "search",
            level: "ERROR",
            statusMessage: "boom",
            errorType: "TypeError",
          },
        },
      ],
      project.id,
    );

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(2);
    const types = await db.errorEvent.findMany({
      where: { projectId: project.id },
      select: { errorType: true },
    });
    expect(types.map((t) => t.errorType).sort()).toEqual(["TypeError", "ValueError"]);
  });

  it("groups timeout bucket across different numeric values via OTel and event batch", async () => {
    const project = await createTestProject();
    const traceId1 = "trace-bucket-1";
    const traceId2 = "trace-bucket-2";
    await createTestTrace({ id: traceId1, projectId: project.id });
    await createTestTrace({ id: traceId2, projectId: project.id });

    await processEventBatch(
      [
        {
          id: "evt-bucket-1",
          type: "tool-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-bucket-1",
            traceId: traceId1,
            name: "search",
            level: "ERROR",
            statusMessage: "Timeout after 5000ms",
          },
        },
      ],
      project.id,
    );

    // OTel path: simulate SDK sending via OTel span
    await processOtelResourceSpans(
      [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: traceId2,
                  spanId: "obs-bucket-2-otel",
                  name: "search",
                  startTimeUnixNano: "1700000000000000000",
                  endTimeUnixNano: "1700000001000000000",
                  attributes: [
                    { key: "lightrace.observation.type", value: { stringValue: "TOOL" } },
                    { key: "lightrace.observation.level", value: { stringValue: "ERROR" } },
                    {
                      key: "lightrace.observation.status_message",
                      value: { stringValue: "Timeout after 9999ms" },
                    },
                  ],
                  status: { code: 2, message: "Timeout after 9999ms" },
                },
              ],
            },
          ],
        },
      ],
      project.id,
    );

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    // Both timeouts should bucket to same issue
    expect(issues).toHaveLength(1);
    expect(issues[0]!.count).toBe(2);
  });

  it("traceCount counts distinct traces, not total events", async () => {
    const project = await createTestProject();
    const traceId = "trace-distinct-1";
    await createTestTrace({ id: traceId, projectId: project.id });

    // Two errors on same trace with same fingerprint should not double-count traceCount
    await processEventBatch(
      [
        {
          id: "evt-distinct-1",
          type: "tool-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-distinct-1",
            traceId,
            name: "search",
            level: "ERROR",
            statusMessage: "boom",
          },
        },
        {
          id: "evt-distinct-2",
          type: "tool-create",
          timestamp: "2026-01-01T00:01:00Z",
          body: {
            id: "obs-distinct-2",
            traceId,
            name: "search",
            level: "ERROR",
            statusMessage: "boom",
          },
        },
      ],
      project.id,
    );

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.count).toBe(2);
    // After fix, traceCount should be 1 (same trace), not 2. Before fix it was 2.
    expect(issues[0]!.traceCount).toBe(1);
  });

  it("handled errors get LOW priority even with high count otherwise", async () => {
    const project = await createTestProject();
    const traceId = "trace-handled-init";
    await createTestTrace({ id: traceId, projectId: project.id });

    await processEventBatch(
      [
        {
          id: "evt-handled-init",
          type: "tool-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-handled-init",
            traceId,
            name: "search",
            level: "ERROR",
            statusMessage: "boom",
            errorHandled: true,
          },
        },
      ],
      project.id,
    );

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues[0]!.priority).toBe("LOW");
    // Create 100 more handled errors - should stay LOW, not HIGH (priority is business logic: handled errors are never HIGH)
    for (let i = 0; i < 100; i++) {
      const tid = `trace-handled-loop-${i}`;
      await createTestTrace({ id: tid, projectId: project.id });
      await processEventBatch(
        [
          {
            id: `evt-handled-loop-${i}`,
            type: "tool-create",
            timestamp: new Date(Date.now() + i * 1000 + 10000).toISOString(),
            body: {
              id: `obs-handled-loop-${i}`,
              traceId: tid,
              name: "search",
              level: "ERROR",
              statusMessage: "boom",
              errorHandled: true,
            },
          },
        ],
        project.id,
      );
    }
    const updated = await db.errorIssue.findFirst({ where: { projectId: project.id } });
    expect(updated!.priority).toBe("LOW");
    expect(updated!.count).toBe(101);
  });

  it("span-update that transitions to ERROR creates issue, while DEFAULT update does not", async () => {
    const project = await createTestProject();
    const traceId = "trace-update-1";
    await createTestTrace({ id: traceId, projectId: project.id });

    await processEventBatch(
      [
        {
          id: "evt-up-1",
          type: "span-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: { id: "obs-up-1", traceId, name: "my_func", level: "DEFAULT" },
        },
      ],
      project.id,
    );
    let issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(0);

    await processEventBatch(
      [
        {
          id: "evt-up-2",
          type: "span-update",
          timestamp: "2026-01-01T00:01:00Z",
          body: { id: "obs-up-1", level: "ERROR", statusMessage: "ValueError: boom" },
        },
      ],
      project.id,
    );
    issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe("SPAN");
  });

  it("re-ingesting same observationId is idempotent and does not double-count", async () => {
    const project = await createTestProject();
    const traceId = "trace-idem-1";
    await createTestTrace({ id: traceId, projectId: project.id });

    const payload = [
      {
        id: "evt-idem-1",
        type: "tool-create" as const,
        timestamp: "2026-01-01T00:00:00Z",
        body: {
          id: "obs-idem-1",
          traceId,
          name: "search",
          level: "ERROR" as const,
          statusMessage: "boom",
        },
      },
    ];
    await processEventBatch(payload, project.id);
    await processEventBatch(payload, project.id); // same observationId again

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.count).toBe(1); // not 2
    const events = await db.errorEvent.findMany({ where: { projectId: project.id } });
    expect(events).toHaveLength(1);
  });

  it("OTel span with explicit error_type and stacktrace creates enriched issue", async () => {
    const project = await createTestProject();
    const traceId = "trace-otel-enriched";
    // No need to create trace beforehand - OTel will create it
    await processOtelResourceSpans(
      [
        {
          resource: { attributes: [] },
          scopeSpans: [
            {
              spans: [
                {
                  traceId,
                  spanId: "otel-obs-1",
                  name: "brave_search",
                  startTimeUnixNano: "1700000000000000000",
                  endTimeUnixNano: "1700000001000000000",
                  attributes: [
                    { key: "lightrace.observation.type", value: { stringValue: "TOOL" } },
                    { key: "lightrace.observation.level", value: { stringValue: "ERROR" } },
                    { key: "lightrace.observation.status_message", value: { stringValue: "boom" } },
                    {
                      key: "lightrace.observation.error_type",
                      value: { stringValue: "ValueError" },
                    },
                    {
                      key: "lightrace.observation.error_stacktrace",
                      value: { stringValue: "Traceback: file.py line 10" },
                    },
                    { key: "lightrace.observation.error_handled", value: { stringValue: "false" } },
                  ],
                  status: { code: 2 },
                },
              ],
            },
          ],
        },
      ],
      project.id,
    );

    const obs = await db.observation.findUnique({ where: { id: "otel-obs-1" } });
    expect(obs!.errorType).toBe("ValueError");
    expect(obs!.errorStacktrace).toContain("file.py");
    expect(obs!.errorHandled).toBe(false);

    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.toolName).toBe("brave_search");
    const events = await db.errorEvent.findMany({ where: { projectId: project.id } });
    expect(events[0]!.errorType).toBe("ValueError");
    expect(events[0]!.stacktrace).toContain("file.py");
    expect(events[0]!.handled).toBe(false);
  });

  it("does not create issue for WARNING level (only ERROR)", async () => {
    const project = await createTestProject();
    const traceId = "trace-warn-1";
    await createTestTrace({ id: traceId, projectId: project.id });
    await processEventBatch(
      [
        {
          id: "evt-warn-1",
          type: "tool-create",
          timestamp: "2026-01-01T00:00:00Z",
          body: {
            id: "obs-warn-1",
            traceId,
            name: "search",
            level: "WARNING",
            statusMessage: "warn",
          },
        },
      ],
      project.id,
    );
    const issues = await db.errorIssue.findMany({ where: { projectId: project.id } });
    expect(issues).toHaveLength(0);
  });
});
