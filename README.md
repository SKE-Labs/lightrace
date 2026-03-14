<p align="center">
  <img src="packages/frontend/public/white_transparent.png" alt="LightRace" width="320" />
</p>

<h1 align="center">LightRace</h1>

<p align="center">Lightweight, open-source LLM tracing tool for local development. Drop-in compatible with the <a href="https://langfuse.com">Langfuse</a> Python/JS SDKs.</p>

## Features

- Compatible with Langfuse v3 (`POST /api/public/ingestion`) and v4 (OpenTelemetry)
- OpenTelemetry trace ingestion (protobuf + JSON)
- Real-time trace updates via WebSocket (Redis Pub/Sub)
- Trace and observation viewer with token usage breakdown
- API key management UI

## Architecture

LightRace is a monorepo with three packages:

```
packages/
  shared/      @lightrace/shared    — Prisma schema, DB + Redis clients, validation schemas
  backend/     @lightrace/backend   — Hono server (tRPC + REST ingestion + OTel)
  frontend/    @lightrace/frontend  — Next.js 15 UI + Auth.js
```

Infrastructure: PostgreSQL + Redis, managed via docker-compose.

The frontend authenticates users via Auth.js and proxies tRPC calls to the backend. SDK ingestion endpoints on the backend use API key auth (Basic Auth) directly.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) 10+
- [Docker](https://www.docker.com)

### Setup

```sh
# Start PostgreSQL + Redis
docker compose up -d

# Install dependencies
pnpm install

# Copy env file and symlink to packages
cp .env.example .env
ln -sf ../../.env packages/shared/.env
ln -sf ../../.env packages/backend/.env
ln -sf ../../.env packages/frontend/.env

# Generate Prisma client, run migrations, seed demo data
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Start all services (frontend on :3001, backend on :3002)
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) and log in with the demo credentials:

- **Email:** `demo@lightrace.dev`
- **Password:** `password`

### SDK Configuration

Point any Langfuse SDK at the backend (port 3002):

**Langfuse v4 (Python)** — uses environment variables:

```bash
export LANGFUSE_PUBLIC_KEY=pk-lt-demo
export LANGFUSE_SECRET_KEY=sk-lt-demo
export LANGFUSE_HOST=http://localhost:3002
```

```python
from langfuse import Langfuse

client = Langfuse()  # reads from env vars
```

**Langfuse v3 (Python)** — uses constructor args:

```python
from langfuse import Langfuse

langfuse = Langfuse(
    public_key="pk-lt-demo",
    secret_key="sk-lt-demo",
    host="http://localhost:3002",
)
```

**Langfuse JS/TS:**

```typescript
import Langfuse from "langfuse";

const langfuse = new Langfuse({
  publicKey: "pk-lt-demo",
  secretKey: "sk-lt-demo",
  baseUrl: "http://localhost:3002",
});
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
- **Auth:** Auth.js v5 (credentials provider, JWT strategy)
- **ORM:** Prisma 6 + PostgreSQL
- **Cache/PubSub:** Redis (ioredis)
- **Validation:** Zod v3
- **Testing:** Vitest

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```
DATABASE_URL     — Postgres connection (default: localhost:5435)
REDIS_URL        — Redis connection (default: localhost:6379)
AUTH_SECRET      — Auth.js JWT secret
AUTH_URL         — Frontend URL
NEXTAUTH_URL     — Same as AUTH_URL
BACKEND_URL      — Backend URL (frontend proxy target)
INTERNAL_SECRET  — Shared secret between frontend and backend
PORT             — Backend HTTP port (default: 3002)
WS_PORT          — Backend WebSocket port (default: 3003)
```

## License

MIT
