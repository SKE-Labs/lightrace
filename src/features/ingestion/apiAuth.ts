import { createHash } from "crypto";
import { db } from "@/server/db";

export interface AuthResult {
  valid: true;
  projectId: string;
}

export interface AuthError {
  valid: false;
  error: string;
}

export async function authenticateApiKey(
  authHeader: string | null,
): Promise<AuthResult | AuthError> {
  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  // Support both "Basic base64" and "Bearer token" formats
  let publicKey: string;
  let secretKey: string;

  if (authHeader.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
    const colonIndex = decoded.indexOf(":");
    if (colonIndex === -1) {
      return { valid: false, error: "Invalid Basic auth format" };
    }
    publicKey = decoded.slice(0, colonIndex);
    secretKey = decoded.slice(colonIndex + 1);
  } else {
    return { valid: false, error: "Unsupported auth scheme" };
  }

  if (!publicKey || !secretKey) {
    return { valid: false, error: "Missing public or secret key" };
  }

  const apiKey = await db.apiKey.findUnique({
    where: { publicKey },
    select: { hashedSecretKey: true, projectId: true },
  });

  if (!apiKey) {
    return { valid: false, error: "Invalid API key" };
  }

  const hashedInput = createHash("sha256").update(secretKey).digest("hex");
  if (hashedInput !== apiKey.hashedSecretKey) {
    return { valid: false, error: "Invalid secret key" };
  }

  return { valid: true, projectId: apiKey.projectId };
}
