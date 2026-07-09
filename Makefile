.PHONY: install dev test lint build clean help

# Resolve pnpm — try known install locations, fall back to plain 'pnpm' (relies on PATH)
PNPM := $(firstword $(wildcard $(HOME)/.local/share/pnpm/pnpm $(HOME)/.pnpm/pnpm /usr/local/bin/pnpm /usr/bin/pnpm) pnpm)

# ─────────────────────────────────────────────────────────────
# Default target
# ─────────────────────────────────────────────────────────────
help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

# ─────────────────────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────────────────────
install: ## Install dependencies for backend and frontend
	$(PNPM) --dir backend install
	$(PNPM) --dir frontend install

# ─────────────────────────────────────────────────────────────
# Development
# ─────────────────────────────────────────────────────────────
dev: ## Start Memgraph + backend + frontend dev servers (Ctrl+C stops all)
	@echo "Starting Memgraph..."
	@docker compose up -d memgraph
	@echo "Starting backend (port 3000) and frontend (port 5173)..."
	@trap 'kill 0' INT; \
		(cd backend && $(PNPM) dev) & \
		(cd frontend && $(PNPM) dev) & \
		wait

dev-backend: ## Start backend dev server only (requires Memgraph running)
	cd backend && $(PNPM) dev

dev-frontend: ## Start frontend dev server only
	cd frontend && $(PNPM) dev

# ─────────────────────────────────────────────────────────────
# Testing
# ─────────────────────────────────────────────────────────────
test: ## Run all tests once (backend + frontend)
	$(PNPM) --dir backend vitest run
	$(PNPM) --dir frontend vitest run

test-watch: ## Run all tests in watch mode (backend + frontend in parallel)
	@trap 'kill 0' INT; \
		(cd backend && $(PNPM) test) & \
		(cd frontend && $(PNPM) test) & \
		wait

test-coverage: ## Run tests with coverage report (backend + frontend)
	$(PNPM) --dir backend test:coverage
	$(PNPM) --dir frontend test:coverage

# ─────────────────────────────────────────────────────────────
# Code quality
# ─────────────────────────────────────────────────────────────
lint: ## Type-check backend and frontend (tsc --noEmit)
	$(PNPM) --dir backend lint
	$(PNPM) --dir frontend lint

check: lint test ## Full pre-commit check (lint + tests)

# ─────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────
build: ## Compile backend TypeScript and build frontend bundle
	$(PNPM) --dir backend build
	$(PNPM) --dir frontend build

# ─────────────────────────────────────────────────────────────
# Cleanup
# ─────────────────────────────────────────────────────────────
clean: ## Remove build artifacts and node_modules from both workspaces
	rm -rf backend/dist backend/node_modules backend/allure-results
	rm -rf frontend/dist frontend/node_modules frontend/allure-results
