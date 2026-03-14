# Contributing to LightRace

Thank you for your interest in contributing to LightRace! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (for PostgreSQL + Redis)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/your-org/lightrace.git
cd lightrace

# Start PostgreSQL + Redis
docker compose up -d

# Install dependencies
pnpm install

# Copy env file and symlink to packages
cp .env.example .env
ln -sf ../../.env packages/shared/.env
ln -sf ../../.env packages/backend/.env
ln -sf ../../.env packages/frontend/.env

# Generate Prisma client, create database, and seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Start all services
pnpm dev
```

- Frontend: http://localhost:3001 (login with `demo@lightrace.dev` / `password`)
- Backend: http://localhost:3002 (health check at `/health`)

### SDK Testing

**Langfuse v4** (env vars):

```bash
export LANGFUSE_PUBLIC_KEY=pk-lt-demo
export LANGFUSE_SECRET_KEY=sk-lt-demo
export LANGFUSE_HOST=http://localhost:3002
```

```python
from langfuse import Langfuse

client = Langfuse()
with client.start_as_current_observation(name="test-trace"):
    pass
client.flush()
```

**Langfuse v3** (constructor args):

```python
from langfuse import Langfuse

langfuse = Langfuse(
    public_key="pk-lt-demo",
    secret_key="sk-lt-demo",
    host="http://localhost:3002"
)

trace = langfuse.trace(name="test")
trace.generation(name="llm-call", model="gpt-4", input="hello", output="world")
langfuse.flush()
```

## Project Structure

```
lightrace/
├── packages/
│   ├── shared/                    # @lightrace/shared
│   │   ├── prisma/                # Schema, migrations, seed
│   │   └── src/
│   │       ├── db.ts              # Prisma client singleton
│   │       ├── redis.ts           # ioredis client
│   │       ├── utils.ts           # Shared formatters
│   │       ├── schemas/           # Zod validation schemas
│   │       └── auth/              # API key authentication
│   │
│   ├── backend/                   # @lightrace/backend
│   │   └── src/
│   │       ├── index.ts           # Hono server entrypoint
│   │       ├── trpc/              # tRPC router, context, procedures
│   │       │   ├── context.ts     # Context creation + auth middleware
│   │       │   ├── router.ts      # Root router (AppRouter)
│   │       │   └── routers/       # traces, observations, settings, realtime
│   │       ├── routes/            # REST routes (ingestion, OTel)
│   │       ├── ingestion/         # Event processing + OTel spans
│   │       ├── realtime/          # Redis Pub/Sub + event emitter
│   │       └── middleware/        # Internal auth validation
│   │
│   └── frontend/                  # @lightrace/frontend
│       └── src/
│           ├── app/               # Next.js 15 App Router pages
│           │   ├── (dashboard)/   # Authenticated pages (traces, settings)
│           │   ├── api/           # tRPC proxy, Auth.js routes, WS auth
│           │   └── login/         # Login page
│           ├── components/
│           │   ├── ui/            # shadcn/ui components
│           │   ├── layout/        # Sidebar
│           │   └── trace/         # TraceList, TraceTree, ObservationDetail, JsonViewer
│           ├── server/
│           │   └── auth.ts        # Auth.js v5 config
│           └── lib/               # tRPC client, utilities, realtime hooks
│
├── docker-compose.yml             # PostgreSQL + Redis
├── turbo.json                     # Turborepo task config
├── pnpm-workspace.yaml            # Workspace packages
└── .env                           # Environment variables
```

## Development Commands

```bash
# All packages (via Turborepo)
pnpm dev              # Start frontend + backend concurrently
pnpm build            # Build all packages
pnpm typecheck        # TypeScript check all packages
pnpm test             # Run all tests
pnpm format           # Format with Prettier

# Per-package
pnpm --filter @lightrace/frontend dev
pnpm --filter @lightrace/backend dev
pnpm --filter @lightrace/shared typecheck

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed demo data
pnpm db:reset         # Reset database
pnpm db:studio        # Open Prisma Studio
```

## Code Quality

### Git Hooks (Husky)

- **Pre-commit**: Runs lint-staged (Prettier + ESLint on staged files)

### Code Style

- **Prettier** for formatting
- **ESLint** for linting (Next.js + TypeScript rules)
- Import from `zod` (Zod v3, not `zod/v4`)

### Testing

We use **Vitest** for unit and integration tests.

```bash
# Run all tests
pnpm test

# Run a specific package's tests
pnpm --filter @lightrace/backend test

# Run a specific test file
pnpm vitest run packages/shared/src/schemas/ingestion.test.ts
```

**Test patterns:**

- Tests go alongside source files: `foo.ts` -> `foo.test.ts`
- Each test should be independent (no shared state)
- Use `vi.mock()` for external dependencies
- Use `vi.clearAllMocks()` in `beforeEach`

### TypeScript

- Avoid `any` type when possible
- Use a single params object for functions with multiple arguments
- Shared types and schemas go in `@lightrace/shared`

## Architecture Notes

### Package Responsibilities

- **`@lightrace/shared`**: Database access, validation schemas, API key auth, Redis client. No business logic beyond data access.
- **`@lightrace/backend`**: All business logic. Hono server handles SDK ingestion (REST), OTel (protobuf), tRPC queries/mutations, and WebSocket subscriptions. Authenticated via internal secret from frontend proxy.
- **`@lightrace/frontend`**: UI only. Auth.js handles user login. tRPC queries/mutations are proxied to the backend via `/api/trpc`. tRPC subscriptions connect directly to the backend WebSocket server (port 3003).

### Auth Flow

1. User logs in via Auth.js (credentials provider, JWT strategy)
2. Frontend's `/api/trpc` route reads the session server-side
3. Proxies the request to the backend with `x-lightrace-internal-secret` and `x-lightrace-user-id` / `x-lightrace-user-email` headers
4. Backend validates the internal secret and extracts user info from headers

### SDK Ingestion Flow

Two ingestion paths are supported:

**Langfuse v3** (REST):

1. SDK sends `POST /api/public/ingestion` to the backend (port 3002)
2. Backend authenticates via Basic Auth (API key)
3. Events are processed synchronously and written to PostgreSQL

**Langfuse v4** (OpenTelemetry):

1. SDK sends `POST /api/public/otel/v1/traces` to the backend (port 3002)
2. Backend authenticates via Basic Auth (API key)
3. Protobuf or JSON payload is decoded, spans are mapped to traces/observations

Both paths publish affected trace IDs to Redis Pub/Sub (`trace:{projectId}` channel) after processing.

### Real-time Update Flow

1. Frontend fetches authenticated WS URL from `GET /api/ws-auth`
2. tRPC client connects via `wsLink` to backend WebSocket server (port 3003)
3. Frontend subscribes to `realtime.onTraceUpdate` with a `projectId`
4. Backend's `RealtimeEmitter` listens to Redis Pub/Sub and forwards matching events to WebSocket clients
5. Frontend receives update events and invalidates relevant React Query caches
6. Graceful degradation: if Redis/WS is unavailable, UI falls back to 30-second polling

## Pull Requests

1. Fork the repo and create a feature branch
2. Write tests for new functionality
3. Ensure `pnpm test`, `pnpm typecheck`, and `pnpm format:check` pass
4. Submit a PR with a clear description of changes

## License

MIT
