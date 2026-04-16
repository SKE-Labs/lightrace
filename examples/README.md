# Lightrace Examples

Quick-start examples showing how to use Lightrace with different LLM providers.

## Setup

1. **Start Lightrace server** (from the repo root):

   ```bash
   cd lightrace
   pnpm dev
   ```

   Or use Docker: `docker compose up -d` to start everything on http://localhost:3000.

2. **Configure `.env`** in the example directory you want to run (JS or Python):
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your LLM provider API keys.

## JavaScript / TypeScript Examples

```bash
cd js
cp .env.example .env       # fill in your keys
npm install

npm run anthropic           # Anthropic example
npm run openai              # OpenAI example
npm run langchain           # LangChain example
npm run claude-agent-sdk    # Claude Agent SDK example
```

## Python Examples

```bash
cd python
cp .env.example .env       # fill in your keys
pip install -r requirements.txt

python anthropic_example.py
python openai_example.py
python langchain_example.py
python langchain_fork_example.py   # Fork/replay demo
python claude_agent_sdk_example.py
```

## View Traces

After running any example, open http://localhost:3000 (Docker) or http://localhost:3001 (dev mode) in your browser.

Log in with the demo credentials:

- Email: `demo@lightrace.dev`
- Password: `password`

You'll see your traces with full LLM call details including model, token usage, input/output, and latency.

## Fork / Replay (Time Travel)

The `langchain_fork_example.py` demonstrates the Fork feature. After running it:

1. Open a trace in the dashboard
2. Click any **TOOL** observation
3. Click **Fork** — modify the tool input and run
4. The graph re-executes from that checkpoint with the new tool result
5. Observations stream to the forked trace in real-time
6. Compare the original and forked execution side-by-side

**Requirements for fork:**

- Your LangGraph must have a **checkpointer** (`MemorySaver`, `AsyncPostgresSaver`, etc.)
- Call `lt.register_graph(agent)` to enable fork from the dashboard
- Call `lt.register_tools(...)` so tools can be re-invoked
- Pass `session_id=thread_id` and `configurable={"thread_id": ...}` to the callback handler
