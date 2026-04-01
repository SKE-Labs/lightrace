/**
 * Lightrace + Anthropic example
 *
 * Prerequisites:
 *   1. Start Lightrace server: cd ../.. && pnpm dev
 *   2. Copy ../.env.example to ../.env and fill in your ANTHROPIC_API_KEY
 *   3. Run: npx tsx anthropic.ts
 *
 * Then open http://localhost:3001 to see the trace in the dashboard.
 */
import "dotenv/config";
import { Lightrace, trace } from "lightrace";
import { LightraceAnthropicInstrumentor } from "lightrace/integrations/anthropic";
import Anthropic from "@anthropic-ai/sdk";

const lt = new Lightrace({
  publicKey: process.env.LIGHTRACE_PUBLIC_KEY,
  secretKey: process.env.LIGHTRACE_SECRET_KEY,
  host: process.env.LIGHTRACE_HOST,
});

const anthropic = new Anthropic();
const instrumentor = new LightraceAnthropicInstrumentor({ client: lt });
instrumentor.instrument(anthropic);

const askClaude = trace("ask-claude", async () => {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: "What is the capital of Mongolia? Answer in one sentence.",
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  console.log("\nClaude says:", text);
  return text;
});

await askClaude();

lt.flush();
await lt.shutdown();

console.log("\n✓ Trace sent! Open http://localhost:3001 to view it.");
