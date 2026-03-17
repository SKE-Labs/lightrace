# Changelog

All notable changes to this project will be documented in this file.

## [0.1.2] - 2026-03-17

### Performance

- **Denormalized trace aggregates**: Pre-computed `totalTokens`, `totalCost`, `latencyMs`, `primaryModel`, `observationCount`, and `level` directly on the Trace model — eliminates observation JOINs from the trace list query
- **Database indexes**: Added composite indexes `(projectId, level, timestamp)`, `(projectId, userId)` on traces and `(traceId, type)`, `(traceId, level)` on observations for faster aggregate computation and filtered queries
- **Batched ingestion**: Wrapped event batch processing in `$transaction` for single-commit writes; replaced `findUnique` + `create` with single `upsert` in `ensureTraceExists`
- **Trace list query optimization**: Replaced observation JOIN + in-memory aggregation with `select`-only query on denormalized trace columns — reduces data fetched per page from ~2,500 rows to ~20

### Added

- **Trace list pagination**: Replaced infinite scroll "Load more" with proper offset-based pagination — page numbers, prev/next controls, "Showing X-Y of Z traces" indicator (20 traces per page)
- **Tool rerun sheet**: Converted tool re-run from cramped dialog to full-height right-side Sheet panel with Postman-style key-value editor, Table/Raw JSON toggle, inline validation, side-by-side result comparison, and context tooltip
- **Message display improvements** (FormattedView):
  - LangGraph role normalization (`human` → `user`, `ai` → `assistant`) for proper markdown rendering
  - Double-nested array unwrapping (`[[...messages...]]`) for LangGraph GENERATION inputs
  - "State" label for non-message wrapper fields (todos, memory_contents, skills_metadata)
  - Collapsible thinking/reasoning blocks with Brain icon and amber styling
  - Inline image rendering for `image_url` and base64 `image` content blocks
  - Tool call → tool result grouping (results nested under their corresponding tool calls)
  - Expand all / Collapse all toggle for message lists
- **Sheet UI component** (`components/ui/sheet.tsx`) — right-side slide-in panel using `@base-ui/react/dialog`

### Changed

- Trace list page size reduced from 50 to 20 traces per page
- Tool rerun results now use `FormattedView` instead of raw `JsonViewer` for consistency

## [0.1.1] - 2026-03-14

### Changed

- **Monorepo architecture**: Restructured from a single Next.js app into a Turborepo monorepo with three packages:
  - `@lightrace/shared` — Prisma schema, database client, Redis client, Zod schemas, API key auth, shared utilities
  - `@lightrace/backend` — Standalone Hono server with tRPC (fetch adapter), REST ingestion, and OTel endpoints
  - `@lightrace/frontend` — Next.js 15 app (UI + Auth.js only), proxies tRPC calls to the backend
- **Backend server**: Migrated from Next.js API routes to a standalone Hono server (port 3002)
- **Frontend tRPC proxy**: `/api/trpc` now proxies requests to the backend with internal auth headers instead of handling tRPC directly
- **SDK ingestion endpoint**: Now served by the backend on port 3002 (was port 3001 via Next.js)
- **Real-time trace updates**: Replaced 2-3 second polling with WebSocket-based real-time updates
  - Backend publishes trace events to Redis Pub/Sub after ingestion
  - tRPC subscription router (`realtime.onTraceUpdate`) bridges Redis events to WebSocket clients
  - Frontend subscribes via `wsLink` (split from HTTP queries via `splitLink`)
  - Polling reduced to 30s fallback (was 2-3s), WebSocket pushes instant updates
  - Graceful degradation: if Redis is down, ingestion still works, UI falls back to polling

### Added

- **Redis** as infrastructure dependency (docker-compose), with ioredis client in shared package
- **WebSocket server** on port 3003 for tRPC subscriptions (`ws` + `@trpc/server/adapters/ws`)
- **Redis Pub/Sub** for broadcasting trace update events across backend instances
- **WS auth endpoint** (`GET /api/ws-auth`) returns authenticated WebSocket URL with internal secret
- **Internal auth** between frontend and backend via shared secret (`INTERNAL_SECRET` env var)
- **Turborepo** for orchestrating builds, typechecks, and dev across packages
- **Health check** endpoint at `GET /health` on the backend
- `BACKEND_URL`, `INTERNAL_SECRET`, `REDIS_URL`, `PORT`, `WS_PORT` environment variables

### Fixed

- **Langfuse v4 compatibility**: OTel protobuf import converted from CommonJS `require()` to ESM `import` — fixes `ReferenceError: require is not defined` in the OTel ingestion route
- **tRPC proxy**: Frontend `/api/trpc` proxy now reads the full response body before forwarding — fixes `Unexpected end of JSON input` errors from streamed responses

### Infrastructure

- docker-compose now includes Redis 7 alongside PostgreSQL 16
- Prisma schema and migrations moved to `packages/shared/prisma/`
- `.env` symlinks from packages to workspace root for Prisma and runtime access

## [0.1.0] - 2026-03-08

### Added

- Initial release
- Langfuse SDK compatible trace ingestion (`POST /api/public/ingestion`)
- OpenTelemetry trace ingestion with protobuf support (`POST /api/public/otel/v1/traces`)
- Trace list with infinite scroll, search, and live polling
- Trace detail view with observation tree (spans, generations, events)
- Observation detail panel with I/O, metadata, usage, and scores tabs
- JSON viewer with syntax highlighting and expand/collapse
- API key management (create, list, delete)
- Auth.js v5 with credentials provider
- Demo seed data (user, project, API keys)
- PostgreSQL database with 6 models (User, Project, ApiKey, Trace, Observation, Score)
