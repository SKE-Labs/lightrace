# Lightrace Examples

Quick-start examples showing how to use Lightrace with different LLM providers.

## Setup

1. **Start Lightrace server** (from the repo root):

   ```bash
   cd lightrace
   pnpm dev
   ```

   This starts the backend on http://localhost:3002 and the dashboard on http://localhost:3001.

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
```

## Python Examples

```bash
cd python
cp .env.example .env       # fill in your keys
pip install -r requirements.txt

python anthropic_example.py
python openai_example.py
python langchain_example.py
```

## View Traces

After running any example, open http://localhost:3001 in your browser.

Log in with the demo credentials:

- Email: `demo@lightrace.dev`
- Password: `password`

You'll see your traces with full LLM call details including model, token usage, input/output, and latency.
