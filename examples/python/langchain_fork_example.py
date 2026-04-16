"""
Lightrace + LangGraph Fork/Replay example

Demonstrates a LangGraph agent with persistent checkpointing that supports
the "Fork" feature from the Lightrace dashboard — letting you explore
"what if this tool returned a different result?" by forking from any tool
observation and continuing the graph with modified output.

Prerequisites:
  1. Start Lightrace server: cd ../.. && make dev
  2. Copy ../.env.example to ../.env and fill in your ANTHROPIC_API_KEY
  3. Install deps: pip install -r requirements.txt
  4. Run: python langchain_fork_example.py

Then open http://localhost:3001, navigate to the trace, click any TOOL
observation, and press "Fork" to explore alternative execution paths.

How fork works:
  1. You click "Fork" on a tool observation in the dashboard
  2. Lightrace re-runs the tool with your modified input
  3. The SDK forks the LangGraph thread from that checkpoint
  4. The graph continues executing with the new tool result
  5. Observations stream to the forked trace in real-time via OTel
  6. The compare view shows original vs forked side-by-side
"""

import asyncio
import os

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from langchain_anthropic import ChatAnthropic
from langchain_core.tools import tool
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

from lightrace import Lightrace
from lightrace.integrations.langchain import LightraceCallbackHandler

# ── Define tools ─────────────────────────────────────────────────────────


@tool
def get_weather(city: str) -> str:
    """Get the current weather for a city."""
    weather_data = {
        "New York": "72F, sunny with clear skies",
        "London": "58F, cloudy with light rain",
        "Tokyo": "65F, partly cloudy",
        "Ulaanbaatar": "45F, windy and dry",
    }
    return weather_data.get(city, f"No weather data available for {city}")


@tool
def get_population(city: str) -> str:
    """Get the population of a city."""
    population_data = {
        "New York": "8.3 million",
        "London": "8.8 million",
        "Tokyo": "13.9 million",
        "Ulaanbaatar": "1.5 million",
    }
    return population_data.get(city, f"No population data for {city}")


# ── Initialize Lightrace with tools ─────────────────────────────────────
# Tools and context can be registered directly in the constructor.

lt = Lightrace(
    public_key=os.environ.get("LIGHTRACE_PUBLIC_KEY"),
    secret_key=os.environ.get("LIGHTRACE_SECRET_KEY"),
    host=os.environ.get("LIGHTRACE_HOST"),
    tools=[get_weather, get_population],
)

# ── Create agent with checkpointer (required for fork) ──────────────────

llm = ChatAnthropic(model="claude-sonnet-4-20250514")
checkpointer = MemorySaver()

agent = create_react_agent(llm, [get_weather, get_population], checkpointer=checkpointer)


# ── Run the agent ────────────────────────────────────────────────────────


async def main():
    thread_id = "demo-thread-1"

    handler = LightraceCallbackHandler(
        client=lt,
        user_id="user-123",
        session_id=thread_id,
        trace_name="city-info-agent",
        configurable={"thread_id": thread_id},
    )

    result = await agent.ainvoke(
        {"messages": [("user", "Compare the weather and population of Tokyo and London")]},
        config={
            "configurable": {"thread_id": thread_id},
            "callbacks": [handler],
        },
    )

    for msg in result["messages"]:
        role = msg.type
        content = msg.content if isinstance(msg.content, str) else str(msg.content)
        print(f"[{role}] {content[:200]}")

    print(f"\nTrace ID: {handler.last_trace_id}")

    # ── Register graph for fork/replay ───────────────────────────────────
    # This tells Lightrace that the graph supports forking via its
    # checkpointer. Must be called from an async context so the event loop
    # can be captured for cross-thread dispatch.

    lt.register_graph(agent, event_loop=asyncio.get_running_loop())

    lt.flush()

    print("\n--- Fork/Replay ready! ---")
    print("Open http://localhost:3001 to view the trace.")
    print("Click any TOOL observation -> 'Fork' to explore alternative paths.")
    print("\nDev server running - press Ctrl+C to shut down...")

    # Keep alive for dashboard interaction
    try:
        await asyncio.Event().wait()
    except asyncio.CancelledError:
        pass


try:
    asyncio.run(main())
except KeyboardInterrupt:
    pass
finally:
    lt.shutdown()
