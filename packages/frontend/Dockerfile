# Build from monorepo root: docker build -f packages/frontend/Dockerfile .
#
# ── Stage 1: base ────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

# ── Stage 2: install all deps ───────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/

RUN pnpm install --frozen-lockfile

# ── Stage 3: build ──────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/ ./
COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/
COPY packages/frontend/ packages/frontend/
COPY turbo.json ./

# Generate Prisma client, build backend (transpilePackages dep), build frontend
# Dummy env vars needed at build time for Next.js prerendering (overridden at runtime)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
    REDIS_URL="redis://localhost:6379" \
    AUTH_SECRET="build-time-placeholder" \
    AUTH_URL="http://localhost:3001" \
    BACKEND_URL="http://localhost:3002" \
    INTERNAL_SECRET="build-time-placeholder" \
    WS_PORT="3003"

RUN pnpm --filter @lightrace/shared db:generate && \
    pnpm --filter @lightrace/backend build && \
    pnpm --filter @lightrace/frontend build

# ── Stage 4: runtime ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

RUN addgroup --system --gid 1001 lightrace && \
    adduser --system --uid 1001 lightrace

# Next.js standalone output
COPY --from=builder /app/packages/frontend/.next/standalone ./
COPY --from=builder /app/packages/frontend/.next/static ./packages/frontend/.next/static
COPY --from=builder /app/packages/frontend/public ./packages/frontend/public

# Prisma client (needed at runtime for Auth.js + direct DB queries)
COPY --from=builder /app/node_modules/.pnpm/@prisma+client*/node_modules/.prisma /app/node_modules/.prisma

USER lightrace

EXPOSE 3001

CMD ["node", "packages/frontend/server.js"]
