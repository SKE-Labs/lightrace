import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { createHash } from "crypto";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const SEED_EMAIL = process.env.SEED_USER_EMAIL || "demo@lightrace.dev";
const SEED_PASSWORD_HASH = process.env.SEED_USER_PASSWORD_HASH;
const SEED_NAME = process.env.SEED_USER_NAME || "Demo User";
const SEED_PROJECT_NAME = process.env.SEED_PROJECT_NAME || "Demo Project";
const SEED_PUBLIC_KEY = process.env.SEED_PUBLIC_KEY || "pk-lt-demo";
const SEED_SECRET_KEY = process.env.SEED_SECRET_KEY || "sk-lt-demo";

async function main() {
  // Create user — use pre-hashed password from CLI, or hash default
  const hashedPassword = SEED_PASSWORD_HASH || (await hash("password", 12));
  const user = await db.user.upsert({
    where: { email: SEED_EMAIL },
    update: {},
    create: {
      email: SEED_EMAIL,
      password: hashedPassword,
      name: SEED_NAME,
    },
  });
  console.log(`User: ${user.email}`);

  // Create project
  const project = await db.project.upsert({
    where: { id: "demo-project" },
    update: { name: SEED_PROJECT_NAME },
    create: {
      id: "demo-project",
      name: SEED_PROJECT_NAME,
    },
  });
  console.log(`Project: ${project.name} (${project.id})`);

  // Create API keys
  const publicKey = SEED_PUBLIC_KEY;
  const secretKey = SEED_SECRET_KEY;
  const hashedSecretKey = createHash("sha256").update(secretKey).digest("hex");

  await db.apiKey.upsert({
    where: { publicKey },
    update: {},
    create: {
      publicKey,
      hashedSecretKey,
      displaySecretKey: "sk-lt-...demo",
      note: "Demo API Key",
      projectId: project.id,
    },
  });
  console.log(`API Key: ${publicKey} / ${secretKey}`);

  // Create project membership (OWNER)
  await db.projectMembership.upsert({
    where: {
      userId_projectId: { userId: user.id, projectId: project.id },
    },
    update: {},
    create: {
      userId: user.id,
      projectId: project.id,
      role: "OWNER",
    },
  });
  console.log(`Membership: ${user.email} → ${project.name} (OWNER)`);

  console.log("\n--- LightRace seeded ---");
  console.log(`Login: ${SEED_EMAIL}`);
  console.log(`SDK:   public_key=${publicKey}  secret_key=${secretKey}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
