/**
 * Lightrace + OpenAI example
 *
 * Prerequisites:
 *   1. Start Lightrace server: cd ../.. && pnpm dev
 *   2. Copy ../.env.example to ../.env and fill in your OPENAI_API_KEY
 *   3. Run: npx tsx openai.ts
 *
 * Then open http://localhost:3001 to see the trace in the dashboard.
 */
import "dotenv/config";
import { Lightrace, trace } from "lightrace";
import { LightraceOpenAIInstrumentor } from "lightrace/integrations/openai";
import OpenAI from "openai";

const lt = new Lightrace({
  publicKey: process.env.LIGHTRACE_PUBLIC_KEY,
  secretKey: process.env.LIGHTRACE_SECRET_KEY,
  host: process.env.LIGHTRACE_HOST,
});

const openai = new OpenAI();
const instrumentor = new LightraceOpenAIInstrumentor({ client: lt });
instrumentor.instrument(openai);

const askGPT = trace("ask-gpt", async () => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: "What is the tallest mountain in the world? Answer in one sentence.",
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  console.log("\nGPT says:", text);
  return text;
});

await askGPT();

lt.flush();
await lt.shutdown();

console.log("\n✓ Trace sent! Open http://localhost:3001 to view it.");
