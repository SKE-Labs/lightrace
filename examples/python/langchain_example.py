"""
Lightrace + LangChain example

Prerequisites:
  1. Start Lightrace server: cd ../.. && pnpm dev
  2. Copy ../.env.example to ../.env and fill in your OPENAI_API_KEY
  3. Install deps: pip install lightrace langchain-core langchain-openai python-dotenv
  4. Run: python langchain_example.py

Then open http://localhost:3001 to see the trace in the dashboard.
"""

import os

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from lightrace import Lightrace
from lightrace.integrations.langchain import LightraceCallbackHandler

lt = Lightrace(
    public_key=os.environ.get("LIGHTRACE_PUBLIC_KEY"),
    secret_key=os.environ.get("LIGHTRACE_SECRET_KEY"),
    host=os.environ.get("LIGHTRACE_HOST"),
)

handler = LightraceCallbackHandler(client=lt)

model = ChatOpenAI(model="gpt-4o-mini", max_tokens=256)

response = model.invoke(
    [HumanMessage(content="What is the speed of light? Answer in one sentence.")],
    config={"callbacks": [handler]},
)

print(f"\nLangChain says: {response.content}")

lt.flush()
lt.shutdown()

print("\n✓ Trace sent! Open http://localhost:3001 to view it.")
