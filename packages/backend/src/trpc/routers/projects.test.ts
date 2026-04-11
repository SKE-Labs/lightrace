import { describe, it, expect } from "vitest";
import { db } from "@lightrace/shared/db";
import {
  createTestUser,
  createTestProject,
  createTestMembership,
  createCaller,
} from "../../__tests__/helpers";

describe("projects.create", () => {
  it("creates project with creator as OWNER", async () => {
    const user = await createTestUser();
    const caller = createCaller(user.id, user.email);

    const project = await caller.projects.create({ name: "New Project" });
    expect(project.name).toBe("New Project");

    const membership = await db.projectMembership.findUnique({
      where: { userId_projectId: { userId: user.id, projectId: project.id } },
    });
    expect(membership!.role).toBe("OWNER");
  });
});

describe("projects.list", () => {
  it("returns only user's projects with counts", async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    const project1 = await createTestProject({ name: "Mine" });
    const project2 = await createTestProject({ name: "Other" });
    await createTestMembership({ userId: user.id, projectId: project1.id });
    await createTestMembership({ userId: other.id, projectId: project2.id });

    const caller = createCaller(user.id, user.email);
    const projects = await caller.projects.list();

    expect(projects).toHaveLength(1);
    expect(projects[0]!.name).toBe("Mine");
    expect(projects[0]!.memberCount).toBe(1);
  });
});

describe("projects.update", () => {
  it("admin can update name and description", async () => {
    const user = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project.id, role: "ADMIN" });

    const caller = createCaller(user.id, user.email);
    const updated = await caller.projects.update({
      projectId: project.id,
      name: "Updated",
      description: "New desc",
    });
    expect(updated.name).toBe("Updated");
    expect(updated.description).toBe("New desc");
  });

  it("rejects non-admin", async () => {
    const user = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project.id, role: "MEMBER" });

    const caller = createCaller(user.id, user.email);
    await expect(caller.projects.update({ projectId: project.id, name: "No" })).rejects.toThrow(
      "Admin access required",
    );
  });
});

describe("projects.delete", () => {
  it("owner can delete project", async () => {
    const user = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project.id, role: "OWNER" });

    const caller = createCaller(user.id, user.email);
    await caller.projects.delete({ projectId: project.id });

    const found = await db.project.findUnique({ where: { id: project.id } });
    expect(found).toBeNull();
  });

  it("non-owner cannot delete project", async () => {
    const user = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: user.id, projectId: project.id, role: "ADMIN" });

    const caller = createCaller(user.id, user.email);
    await expect(caller.projects.delete({ projectId: project.id })).rejects.toThrow(
      "Owner access required",
    );
  });
});
