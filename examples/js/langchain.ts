/**
 * Lightrace + LangChain example
 *
 * Prerequisites:
 *   1. Start Lightrace server: cd ../.. && pnpm dev
 *   2. Copy ../.env.example to ../.env and fill in your OPENAI_API_KEY
 *   3. Install deps: npm install lightrace @langchain/core @langchain/openai dotenv
 *   4. Run: npx tsx langchain.ts
 *
 * Then open http://localhost:3001 to see the trace in the dashboard.
 */
import "dotenv/config";
import { Lightrace } from "lightrace";
import { LightraceCallbackHandler } from "lightrace/integrations/langchain";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

const lt = new Lightrace({
  publicKey: process.env.LIGHTRACE_PUBLIC_KEY,
  secretKey: process.env.LIGHTRACE_SECRET_KEY,
  host: process.env.LIGHTRACE_HOST,
});

const handler = new LightraceCallbackHandler({ client: lt });

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  maxTokens: 256,
});

const response = await model.invoke(
  [new HumanMessage("What is the speed of light? Answer in one sentence.")],
  { callbacks: [handler] },
);

console.log("\nLangChain says:", response.content);

lt.flush();
await lt.shutdown();

console.log("\n✓ Trace sent! Open http://localhost:3001 to view it.");
