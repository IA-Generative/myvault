.PHONY: dev dev-backend dev-frontend test test-backend test-frontend lint build clean docker-up docker-down

# --- Development ---
dev: docker-up ## Start all services locally
	@echo "MyVault running at http://localhost:8080"

dev-backend: ## Start backend only
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Start frontend only
	cd frontend && npm run dev

# --- Testing ---
test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests
	cd backend && python -m pytest app/tests/ -v --cov=app

test-frontend: ## Run frontend tests
	cd frontend && npm test

test-e2e: ## Run end-to-end tests
	cd tests/e2e && python -m pytest -v

test-load: ## Run load tests
	cd tests/load && locust -f locustfile.py --headless -u 100 -r 10 -t 60s

# --- Linting ---
lint: lint-backend lint-frontend ## Lint all code

lint-backend: ## Lint backend
	cd backend && ruff check app/ && ruff format --check app/ && mypy app/

lint-frontend: ## Lint frontend
	cd frontend && npm run lint

# --- Build ---
build: ## Build Docker images
	docker compose -f deploy/docker/docker-compose.yml build

# --- Docker ---
docker-up: ## Start services with Docker Compose
	docker compose -f deploy/docker/docker-compose.yml up -d

docker-down: ## Stop Docker services
	docker compose -f deploy/docker/docker-compose.yml down

docker-logs: ## View Docker logs
	docker compose -f deploy/docker/docker-compose.yml logs -f

# --- Database ---
db-migrate: ## Run database migrations
	cd backend && alembic upgrade head

db-revision: ## Create a new migration (usage: make db-revision MSG="description")
	cd backend && alembic revision --autogenerate -m "$(MSG)"

db-downgrade: ## Rollback last migration
	cd backend && alembic downgrade -1

# --- SDK ---
sdk-build: ## Build Python SDK
	cd sdk && pip install -e .

# --- Clean ---
clean: ## Clean generated files
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
	rm -rf frontend/dist frontend/build

# --- Help ---
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
