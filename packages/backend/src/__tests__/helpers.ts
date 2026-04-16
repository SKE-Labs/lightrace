/**
 * Test factory helpers — create DB records with sensible defaults.
 */
import { createHash, randomBytes, randomUUID } from "crypto";
import { db } from "@lightrace/shared/db";
import { hashSync } from "bcryptjs";
import type { MemberRole, ObservationType, ObservationLevel } from "@prisma/client";
import { appRouter } from "../trpc/router";

// Pre-computed bcrypt hash for "password" — avoids ~100ms hashSync per createTestUser call
const DEFAULT_PASSWORD_HASH = hashSync("password", 10);

// ── Users ──────────────────────────────────────────────────────────────

export async function createTestUser(
  overrides: {
    email?: string;
    name?: string;
    password?: string;
  } = {},
) {
  return db.user.create({
    data: {
      email: overrides.email ?? `test-${randomUUID()}@test.com`,
      name: overrides.name ?? "Test User",
      password: overrides.password ? hashSync(overrides.password, 10) : DEFAULT_PASSWORD_HASH,
    },
  });
}

// ── tRPC Caller ────────────────────────────────────────────────────────

export function createCaller(userId: string, userEmail: string) {
  return appRouter.createCaller({ db, user: { id: userId, email: userEmail } });
}

// ── Projects ───────────────────────────────────────────────────────────

export async function createTestProject(
  overrides: {
    name?: string;
    description?: string;
  } = {},
) {
  return db.project.create({
    data: {
      name: overrides.name ?? `Test Project ${randomUUID().slice(0, 8)}`,
      description: overrides.description,
    },
  });
}

// ── Memberships ────────────────────────────────────────────────────────

export async function createTestMembership(opts: {
  userId: string;
  projectId: string;
  role?: MemberRole;
}) {
  return db.projectMembership.create({
    data: {
      userId: opts.userId,
      projectId: opts.projectId,
      role: opts.role ?? "OWNER",
    },
  });
}

// ── API Keys ───────────────────────────────────────────────────────────

export async function createTestApiKey(opts: { projectId: string; note?: string }) {
  const publicKey = `pk-lt-${randomBytes(16).toString("hex")}`;
  const secretKey = `sk-lt-${randomBytes(24).toString("hex")}`;
  const hashedSecretKey = createHash("sha256").update(secretKey).digest("hex");
  const displaySecretKey = `sk-lt-...${secretKey.slice(-4)}`;

  const record = await db.apiKey.create({
    data: {
      publicKey,
      hashedSecretKey,
      displaySecretKey,
      note: opts.note,
      projectId: opts.projectId,
    },
  });

  return { record, publicKey, secretKey };
}

// ── Traces ─────────────────────────────────────────────────────────────

export async function createTestTrace(opts: {
  id?: string;
  projectId: string;
  name?: string;
  timestamp?: Date;
  sessionId?: string;
  userId?: string;
  tags?: string[];
  input?: unknown;
  output?: unknown;
  metadata?: unknown;
  isFork?: boolean;
}) {
  return db.trace.create({
    data: {
      id: opts.id ?? randomUUID(),
      projectId: opts.projectId,
      name: opts.name ?? "test-trace",
      timestamp: opts.timestamp ?? new Date(),
      sessionId: opts.sessionId,
      userId: opts.userId,
      tags: opts.tags ?? [],
      input: opts.input as object | undefined,
      output: opts.output as object | undefined,
      metadata: opts.metadata as object | undefined,
      isFork: opts.isFork ?? false,
    },
  });
}

// ── Observations ───────────────────────────────────────────────────────

export async function createTestObservation(opts: {
  id?: string;
  traceId: string;
  projectId: string;
  type: ObservationType;
  name?: string;
  startTime?: Date;
  endTime?: Date;
  input?: unknown;
  output?: unknown;
  model?: string;
  level?: ObservationLevel;
  parentObservationId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  totalCost?: number;
  toolCallId?: string;
}) {
  return db.observation.create({
    data: {
      id: opts.id ?? randomUUID(),
      traceId: opts.traceId,
      projectId: opts.projectId,
      type: opts.type,
      name: opts.name ?? "test-obs",
      startTime: opts.startTime ?? new Date(),
      endTime: opts.endTime,
      input: opts.input as object | undefined,
      output: opts.output as object | undefined,
      model: opts.model,
      level: opts.level ?? "DEFAULT",
      parentObservationId: opts.parentObservationId,
      promptTokens: opts.promptTokens ?? 0,
      completionTokens: opts.completionTokens ?? 0,
      totalTokens: opts.totalTokens ?? 0,
      totalCost: opts.totalCost,
      toolCallId: opts.toolCallId,
    },
  });
}

// ── Tool Registrations ─────────────────────────────────────────────────

export async function createTestToolRegistration(opts: {
  projectId: string;
  toolName: string;
  callbackUrl?: string;
  description?: string;
  inputSchema?: unknown;
  capabilities?: unknown;
}) {
  return db.toolRegistration.create({
    data: {
      projectId: opts.projectId,
      toolName: opts.toolName,
      callbackUrl: opts.callbackUrl ?? "http://localhost:9999",
      description: opts.description,
      inputSchema: opts.inputSchema as object | undefined,
      capabilities: opts.capabilities as object | undefined,
    },
  });
}

// ── Invitations ────────────────────────────────────────────────────────

export async function createTestInvitation(opts: {
  email: string;
  projectId: string;
  invitedByUserId: string;
  role?: MemberRole;
  token?: string;
  expiresAt?: Date;
  status?: "PENDING" | "ACCEPTED" | "EXPIRED";
}) {
  const expiresAt = opts.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return db.membershipInvitation.create({
    data: {
      email: opts.email,
      projectId: opts.projectId,
      role: opts.role ?? "MEMBER",
      invitedByUserId: opts.invitedByUserId,
      token: opts.token ?? randomBytes(32).toString("hex"),
      expiresAt,
      status: opts.status ?? "PENDING",
    },
  });
}

// ── Auth helpers ────────────────────────────────────────────────────────

export function buildBasicAuthHeader(publicKey: string, secretKey: string): string {
  return `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`;
}
