.DEFAULT_GOAL := dev

.PHONY: dev install build test lint format format-check typecheck \
        db-generate db-migrate db-seed db-reset db-studio \
        up down infra logs clean help

## Development ----------------------------------------------------------------

dev: ## Start infra, install deps, and run dev servers
	docker compose up -d postgres redis
	pnpm install
	pnpm dev

install: ## Install dependencies
	pnpm install

build: ## Build all packages
	pnpm build

## Quality ---------------------------------------------------------------------

test: ## Run all tests
	pnpm test

lint: ## Lint all packages
	pnpm lint

format: ## Format code with Prettier
	pnpm format

format-check: ## Check code formatting
	pnpm format:check

typecheck: ## TypeScript type checking
	pnpm typecheck

## Database --------------------------------------------------------------------

db-generate: ## Generate Prisma client
	pnpm db:generate

db-migrate: ## Run Prisma migrations
	pnpm db:migrate

db-seed: ## Seed demo data
	pnpm db:seed

db-reset: ## Reset database
	pnpm db:reset

db-studio: ## Open Prisma Studio
	pnpm db:studio

## Docker ----------------------------------------------------------------------

up: ## Start all Docker services
	docker compose up -d

down: ## Stop all Docker services
	docker compose down

infra: ## Start only postgres and redis
	docker compose up -d postgres redis

logs: ## Tail Docker service logs
	docker compose logs -f

## Maintenance -----------------------------------------------------------------

clean: ## Remove build artifacts and node_modules
	rm -rf node_modules packages/*/node_modules
	rm -rf packages/frontend/.next
	rm -rf packages/backend/dist
	rm -rf .turbo packages/*/.turbo

## Help ------------------------------------------------------------------------

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
