import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { db } from "@lightrace/shared/db";
import {
  createTestUser,
  createTestProject,
  createTestMembership,
  createTestApiKey,
  createCaller,
} from "../../__tests__/helpers";

describe("settings.createApiKey", () => {
  it("creates API key with correct prefixes and hash", async () => {
    const user = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project.id, role: "OWNER" });

    const caller = createCaller(user.id, user.email);
    const result = await caller.settings.createApiKey({ projectId: project.id });

    expect(result.publicKey).toMatch(/^pk-lt-/);
    expect(result.secretKey).toMatch(/^sk-lt-/);

    // Verify hash in DB matches
    const stored = await db.apiKey.findUnique({ where: { publicKey: result.publicKey } });
    const expectedHash = createHash("sha256").update(result.secretKey).digest("hex");
    expect(stored!.hashedSecretKey).toBe(expectedHash);
    expect(stored!.displaySecretKey).toBe(`sk-lt-...${result.secretKey.slice(-4)}`);
  });

  it("rejects non-admin caller", async () => {
    const user = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project.id, role: "MEMBER" });

    const caller = createCaller(user.id, user.email);
    await expect(caller.settings.createApiKey({ projectId: project.id })).rejects.toThrow(
      "Admin access required",
    );
  });
});

describe("settings.listApiKeys", () => {
  it("returns keys for the project only", async () => {
    const user = await createTestUser();
    const project1 = await createTestProject();
    const project2 = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project1.id });
    await createTestMembership({ userId: user.id, projectId: project2.id });
    await createTestApiKey({ projectId: project1.id });
    await createTestApiKey({ projectId: project1.id });
    await createTestApiKey({ projectId: project2.id });

    const caller = createCaller(user.id, user.email);
    const keys = await caller.settings.listApiKeys({ projectId: project1.id });
    expect(keys).toHaveLength(2);
    // Should not expose hashedSecretKey
    for (const key of keys) {
      expect(key).not.toHaveProperty("hashedSecretKey");
    }
  });
});

describe("settings.deleteApiKey", () => {
  it("deletes key belonging to project", async () => {
    const user = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project.id, role: "OWNER" });
    const { record } = await createTestApiKey({ projectId: project.id });

    const caller = createCaller(user.id, user.email);
    await caller.settings.deleteApiKey({ projectId: project.id, id: record.id });

    const found = await db.apiKey.findUnique({ where: { id: record.id } });
    expect(found).toBeNull();
  });
});
