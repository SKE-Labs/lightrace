"""
Lightrace + Claude Agent SDK example

This example runs a Claude agent that reads files and answers questions,
with full tracing of each generation and tool call in Lightrace.

Prerequisites:
  1. Start Lightrace server: cd ../.. && pnpm dev
  2. Copy .env.example to .env and fill in your keys
  3. Install deps: pip install lightrace claude-agent-sdk python-dotenv
  4. Run: python claude_agent_sdk_example.py

Then open http://localhost:3001 to see the trace in the dashboard.
"""

import os

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import anyio
from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, ResultMessage, TextBlock

from lightrace import Lightrace
from lightrace.integrations.claude_agent_sdk import traced_query

lt = Lightrace(
    public_key=os.environ.get("LIGHTRACE_PUBLIC_KEY"),
    secret_key=os.environ.get("LIGHTRACE_SECRET_KEY"),
    host=os.environ.get("LIGHTRACE_HOST"),
)


async def main():
    options = ClaudeAgentOptions(
        max_turns=5,
        allowed_tools=["Read", "Glob", "Grep"],
    )

    async for message in traced_query(
        prompt="Read the files in this directory and give a one-paragraph summary of what this project does.",
        options=options,
        client=lt,
        trace_name="project-summarizer",
    ):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    print(block.text)
        elif isinstance(message, ResultMessage):
            print(f"\nTurns: {message.num_turns}, Cost: ${message.total_cost_usd:.4f}")

    lt.flush()
    lt.shutdown()
    print("\n✓ Trace sent! Open http://localhost:3001 to view it.")


anyio.run(main)
