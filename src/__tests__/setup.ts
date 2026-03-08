import { beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const testDb = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
});

beforeAll(async () => {
  // Ensure database is reachable
  await testDb.$connect();
});

afterAll(async () => {
  await testDb.$disconnect();
});

export { testDb };
