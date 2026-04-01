"""
Lightrace + OpenAI example

Prerequisites:
  1. Start Lightrace server: cd ../.. && pnpm dev
  2. Copy ../.env.example to ../.env and fill in your OPENAI_API_KEY
  3. Install deps: pip install lightrace openai python-dotenv
  4. Run: python openai_example.py

Then open http://localhost:3001 to see the trace in the dashboard.
"""

import os

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import openai

from lightrace import Lightrace, trace
from lightrace.integrations.openai import LightraceOpenAIInstrumentor

lt = Lightrace(
    public_key=os.environ.get("LIGHTRACE_PUBLIC_KEY"),
    secret_key=os.environ.get("LIGHTRACE_SECRET_KEY"),
    host=os.environ.get("LIGHTRACE_HOST"),
)

client = openai.OpenAI()
instrumentor = LightraceOpenAIInstrumentor(client=lt)
instrumentor.instrument(client)


@trace()
def ask_gpt():
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=256,
        messages=[
            {
                "role": "user",
                "content": "What is the tallest mountain in the world? Answer in one sentence.",
            }
        ],
    )

    text = response.choices[0].message.content or ""
    print(f"\nGPT says: {text}")
    return text


ask_gpt()

lt.flush()
lt.shutdown()

print("\n✓ Trace sent! Open http://localhost:3001 to view it.")
