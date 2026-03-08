import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticateApiKey } from "./apiAuth";
import { createHash } from "crypto";

// Mock the db module
vi.mock("@/server/db", () => ({
  db: {
    apiKey: {
      findUnique: vi.fn(),
    },
  },
}));

import { db } from "@/server/db";

const mockFindUnique = vi.mocked(db.apiKey.findUnique);

describe("authenticateApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject missing Authorization header", async () => {
    const result = await authenticateApiKey(null);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("Missing Authorization header");
    }
  });

  it("should reject unsupported auth scheme", async () => {
    const result = await authenticateApiKey("Bearer some-token");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("Unsupported auth scheme");
    }
  });

  it("should reject invalid Basic auth format (no colon)", async () => {
    const encoded = Buffer.from("no-colon-here").toString("base64");
    const result = await authenticateApiKey(`Basic ${encoded}`);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("Invalid Basic auth format");
    }
  });

  it("should reject empty public key", async () => {
    const encoded = Buffer.from(":secret").toString("base64");
    const result = await authenticateApiKey(`Basic ${encoded}`);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("Missing public or secret key");
    }
  });

  it("should reject empty secret key", async () => {
    const encoded = Buffer.from("public:").toString("base64");
    const result = await authenticateApiKey(`Basic ${encoded}`);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("Missing public or secret key");
    }
  });

  it("should reject unknown public key", async () => {
    mockFindUnique.mockResolvedValue(null);

    const encoded = Buffer.from("pk-unknown:sk-secret").toString("base64");
    const result = await authenticateApiKey(`Basic ${encoded}`);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("Invalid API key");
    }
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { publicKey: "pk-unknown" },
      select: { hashedSecretKey: true, projectId: true },
    });
  });

  it("should reject wrong secret key", async () => {
    const correctSecret = "sk-correct";
    const hashedCorrect = createHash("sha256").update(correctSecret).digest("hex");

    mockFindUnique.mockResolvedValue({
      hashedSecretKey: hashedCorrect,
      projectId: "project-1",
    } as never);

    const encoded = Buffer.from("pk-test:sk-wrong").toString("base64");
    const result = await authenticateApiKey(`Basic ${encoded}`);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("Invalid secret key");
    }
  });

  it("should authenticate valid credentials", async () => {
    const secretKey = "sk-valid-secret";
    const hashedSecret = createHash("sha256").update(secretKey).digest("hex");

    mockFindUnique.mockResolvedValue({
      hashedSecretKey: hashedSecret,
      projectId: "project-123",
    } as never);

    const encoded = Buffer.from(`pk-valid:${secretKey}`).toString("base64");
    const result = await authenticateApiKey(`Basic ${encoded}`);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.projectId).toBe("project-123");
    }
  });

  it("should handle secret key with colons", async () => {
    const secretKey = "sk-has:colons:in:it";
    const hashedSecret = createHash("sha256").update(secretKey).digest("hex");

    mockFindUnique.mockResolvedValue({
      hashedSecretKey: hashedSecret,
      projectId: "project-456",
    } as never);

    const encoded = Buffer.from(`pk-test:${secretKey}`).toString("base64");
    const result = await authenticateApiKey(`Basic ${encoded}`);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.projectId).toBe("project-456");
    }
  });
});
