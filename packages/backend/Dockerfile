# Build from monorepo root: docker build -f packages/backend/Dockerfile .
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
COPY turbo.json ./

# Generate Prisma client + build backend (tsup CJS → dist/index.cjs)
RUN pnpm --filter @lightrace/shared db:generate && \
    pnpm --filter @lightrace/backend build

# Create slim production deployment
RUN pnpm --filter @lightrace/backend deploy --prod --legacy /deploy

# Copy Prisma generated client into the deployment
RUN PRISMA_DIR=$(find /app/node_modules -path "*/.prisma/client" -type d | head -1) && \
    mkdir -p /deploy/node_modules/.prisma && \
    cp -r "$PRISMA_DIR" /deploy/node_modules/.prisma/

# ── Stage 3b: migrator (run once via docker-compose migrate service) ──
FROM base AS migrator
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
CMD ["pnpm", "--filter", "@lightrace/shared", "exec", "prisma", "migrate", "deploy", "--schema", "./prisma/schema.prisma"]

# ── Stage 4: runtime ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 lightrace && \
    adduser --system --uid 1001 lightrace

COPY --from=builder --chown=lightrace:lightrace /deploy ./

USER lightrace

EXPOSE 3002 3003

CMD ["node", "dist/index.cjs"]
