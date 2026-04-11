/**
 * Vitest global setup: creates a test database and runs Prisma migrations.
 *
 * Based on Prisma's official integration testing docs + Vitest community patterns:
 * - Uses pg driver to CREATE/DROP the test database
 * - Runs `prisma migrate deploy` via the binary in node_modules/.bin
 * - Uses child_process.spawn (not execSync) for Vitest module-runner compat
 */
import { resolve } from "path";
import { spawn } from "child_process";
import pg from "pg";

const TEST_DB = "lightrace_test";
const BASE_URL = "postgresql://lightrace:lightrace@localhost:5435/lightrace";
const TEST_URL = "postgresql://lightrace:lightrace@localhost:5435/lightrace_test";

function runCommand(
  bin: string,
  args: string[],
  env: Record<string, string | undefined>,
  cwd: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env, cwd, stdio: "pipe" });
    let stderr = "";
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (code ${code}): ${bin} ${args.join(" ")}\n${stderr}`));
    });
    child.on("error", reject);
  });
}

export async function setup() {
  // 1. Create test database
  const client = new pg.Client({ connectionString: BASE_URL });
  await client.connect();
  await client.query(`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = '${TEST_DB}' AND pid <> pg_backend_pid()
  `);
  await client.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await client.query(`CREATE DATABASE ${TEST_DB}`);
  await client.end();

  // 2. Run prisma migrate deploy using the binary from shared/node_modules
  //    process.cwd() is the backend package root when vitest runs
  const sharedDir = resolve(process.cwd(), "../shared");
  const prismaBin = resolve(sharedDir, "node_modules/.bin/prisma");

  await runCommand(
    prismaBin,
    ["migrate", "deploy"],
    {
      ...process.env,
      DATABASE_URL: TEST_URL,
    },
    sharedDir,
  );

  // 3. Set DATABASE_URL for the test suite
  process.env.DATABASE_URL = TEST_URL;
}

export async function teardown() {
  const client = new pg.Client({ connectionString: BASE_URL });
  await client.connect();
  await client.query(`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = '${TEST_DB}' AND pid <> pg_backend_pid()
  `);
  await client.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await client.end();
}
