import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@lightrace/shared/db";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = registerSchema.parse(body);

    const [existing, hashedPassword] = await Promise.all([
      db.user.findUnique({ where: { email: input.email } }),
      hash(input.password, 12),
    ]);

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const publicKey = `pk-lt-${randomBytes(16).toString("hex")}`;
    const secretKey = `sk-lt-${randomBytes(24).toString("hex")}`;
    const hashedSecretKey = createHash("sha256").update(secretKey).digest("hex");
    const displaySecretKey = `sk-lt-...${secretKey.slice(-4)}`;

    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          name: input.name,
        },
      });

      await tx.project.create({
        data: {
          name: "My Project",
          memberships: {
            create: { userId: user.id, role: "OWNER" },
          },
          apiKeys: {
            create: {
              publicKey,
              hashedSecretKey,
              displaySecretKey,
              note: "Default API Key",
            },
          },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }
    console.error("[register] Error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
