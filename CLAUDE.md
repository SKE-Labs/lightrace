# CLAUDE.md

## Project Overview

Lightrace is an agentic development kit — LLM tracing, tool management, and agent primitives. It is compatible with the Langfuse Python/JS SDKs and has its own SDKs (`lightrace-python`, `lightrace-js`) with a unified `@trace` decorator, provider wrappers, and an embedded HTTP dev server for tool invocation from the dashboard.

## Architecture

Monorepo with Turborepo + pnpm workspaces:

- **`packages/shared`** (`@lightrace/shared`) — Prisma schema, DB client, Zod schemas, Redis client, shared utils
- **`packages/backend`** (`@lightrace/backend`) — Hono server (tRPC + REST ingestion + OTel + HTTP tool registry)
- **`packages/frontend`** (`@lightrace/frontend`) — Next.js 15 (UI + Auth.js), proxies tRPC to backend
- **Infrastructure:** PostgreSQL (port 5435) + Redis (port 6379) via docker-compose

Frontend authenticates users via Auth.js. tRPC queries/mutations are proxied through `/api/trpc` to the backend with an internal secret + user info headers. tRPC subscriptions connect directly to the backend WebSocket server (port 3003) with auth params from `GET /api/ws-auth`.

Real-time flow: ingestion → Redis Pub/Sub → tRPC subscription → WebSocket → frontend query invalidation.

Tool invocation flow: SDK starts embedded HTTP dev server → registers tools + callbackUrl via HTTP POST → dashboard invokes tools by proxying HTTP request through backend to SDK's dev server → SDK executes locally → result returned.

**Docker networking for tool re-run:** When the backend runs in Docker (via `lightrace start` or `docker-compose`), it cannot reach the SDK's dev server at `127.0.0.1`. Set `LIGHTRACE_DEV_SERVER_HOST=host.docker.internal` (or pass `dev_server_host` / `devServerHost` to the client constructor) so the dev server binds to `0.0.0.0` and registers a reachable callback URL. The `lightrace-cli` adds `host.docker.internal:host-gateway` to the backend container automatically.

## Key Files

| Purpose             | Path                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| Prisma schema       | `packages/shared/prisma/schema.prisma`                                     |
| Prisma config       | `packages/shared/prisma.config.ts`                                         |
| DB client           | `packages/shared/src/db.ts`                                                |
| Redis client        | `packages/shared/src/redis.ts`                                             |
| Ingestion schemas   | `packages/shared/src/schemas/ingestion.ts`                                 |
| API auth            | `packages/shared/src/auth/apiAuth.ts`                                      |
| Backend entrypoint  | `packages/backend/src/index.ts`                                            |
| tRPC router         | `packages/backend/src/trpc/router.ts`                                      |
| tRPC context        | `packages/backend/src/trpc/context.ts`                                     |
| Tools tRPC router   | `packages/backend/src/trpc/routers/tools.ts`                               |
| Tools HTTP registry | `packages/backend/src/routes/tools-registry.ts`                            |
| Event processing    | `packages/backend/src/ingestion/processEventBatch.ts`                      |
| Ingestion route     | `packages/backend/src/routes/ingestion.ts`                                 |
| OTel route          | `packages/backend/src/routes/otel.ts`                                      |
| Auth config         | `packages/frontend/src/server/auth.ts`                                     |
| tRPC proxy          | `packages/frontend/src/app/api/trpc/[trpc]/route.ts`                       |
| Realtime pub/sub    | `packages/backend/src/realtime/pubsub.ts`                                  |
| Realtime router     | `packages/backend/src/trpc/routers/realtime.ts`                            |
| WS auth endpoint    | `packages/frontend/src/app/api/ws-auth/route.ts`                           |
| Realtime hooks      | `packages/frontend/src/lib/use-realtime.ts`                                |
| Trace components    | `packages/frontend/src/components/trace/`                                  |
| Tool re-run modal   | `packages/frontend/src/components/trace/ToolRerunModal.tsx`                |
| Projects router     | `packages/backend/src/trpc/routers/projects.ts`                            |
| Members router      | `packages/backend/src/trpc/routers/members.ts`                             |
| Project store       | `packages/frontend/src/lib/project-store.ts`                               |
| Project layout      | `packages/frontend/src/app/(dashboard)/project/[projectId]/layout.tsx`     |
| Projects list       | `packages/frontend/src/app/(dashboard)/projects/page.tsx`                  |
| Tools page          | `packages/frontend/src/app/(dashboard)/project/[projectId]/tools/page.tsx` |

## Development Commands

```sh
pnpm dev              # Start all services (frontend + backend)
pnpm build            # Build all packages
pnpm typecheck        # TypeScript check all packages
pnpm test             # Run all tests
pnpm format           # Format all packages
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed demo data
pnpm db:studio        # Prisma Studio

# Per-package
pnpm --filter @lightrace/frontend dev    # Frontend only (port 3001)
pnpm --filter @lightrace/backend dev     # Backend only (port 3002)
```

## Technology Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Next.js 15 (App Router), shadcn/ui + Tailwind CSS v4
- **Backend**: Hono + tRPC v11 (fetch adapter + WebSocket subscriptions)
- **Auth**: Auth.js v5 (credentials provider, JWT strategy)
- **ORM**: Prisma 7 + PostgreSQL
- **Cache/PubSub**: Redis (ioredis)
- **Validation**: Zod v3
- **Testing**: Vitest
- **Formatting**: Prettier + ESLint
- **Git hooks**: Husky + lint-staged

## Database

- PostgreSQL on port 5435 (docker-compose)
- Redis on port 6379 (docker-compose)
- 9 models: User, Project, ApiKey, Trace, Observation, ToolRegistration, ProjectMembership, MembershipInvitation
- RBAC: ProjectMembership with roles (OWNER, ADMIN, MEMBER, VIEWER); all tRPC routers use `projectProcedure` for authorization
- Demo login: `demo@lightrace.dev` / `password`
- Demo API keys: `pk-lt-demo` / `sk-lt-demo`

## Environment Variables

Each package has its own `.env` file (copy from `.env.example` in each package directory):

**`packages/shared/.env`:**

```
DATABASE_URL    — Postgres connection string
REDIS_URL       — Redis connection string
```

**`packages/backend/.env`:**

```
DATABASE_URL    — Postgres connection string
REDIS_URL       — Redis connection string
PORT            — Backend HTTP port (default 3002)
WS_PORT         — Backend WebSocket port (default 3003)
INTERNAL_SECRET — Shared secret between frontend proxy and backend
```

**`packages/frontend/.env`:**

```
DATABASE_URL    — Postgres connection string
REDIS_URL       — Redis connection string
AUTH_SECRET     — Auth.js JWT secret
AUTH_URL        — Frontend URL for Auth.js
NEXTAUTH_URL    — Same as AUTH_URL
BACKEND_URL     — Backend URL (frontend uses this to proxy tRPC)
INTERNAL_SECRET — Shared secret between frontend proxy and backend
WS_PORT         — Backend WebSocket port (default 3003)
```

## Code Conventions

- Import from `zod` (Zod v3)
- Use App Router (not Pages Router)
- Tests go alongside source: `foo.ts` → `foo.test.ts`
- Use single params object for functions with multiple arguments
- Avoid `any` type
- Format on commit via lint-staged
- Shared code goes in `@lightrace/shared`, business logic in `@lightrace/backend`
