import { describe, it, expect } from "vitest";
import { authenticateApiKey } from "@lightrace/shared/auth/apiAuth";
import { createTestProject, createTestApiKey, buildBasicAuthHeader } from "../helpers";

describe("authenticateApiKey", () => {
  it("returns valid with projectId for correct credentials", async () => {
    const project = await createTestProject();
    const { publicKey, secretKey } = await createTestApiKey({ projectId: project.id });
    const header = buildBasicAuthHeader(publicKey, secretKey);

    const result = await authenticateApiKey(header);
    expect(result).toEqual({ valid: true, projectId: project.id });
  });

  it("rejects correct public key with wrong secret", async () => {
    const project = await createTestProject();
    const { publicKey } = await createTestApiKey({ projectId: project.id });
    const header = buildBasicAuthHeader(publicKey, "sk-lt-wrong-secret");

    const result = await authenticateApiKey(header);
    expect(result).toEqual({ valid: false, error: "Invalid secret key" });
  });

  it("rejects nonexistent public key", async () => {
    const header = buildBasicAuthHeader("pk-lt-nonexistent", "sk-lt-whatever");
    const result = await authenticateApiKey(header);
    expect(result).toEqual({ valid: false, error: "Invalid API key" });
  });

  it("rejects missing Authorization header", async () => {
    const result = await authenticateApiKey(null);
    expect(result).toEqual({ valid: false, error: "Missing Authorization header" });
  });

  it("rejects non-Basic auth scheme", async () => {
    const result = await authenticateApiKey("Bearer some-token");
    expect(result).toEqual({ valid: false, error: "Unsupported auth scheme" });
  });

  it("rejects malformed Basic auth (no colon)", async () => {
    const encoded = Buffer.from("no-colon-here").toString("base64");
    const result = await authenticateApiKey(`Basic ${encoded}`);
    expect(result).toEqual({ valid: false, error: "Invalid Basic auth format" });
  });

  it("rejects empty public or secret key", async () => {
    const encoded = Buffer.from(":").toString("base64");
    const result = await authenticateApiKey(`Basic ${encoded}`);
    expect(result).toEqual({ valid: false, error: "Missing public or secret key" });
  });
});
