.PHONY: help setup-backend setup-frontend setup-db start-db stop-db createdb migrate-up migrate-down seed start-backend start-frontend install prod-build prod-up prod-down prod-logs

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup-backend: ## Set up backend Python environment
	@echo "Checking Python version..."
	@python3 --version | grep -E "Python 3\.(10|11|12|13)" || (echo "ERROR: Python 3.10-3.13 required. Python 3.14+ not supported by pydantic-core." && exit 1)
	cd backend && python3 -m venv .venv
	cd backend && .venv/bin/pip install --upgrade pip setuptools wheel
	cd backend && .venv/bin/pip install -r requirements.txt

setup-frontend: ## Set up frontend dependencies
	cd frontend && npm install

setup-db: createdb ## Alias for createdb

start-db: ## Start PostgreSQL container (does not create databases)
	docker-compose -f docker/docker-compose.yml up -d
	@echo "Waiting for PostgreSQL to be ready..."
	@until docker exec organizador-financeiro-db pg_isready -U postgres 2>/dev/null; do sleep 1; done

createdb: ## Start PostgreSQL Docker container and create databases
	docker-compose -f docker/docker-compose.yml up -d
	@echo "Waiting for PostgreSQL to be ready..."
	@until docker exec organizador-financeiro-db pg_isready -U postgres 2>/dev/null; do sleep 1; done
	@echo "Creating databases if they don't exist..."
	@docker exec organizador-financeiro-db psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'organizador_financeiro'" | grep -q 1 || \
		docker exec organizador-financeiro-db psql -U postgres -c "CREATE DATABASE organizador_financeiro;"
	@docker exec organizador-financeiro-db psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'organizador_financeiro_test'" | grep -q 1 || \
		docker exec organizador-financeiro-db psql -U postgres -c "CREATE DATABASE organizador_financeiro_test;"
	@echo "Databases ready: organizador_financeiro, organizador_financeiro_test"

stop-db: ## Stop PostgreSQL database
	docker-compose -f docker/docker-compose.yml stop

clean-db: ## Stop and remove PostgreSQL container and volumes (WARNING: deletes all data)
	docker-compose -f docker/docker-compose.yml down -v
	@echo "PostgreSQL container and volumes removed. Run 'make createdb' to start fresh."

migrate-up: ## Run database migrations
	cd backend && alembic upgrade head

seed: ## Create default user if none exist (run after migrate-up)
	cd backend && .venv/bin/python scripts/seed_default_user.py

migrate-down: ## Rollback last migration
	cd backend && alembic downgrade -1

migrate-create: ## Create a new migration (usage: make migrate-create MESSAGE="description")
	cd backend && alembic revision --autogenerate -m "$(MESSAGE)"

test: clean-test-db ## Run all tests (cleans locks first)
	@echo "Checking test database connection..."
	@docker exec organizador-financeiro-db pg_isready -U postgres -d organizador_financeiro_test >/dev/null 2>&1 || \
		(echo "ERROR: Test database not accessible. Run 'make createdb' first." && exit 1)
	cd backend && pytest tests/ -v --tb=short

test-unit: clean-test-db ## Run unit tests only (cleans locks first)
	@echo "Checking test database connection..."
	@docker exec organizador-financeiro-db pg_isready -U postgres -d organizador_financeiro_test >/dev/null 2>&1 || \
		(echo "ERROR: Test database not accessible. Run 'make createdb' first." && exit 1)
	cd backend && pytest tests/unit/ -v --tb=short

test-integration: clean-test-db ## Run integration tests only (cleans locks first)
	@echo "Checking test database connection..."
	@docker exec organizador-financeiro-db pg_isready -U postgres -d organizador_financeiro_test >/dev/null 2>&1 || \
		(echo "ERROR: Test database not accessible. Run 'make createdb' first." && exit 1)
	cd backend && pytest tests/integration/ -v --tb=short

test-coverage: clean-test-db ## Run tests with coverage report (cleans locks first)
	@echo "Checking test database connection..."
	@docker exec organizador-financeiro-db pg_isready -U postgres -d organizador_financeiro_test >/dev/null 2>&1 || \
		(echo "ERROR: Test database not accessible. Run 'make createdb' first." && exit 1)
	cd backend && pytest tests/ -v --cov=app --cov-report=term-missing --cov-report=html --tb=short

clean-test-db: ## Clean up stuck locks and connections in test database
	@echo "Cleaning up test database locks..."
	@docker exec organizador-financeiro-db psql -U postgres -d organizador_financeiro_test -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'organizador_financeiro_test' AND pid <> pg_backend_pid();" || true
	@echo "Test database cleaned up."

start-backend: ## Start backend development server
	cd backend && python run.py

start-frontend: ## Start frontend development server
	cd frontend && npm run dev

install: setup-backend setup-frontend setup-db ## Full setup: backend, frontend, and database
	@echo "Setup complete! Run 'make start-backend' and 'make start-frontend' in separate terminals."

prod-build: ## Build production Docker images
	docker-compose -f docker/docker-compose.prod.yml build

prod-up: ## Start production stack (frontend, backend, postgres)
	docker-compose -f docker/docker-compose.prod.yml up -d

prod-down: ## Stop production stack
	docker-compose -f docker/docker-compose.prod.yml down

prod-logs: ## Tail production stack logs
	docker-compose -f docker/docker-compose.prod.yml logs -f
