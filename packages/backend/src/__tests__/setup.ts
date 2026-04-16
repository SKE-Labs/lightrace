/**
 * Per-file setup: runs before each test file.
 * - Ensures DATABASE_URL points to the test DB
 * - Mocks Redis to avoid connection attempts
 * - Truncates all tables after each test
 */
import { vi, afterEach } from "vitest";

// Mock Redis before any module imports it
vi.mock("@lightrace/shared/redis", () => ({
  redis: {
    publish: vi.fn().mockResolvedValue(0),
    subscribe: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue(undefined),
  },
  createRedisClient: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    psubscribe: vi.fn().mockResolvedValue(undefined),
    punsubscribe: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock publishTraceUpdate to a no-op
// vi.mock path is resolved by Vitest from the importing module, not this setup file
vi.mock("../../realtime/pubsub", async (importOriginal) => {
  const original = await importOriginal<typeof import("../realtime/pubsub")>();
  return {
    ...original,
    publishTraceUpdate: vi.fn(),
    realtimeEmitter: {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
  };
});

// Lazy-import db so the mock is in place first
const { db } = await import("@lightrace/shared/db");

// Truncate all tables in FK-safe order after each test
afterEach(async () => {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      trace_forks,
      observations,
      traces,
      tool_registrations,
      conversation_messages,
      membership_invitations,
      project_memberships,
      api_keys,
      projects,
      users
    CASCADE
  `);
});
