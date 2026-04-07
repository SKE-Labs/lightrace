/**
 * Lightrace + Claude Agent SDK example
 *
 * This example runs a Claude agent that reads files and answers questions,
 * with full tracing of each generation and tool call in Lightrace.
 *
 * Prerequisites:
 *   1. Start Lightrace server: cd ../.. && pnpm dev
 *   2. Copy .env.example to .env and fill in your keys
 *   3. Run: npx tsx claude-agent-sdk.ts
 *
 * Then open http://localhost:3001 to see the trace in the dashboard.
 */
import "dotenv/config";
import { Lightrace } from "lightrace";
import { tracedQuery } from "lightrace/integrations/claude-agent-sdk";

const lt = new Lightrace({
  publicKey: process.env.LIGHTRACE_PUBLIC_KEY,
  secretKey: process.env.LIGHTRACE_SECRET_KEY,
  host: process.env.LIGHTRACE_HOST,
});

for await (const message of tracedQuery({
  prompt:
    "Read the files in this directory and give a one-paragraph summary of what this project does.",
  options: { maxTurns: 5, allowedTools: ["Read", "Glob", "Grep"] },
  client: lt,
  traceName: "project-summarizer",
})) {
  if (message.type === "assistant") {
    const content = (message as Record<string, unknown>).message as Record<string, unknown>;
    const blocks = (content?.content ?? []) as Array<Record<string, unknown>>;
    for (const block of blocks) {
      if (block.type === "text") {
        console.log(block.text);
      }
    }
  } else if (message.type === "result") {
    const r = message as Record<string, unknown>;
    console.log(`\nTurns: ${r.num_turns}, Cost: $${r.total_cost_usd}`);
  }
}

lt.flush();
await lt.shutdown();

console.log("\n✓ Trace sent! Open http://localhost:3001 to view it.");
