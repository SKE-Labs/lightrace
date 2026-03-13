# Lightrace

Lightweight, open-source LLM tracing tool for local development. Drop-in compatible with the [Langfuse](https://langfuse.com) Python/JS SDKs.

## Features

- Langfuse SDK compatible ingestion (`POST /api/public/ingestion`)
- Trace and observation viewer with token usage breakdown
- Single Next.js app + PostgreSQL (2 containers total)
- Auth via credentials (Auth.js v5)

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) 10+
- [Docker](https://www.docker.com)

### Setup

```sh
# Start PostgreSQL
docker compose up -d

# Install dependencies
pnpm install

# Run migrations and seed demo data
pnpm db:migrate
pnpm db:seed

# Start dev server (port 3001)
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) and log in with the demo credentials:

- **Email:** `demo@lightrace.dev`
- **Password:** `password`

### SDK Configuration

Point any Langfuse SDK at Lightrace:

```python
# Python
from langfuse import Langfuse

langfuse = Langfuse(
    public_key="pk-lt-demo",
    secret_key="sk-lt-demo",
    host="http://localhost:3001",
)
```

```typescript
// TypeScript
import Langfuse from "langfuse";

const langfuse = new Langfuse({
  publicKey: "pk-lt-demo",
  secretKey: "sk-lt-demo",
  baseUrl: "http://localhost:3001",
});
```

## Scripts

| Command           | Description             |
| ----------------- | ----------------------- |
| `pnpm dev`        | Start dev server (3001) |
| `pnpm build`      | Production build        |
| `pnpm test`       | Run tests (Vitest)      |
| `pnpm lint`       | ESLint                  |
| `pnpm format`     | Prettier                |
| `pnpm typecheck`  | TypeScript check        |
| `pnpm db:migrate` | Run Prisma migrations   |
| `pnpm db:seed`    | Seed demo data          |
| `pnpm db:studio`  | Open Prisma Studio      |

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **UI:** shadcn/ui + Tailwind CSS v4
- **API:** tRPC v11 + REST (ingestion)
- **Auth:** Auth.js v5 (credentials provider)
- **ORM:** Prisma 6 + PostgreSQL
- **Validation:** Zod
- **Testing:** Vitest

## License

MIT
