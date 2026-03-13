# Contributing to Lightrace

Thank you for your interest in contributing to Lightrace! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/your-org/lightrace.git
cd lightrace

# Start PostgreSQL
docker compose up -d

# Install dependencies
pnpm install

# Create database and run migrations
pnpm db:migrate

# Seed demo data
pnpm db:seed

# Start development server
pnpm dev
```

Open http://localhost:3001 and login with `demo@lightrace.dev` / `password`.

### SDK Testing

```python
from langfuse import Langfuse

langfuse = Langfuse(
    public_key="pk-lt-demo",
    secret_key="sk-lt-demo",
    host="http://localhost:3001"
)

trace = langfuse.trace(name="test")
trace.generation(name="llm-call", model="gpt-4", input="hello", output="world")
langfuse.flush()
```

## Development Commands

```bash
pnpm dev              # Start dev server (port 3000)
pnpm build            # Production build
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix ESLint issues
pnpm format           # Format code with Prettier
pnpm format:check     # Check formatting
pnpm typecheck        # TypeScript type checking
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Run tests with coverage
pnpm db:migrate       # Run database migrations
pnpm db:seed          # Seed database
pnpm db:reset         # Reset database
pnpm db:studio        # Open Prisma Studio
```

## Project Structure

```
src/
├── app/                    # Next.js 15 App Router pages
│   ├── (dashboard)/        # Authenticated pages (traces, settings)
│   ├── api/                # API routes
│   │   ├── public/         # Langfuse SDK-compatible endpoints
│   │   ├── auth/           # Auth.js routes
│   │   └── trpc/           # tRPC endpoint
│   └── login/              # Login page
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Layout components (Sidebar)
│   └── trace/              # Trace viewer components
├── features/
│   └── ingestion/          # SDK ingestion (schemas, auth, processing)
├── server/
│   ├── api/                # tRPC routers
│   ├── auth.ts             # Auth.js config
│   └── db.ts               # Prisma client
└── lib/                    # Utilities (cn, trpc client)
```

## Code Quality

### Git Hooks (Husky)

- **Pre-commit**: Runs lint-staged (Prettier + ESLint on staged files)
- **Pre-push**: Runs TypeScript type checking

### Code Style

- **Prettier** for formatting (100 char width, trailing commas)
- **ESLint** for linting (Next.js + TypeScript rules)
- Format on save is configured in `.vscode/settings.json`

### Testing

We use **Vitest** for unit and integration tests.

```bash
# Run all tests
pnpm test

# Run a specific test file
pnpm vitest run src/features/ingestion/schemas.test.ts

# Run tests matching a name
pnpm vitest run -t "should validate a trace-create"
```

**Test patterns:**

- Unit tests go alongside source files: `foo.ts` → `foo.test.ts`
- Each test should be independent — no shared state between tests
- Use `vi.mock()` for external dependencies
- Use `vi.clearAllMocks()` in `beforeEach`

### TypeScript

- Avoid `any` type when possible
- Use a single params object for functions with multiple arguments

## Pull Requests

1. Fork the repo and create a feature branch
2. Write tests for new functionality
3. Ensure `pnpm test`, `pnpm lint`, and `pnpm typecheck` pass
4. Submit a PR with a clear description of changes

## Architecture Notes

- **Single process**: No separate worker. Ingestion is synchronous.
- **Langfuse SDK compatible**: The `POST /api/public/ingestion` endpoint matches Langfuse's format.
- **5 database models**: User, Project, ApiKey, Trace, Observation, Score
- **3 tRPC routers**: traces, observations, settings

## License

MIT — see [LICENSE](LICENSE).
