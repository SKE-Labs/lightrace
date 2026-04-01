"""
Lightrace + Anthropic example

Prerequisites:
  1. Start Lightrace server: cd ../.. && pnpm dev
  2. Copy ../.env.example to ../.env and fill in your ANTHROPIC_API_KEY
  3. Install deps: pip install lightrace anthropic python-dotenv
  4. Run: python anthropic_example.py

Then open http://localhost:3001 to see the trace in the dashboard.
"""

import os

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import anthropic

from lightrace import Lightrace, trace
from lightrace.integrations.anthropic import LightraceAnthropicInstrumentor

lt = Lightrace(
    public_key=os.environ.get("LIGHTRACE_PUBLIC_KEY"),
    secret_key=os.environ.get("LIGHTRACE_SECRET_KEY"),
    host=os.environ.get("LIGHTRACE_HOST"),
)

client = anthropic.Anthropic()
instrumentor = LightraceAnthropicInstrumentor(client=lt)
instrumentor.instrument(client)


@trace()
def ask_claude():
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=256,
        messages=[
            {
                "role": "user",
                "content": "What is the capital of Mongolia? Answer in one sentence.",
            }
        ],
    )

    text = response.content[0].text if response.content else ""
    print(f"\nClaude says: {text}")
    return text


ask_claude()

lt.flush()
lt.shutdown()

print("\n✓ Trace sent! Open http://localhost:3001 to view it.")
