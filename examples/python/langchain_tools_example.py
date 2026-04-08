"""
Lightrace + LangChain Tools example

Demonstrates a ReAct agent with tools that are:
  - Traced automatically via LightraceCallbackHandler
  - Registered with Lightrace for re-invocation from the dashboard

Prerequisites:
  1. Start Lightrace server: cd ../.. && pnpm dev
  2. Copy ../.env.example to ../.env and fill in your ANTHROPIC_API_KEY
  3. Install deps: pip install lightrace langchain-core langchain-anthropic langgraph python-dotenv
  4. Run: python langchain_tools_example.py

Then open http://localhost:3001 to see the trace and re-run tools from the dashboard.

Docker note:
  If Lightrace runs in Docker (e.g. via `lightrace start`), the backend
  container cannot reach your SDK at 127.0.0.1. Set the env var so the
  dev server binds to 0.0.0.0 and registers a reachable callback URL:

    LIGHTRACE_DEV_SERVER_HOST=host.docker.internal python langchain_tools_example.py
"""

import os

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from langchain_anthropic import ChatAnthropic
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

from lightrace import Lightrace
from lightrace.integrations.langchain import LightraceCallbackHandler

# ── Initialize Lightrace ─────────────────────────────────────────────────

lt = Lightrace(
    public_key=os.environ.get("LIGHTRACE_PUBLIC_KEY"),
    secret_key=os.environ.get("LIGHTRACE_SECRET_KEY"),
    host=os.environ.get("LIGHTRACE_HOST"),
)

# ── Define tools ─────────────────────────────────────────────────────────


@tool
def get_weather(city: str) -> str:
    """Get the current weather for a city."""
    weather_data = {
        "New York": "72°F, sunny",
        "London": "58°F, cloudy",
        "Tokyo": "65°F, partly cloudy",
        "Ulaanbaatar": "45°F, windy",
    }
    return weather_data.get(city, f"No weather data available for {city}")


@tool
def calculate(expression: str) -> str:
    """Evaluate a math expression. Example: '2 + 3 * 4'."""
    try:
        result = eval(expression)  # noqa: S307
        return str(result)
    except Exception as e:
        return f"Error: {e}"


# ── Register tools for dashboard re-invocation ───────────────────────────

lt.register_tools(get_weather, calculate)

# ── Create agent and run ─────────────────────────────────────────────────

llm = ChatAnthropic(model="claude-sonnet-4-20250514")
agent = create_react_agent(llm, [get_weather, calculate])

handler = LightraceCallbackHandler(
    client=lt,
    user_id="user-123",
    session_id="demo-session",
    trace_name="weather-calculator-agent",
)

result = agent.invoke(
    {"messages": [("user", "What's the weather in Tokyo? Also, what is 15 * 24?")]},
    config={"callbacks": [handler]},
)

for msg in result["messages"]:
    role = msg.type
    content = msg.content if isinstance(msg.content, str) else str(msg.content)
    print(f"[{role}] {content}")

print(f"\nTrace ID: {handler.last_trace_id}")

# ── Keep dev server alive for dashboard re-invocation ────────────────────

lt.flush()

print("\n✓ Trace sent! Open http://localhost:3001 to view it.")
print("  Navigate to the trace → click a tool observation → 'Re-run' to invoke from the dashboard.")
print("\n  Dev server running — press Enter to shut down...")

try:
    input()
except KeyboardInterrupt:
    pass

lt.shutdown()
