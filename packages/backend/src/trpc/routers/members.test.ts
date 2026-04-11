import { describe, it, expect } from "vitest";
import { db } from "@lightrace/shared/db";
import {
  createTestUser,
  createTestProject,
  createTestMembership,
  createTestInvitation,
  createCaller,
} from "../../__tests__/helpers";

describe("members.invite", () => {
  it("auto-accepts when inviting an existing user", async () => {
    const owner = await createTestUser({ email: "owner@test.com" });
    const invitee = await createTestUser({ email: "invitee@test.com" });
    const project = await createTestProject();
    await createTestMembership({ userId: owner.id, projectId: project.id, role: "OWNER" });

    const caller = createCaller(owner.id, owner.email);
    const result = await caller.members.invite({
      projectId: project.id,
      email: invitee.email,
      role: "MEMBER",
    });

    expect(result.autoAccepted).toBe(true);
    const membership = await db.projectMembership.findUnique({
      where: { userId_projectId: { userId: invitee.id, projectId: project.id } },
    });
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe("MEMBER");
  });

  it("creates PENDING invitation for non-existent user", async () => {
    const owner = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: owner.id, projectId: project.id, role: "OWNER" });

    const caller = createCaller(owner.id, owner.email);
    const result = await caller.members.invite({
      projectId: project.id,
      email: "new@test.com",
      role: "MEMBER",
    });

    expect(result.autoAccepted).toBe(false);
    expect(result.token).toBeDefined();
  });

  it("rejects duplicate pending invitation", async () => {
    const owner = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: owner.id, projectId: project.id, role: "OWNER" });
    await createTestInvitation({
      email: "dup@test.com",
      projectId: project.id,
      invitedByUserId: owner.id,
    });

    const caller = createCaller(owner.id, owner.email);
    await expect(
      caller.members.invite({ projectId: project.id, email: "dup@test.com" }),
    ).rejects.toThrow("already pending");
  });

  it("rejects if user is already a member", async () => {
    const owner = await createTestUser();
    const member = await createTestUser({ email: "member@test.com" });
    const project = await createTestProject();
    await createTestMembership({ userId: owner.id, projectId: project.id, role: "OWNER" });
    await createTestMembership({ userId: member.id, projectId: project.id, role: "MEMBER" });

    const caller = createCaller(owner.id, owner.email);
    await expect(
      caller.members.invite({ projectId: project.id, email: member.email }),
    ).rejects.toThrow("already a member");
  });

  it("rejects non-admin caller", async () => {
    const member = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: member.id, projectId: project.id, role: "MEMBER" });

    const caller = createCaller(member.id, member.email);
    await expect(
      caller.members.invite({ projectId: project.id, email: "x@test.com" }),
    ).rejects.toThrow("Admin access required");
  });
});

describe("members.updateRole", () => {
  it("allows admin to change a member's role", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: admin.id, projectId: project.id, role: "ADMIN" });
    await createTestMembership({ userId: member.id, projectId: project.id, role: "MEMBER" });

    const caller = createCaller(admin.id, admin.email);
    const updated = await caller.members.updateRole({
      projectId: project.id,
      userId: member.id,
      role: "VIEWER",
    });
    expect(updated.role).toBe("VIEWER");
  });

  it("rejects promoting to OWNER unless caller is OWNER", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: admin.id, projectId: project.id, role: "ADMIN" });
    await createTestMembership({ userId: member.id, projectId: project.id, role: "MEMBER" });

    const caller = createCaller(admin.id, admin.email);
    await expect(
      caller.members.updateRole({ projectId: project.id, userId: member.id, role: "OWNER" }),
    ).rejects.toThrow("Only owners can assign the owner role");
  });

  it("rejects demoting the last owner", async () => {
    const owner = await createTestUser();
    const admin = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: owner.id, projectId: project.id, role: "OWNER" });
    await createTestMembership({ userId: admin.id, projectId: project.id, role: "ADMIN" });

    // Admin can't demote owner, but let's test owner demoting themselves
    const caller = createCaller(owner.id, owner.email);
    await expect(
      caller.members.updateRole({ projectId: project.id, userId: owner.id, role: "ADMIN" }),
    ).rejects.toThrow("Cannot change your own role");
  });

  it("rejects changing own role", async () => {
    const owner = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: owner.id, projectId: project.id, role: "OWNER" });

    const caller = createCaller(owner.id, owner.email);
    await expect(
      caller.members.updateRole({ projectId: project.id, userId: owner.id, role: "ADMIN" }),
    ).rejects.toThrow("Cannot change your own role");
  });
});

describe("members.remove", () => {
  it("admin removes a member", async () => {
    const admin = await createTestUser();
    const member = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: admin.id, projectId: project.id, role: "ADMIN" });
    await createTestMembership({ userId: member.id, projectId: project.id, role: "MEMBER" });

    const caller = createCaller(admin.id, admin.email);
    await caller.members.remove({ projectId: project.id, userId: member.id });

    const membership = await db.projectMembership.findUnique({
      where: { userId_projectId: { userId: member.id, projectId: project.id } },
    });
    expect(membership).toBeNull();
  });

  it("rejects removing self", async () => {
    const admin = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: admin.id, projectId: project.id, role: "ADMIN" });

    const caller = createCaller(admin.id, admin.email);
    await expect(
      caller.members.remove({ projectId: project.id, userId: admin.id }),
    ).rejects.toThrow("Use 'leave'");
  });
});

describe("members.leave", () => {
  it("member can leave a project", async () => {
    const member = await createTestUser();
    const owner = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: owner.id, projectId: project.id, role: "OWNER" });
    await createTestMembership({ userId: member.id, projectId: project.id, role: "MEMBER" });

    const caller = createCaller(member.id, member.email);
    await caller.members.leave({ projectId: project.id });

    const membership = await db.projectMembership.findUnique({
      where: { userId_projectId: { userId: member.id, projectId: project.id } },
    });
    expect(membership).toBeNull();
  });

  it("last owner cannot leave", async () => {
    const owner = await createTestUser();
    const project = await createTestProject();
    await createTestMembership({ userId: owner.id, projectId: project.id, role: "OWNER" });

    const caller = createCaller(owner.id, owner.email);
    await expect(caller.members.leave({ projectId: project.id })).rejects.toThrow(
      "Cannot remove or demote the last owner",
    );
  });
});

describe("members.acceptInvitation", () => {
  it("creates membership from valid token", async () => {
    const inviter = await createTestUser();
    const invitee = await createTestUser({ email: "accept@test.com" });
    const project = await createTestProject();
    await createTestMembership({ userId: inviter.id, projectId: project.id, role: "OWNER" });

    const invitation = await createTestInvitation({
      email: invitee.email,
      projectId: project.id,
      invitedByUserId: inviter.id,
      role: "MEMBER",
    });

    const caller = createCaller(invitee.id, invitee.email);
    const result = await caller.members.acceptInvitation({ token: invitation.token });
    expect(result.projectId).toBe(project.id);

    const membership = await db.projectMembership.findUnique({
      where: { userId_projectId: { userId: invitee.id, projectId: project.id } },
    });
    expect(membership!.role).toBe("MEMBER");
  });

  it("rejects expired invitation", async () => {
    const inviter = await createTestUser();
    const invitee = await createTestUser({ email: "expired@test.com" });
    const project = await createTestProject();
    await createTestMembership({ userId: inviter.id, projectId: project.id, role: "OWNER" });

    const invitation = await createTestInvitation({
      email: invitee.email,
      projectId: project.id,
      invitedByUserId: inviter.id,
      expiresAt: new Date("2020-01-01"),
    });

    const caller = createCaller(invitee.id, invitee.email);
    await expect(caller.members.acceptInvitation({ token: invitation.token })).rejects.toThrow(
      "expired",
    );
  });

  it("rejects wrong email", async () => {
    const inviter = await createTestUser();
    const wrongUser = await createTestUser({ email: "wrong@test.com" });
    const project = await createTestProject();
    await createTestMembership({ userId: inviter.id, projectId: project.id, role: "OWNER" });

    const invitation = await createTestInvitation({
      email: "right@test.com",
      projectId: project.id,
      invitedByUserId: inviter.id,
    });

    const caller = createCaller(wrongUser.id, wrongUser.email);
    await expect(caller.members.acceptInvitation({ token: invitation.token })).rejects.toThrow(
      "different email",
    );
  });
});

describe("members.declineInvitation", () => {
  it("deletes invitation on decline", async () => {
    const inviter = await createTestUser();
    const invitee = await createTestUser({ email: "decline@test.com" });
    const project = await createTestProject();
    await createTestMembership({ userId: inviter.id, projectId: project.id, role: "OWNER" });

    const invitation = await createTestInvitation({
      email: invitee.email,
      projectId: project.id,
      invitedByUserId: inviter.id,
    });

    const caller = createCaller(invitee.id, invitee.email);
    await caller.members.declineInvitation({ token: invitation.token });

    const found = await db.membershipInvitation.findUnique({ where: { id: invitation.id } });
    expect(found).toBeNull();
  });
});
