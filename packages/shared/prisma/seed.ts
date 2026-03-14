import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { createHash, randomBytes } from "crypto";

const db = new PrismaClient();

async function main() {
  // Create demo user
  const hashedPassword = await hash("password", 12);
  const user = await db.user.upsert({
    where: { email: "demo@lightrace.dev" },
    update: {},
    create: {
      email: "demo@lightrace.dev",
      password: hashedPassword,
      name: "Demo User",
    },
  });
  console.log(`User: ${user.email}`);

  // Create demo project
  const project = await db.project.upsert({
    where: { id: "demo-project" },
    update: {},
    create: {
      id: "demo-project",
      name: "Demo Project",
    },
  });
  console.log(`Project: ${project.name} (${project.id})`);

  // Create demo API keys
  const publicKey = "pk-lt-demo";
  const secretKey = "sk-lt-demo";
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

  console.log("\n--- LightRace seeded ---");
  console.log(`Login: demo@lightrace.dev / password`);
  console.log(`SDK:   public_key=${publicKey}  secret_key=${secretKey}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
