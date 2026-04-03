<p align="center">
  <img src="packages/frontend/public/white_transparent.png" alt="LightRace" width="320" />
</p>

<h1 align="center">LightRace</h1>

<p align="center">Lightweight, open-source LLM tracing tool with remote tool invocation. Drop-in compatible with <a href="https://langfuse.com">Langfuse</a> Python/JS SDKs, plus its own <code>lightrace-python</code> and <code>lightrace-js</code> SDKs.</p>

## Features

- Compatible with Langfuse v3 (`POST /api/public/ingestion`) and v4 (OpenTelemetry)
- Native SDKs (`lightrace-python`, `lightrace-js`) with unified `@trace` decorator
- Remote tool invocation — re-run `@trace(type="tool")` functions from the UI
- Real-time trace updates via WebSocket (Redis Pub/Sub)
- Trace and observation viewer with token usage breakdown
- Tools page showing connected SDK instances and registered tools
- API key management UI

## Architecture

LightRace is a monorepo with three packages:

```
packages/
  shared/      @lightrace/shared    — Prisma schema, DB + Redis clients, validation schemas
  backend/     @lightrace/backend   — Hono server (tRPC + REST ingestion + OTel + Tool registry)
  frontend/    @lightrace/frontend  — Next.js 15 UI + Auth.js
```

Infrastructure: PostgreSQL + Redis + Caddy (reverse proxy), managed via docker-compose.

All traffic enters through Caddy on a single port (default: 3000):

- `/api/public/*` → backend (SDK ingestion, OTLP, tool registration)
- `/trpc/*` → backend (tRPC)
- `/ws` → backend WebSocket (real-time subscriptions)
- `/*` → frontend (dashboard, Auth.js)

## Quick Start

### Docker Compose (recommended for self-hosting)

```sh
# Copy and configure environment
cp .env.example .env

# Start everything (Postgres, Redis, Backend, Frontend, Caddy)
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) and log in with the demo credentials:

- **Email:** `demo@lightrace.dev`
- **Password:** `password`

### Development Setup

For working on the codebase:

```sh
# Start infrastructure only (Postgres + Redis)
docker compose up -d postgres redis

# Install dependencies
pnpm install

# Copy per-package env files
cp packages/shared/.env.example packages/shared/.env
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env

# Generate Prisma client, run migrations, seed demo data
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Start all services (frontend on :3001, backend on :3002)
pnpm dev
```

In development mode (without Caddy), the dashboard is at [http://localhost:3001](http://localhost:3001).

### SDK Configuration

#### LightRace SDKs (recommended)

**Python** (`lightrace-python`):

```python
from lightrace import Lightrace, trace

lt = Lightrace(
    public_key="pk-lt-demo",
    secret_key="sk-lt-demo",
    host="http://localhost:3000",
)

@trace()
def run_agent(query: str):
    return search(query)

@trace(type="tool")  # remotely invocable from the UI
def search(query: str) -> list:
    return ["result"]

run_agent("hello")
lt.flush()
```

**TypeScript** (`lightrace-js`):

```typescript
import { LightRace, trace } from "lightrace";

const lt = new LightRace({
  publicKey: "pk-lt-demo",
  secretKey: "sk-lt-demo",
  host: "http://localhost:3000",
});

const search = trace("search", { type: "tool" }, async (query: string) => {
  return ["result"];
});

const runAgent = trace("run-agent", async (query: string) => {
  return search(query);
});

await runAgent("hello");
lt.flush();
```

#### Langfuse SDKs (also supported)

Point any Langfuse SDK at the gateway (port 3000):

```bash
export LANGFUSE_PUBLIC_KEY=pk-lt-demo
export LANGFUSE_SECRET_KEY=sk-lt-demo
export LANGFUSE_HOST=http://localhost:3000
```

## Scripts

| Command                                 | Description                    |
| --------------------------------------- | ------------------------------ |
| `pnpm dev`                              | Start all services (Turborepo) |
| `pnpm build`                            | Build all packages             |
| `pnpm typecheck`                        | TypeScript check all packages  |
| `pnpm test`                             | Run all tests (Vitest)         |
| `pnpm format`                           | Format all packages (Prettier) |
| `pnpm db:generate`                      | Generate Prisma client         |
| `pnpm db:migrate`                       | Run Prisma migrations          |
| `pnpm db:seed`                          | Seed demo data                 |
| `pnpm db:studio`                        | Open Prisma Studio             |
| `pnpm --filter @lightrace/frontend dev` | Frontend only (port 3001)      |
| `pnpm --filter @lightrace/backend dev`  | Backend only (port 3002)       |

## Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Frontend:** Next.js 15 (App Router), shadcn/ui + Tailwind CSS v4
- **Backend:** Hono, tRPC v11 (fetch adapter + WebSocket subscriptions)
- **Gateway:** Caddy (reverse proxy, automatic HTTPS)
- **Auth:** Auth.js v5 (credentials provider, JWT strategy)
- **ORM:** Prisma 7 + PostgreSQL
- **Cache/PubSub:** Redis (ioredis)
- **Validation:** Zod v3
- **Testing:** Vitest

## Environment Variables

### Docker Compose (`.env`)

For `docker compose up` — a single flat file:

```
GATEWAY_PORT=3000            # Caddy exposed port
PUBLIC_URL=http://localhost:3000
DB_PASSWORD=lightrace
AUTH_SECRET=dev-auth-secret
INTERNAL_SECRET=dev-internal-secret
# LIGHTRACE_DOMAIN=          # Set a domain for automatic HTTPS
```

### Development (per-package `.env`)

**`packages/shared/.env`** — Database + Redis:

```
DATABASE_URL     — Postgres connection (default: localhost:5435)
REDIS_URL        — Redis connection (default: localhost:6379)
```

**`packages/backend/.env`** — Backend server:

```
DATABASE_URL     — Postgres connection
REDIS_URL        — Redis connection
PORT             — HTTP port (default: 3002)
WS_PORT          — WebSocket port (default: 3003)
INTERNAL_SECRET  — Shared secret for frontend↔backend auth
```

**`packages/frontend/.env`** — Frontend + Auth:

```
DATABASE_URL     — Postgres connection
REDIS_URL        — Redis connection
AUTH_SECRET      — Auth.js JWT secret
AUTH_URL         — Frontend URL
NEXTAUTH_URL     — Same as AUTH_URL
BACKEND_URL      — Backend URL (tRPC proxy target)
INTERNAL_SECRET  — Shared secret for frontend↔backend auth
WS_PORT          — Backend WebSocket port
```

## License

MIT
