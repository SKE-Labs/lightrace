# CLAUDE.md

## Project Overview

Lighttrace is a lightweight, open-source LLM tracing tool for local development. It is compatible with the Langfuse Python/JS SDKs and provides a simple UI for viewing traces, observations, and token usage.

## Architecture

- **Single Next.js 15 App Router application** + PostgreSQL (2 containers total)
- **No worker process** — ingestion is synchronous
- **Langfuse SDK compatible** — `POST /api/public/ingestion` with Basic Auth

## Key Files

| Purpose           | Path                                          |
| ----------------- | --------------------------------------------- |
| Prisma schema     | `prisma/schema.prisma`                        |
| Ingestion API     | `src/app/api/public/ingestion/route.ts`       |
| Ingestion schemas | `src/features/ingestion/schemas.ts`           |
| API auth          | `src/features/ingestion/apiAuth.ts`           |
| Event processing  | `src/features/ingestion/processEventBatch.ts` |
| tRPC root router  | `src/server/api/root.ts`                      |
| tRPC context      | `src/server/api/trpc.ts`                      |
| Auth config       | `src/server/auth.ts`                          |
| DB client         | `src/server/db.ts`                            |
| Trace components  | `src/components/trace/`                       |

## Development Commands

```sh
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm test             # Run vitest
pnpm test:watch       # Watch mode
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm typecheck        # TypeScript check
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed demo data
pnpm db:studio        # Prisma Studio
```

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: shadcn/ui + Tailwind CSS v4
- **API**: tRPC v11 + REST (ingestion)
- **Auth**: Auth.js v5 (credentials provider)
- **ORM**: Prisma 6 + PostgreSQL
- **Validation**: Zod v3
- **Testing**: Vitest
- **Formatting**: Prettier + ESLint
- **Git hooks**: Husky + lint-staged

## Database

- PostgreSQL on port 5435 (docker-compose)
- 5 models: User, Project, ApiKey, Trace, Observation, Score
- Demo login: `demo@lighttrace.dev` / `password`
- Demo API keys: `pk-lt-demo` / `sk-lt-demo`

## Code Conventions

- Import from `zod` (Zod v3)
- Use App Router (not Pages Router)
- Tests go alongside source: `foo.ts` → `foo.test.ts`
- Use single params object for functions with multiple arguments
- Avoid `any` type
- Format on commit via lint-staged

## Testing

- **Vitest** for all tests
- Test files: `*.test.ts` alongside source files
- Mocking: use `vi.mock()` and `vi.clearAllMocks()` in beforeEach
- Tests must be independent (no shared state between tests)
- Run: `pnpm test` or `pnpm vitest run path/to/file.test.ts`
