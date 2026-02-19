.PHONY: help setup-backend setup-frontend setup-db start-db stop-db migrate-up migrate-down start-backend start-frontend install

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup-backend: ## Set up backend Python environment
	cd backend && python -m venv .venv
	cd backend && .venv/bin/pip install -r requirements.txt

setup-frontend: ## Set up frontend dependencies
	cd frontend && npm install

setup-db: ## Start PostgreSQL database container
	docker-compose -f docker/docker-compose.yml up -d
	@echo "Waiting for database to be ready..."
	@sleep 5

start-db: ## Start PostgreSQL database
	docker-compose -f docker/docker-compose.yml up -d

stop-db: ## Stop PostgreSQL database
	docker-compose -f docker/docker-compose.yml stop

migrate-up: ## Run database migrations
	cd backend && alembic upgrade head

migrate-down: ## Rollback last migration
	cd backend && alembic downgrade -1

migrate-create: ## Create a new migration (usage: make migrate-create MESSAGE="description")
	cd backend && alembic revision --autogenerate -m "$(MESSAGE)"

test: ## Run all tests
	cd backend && pytest tests/ -v

test-unit: ## Run unit tests only
	cd backend && pytest tests/unit/ -v

test-integration: ## Run integration tests only
	cd backend && pytest tests/integration/ -v

test-coverage: ## Run tests with coverage report
	cd backend && pytest tests/ -v --cov=app --cov-report=term-missing --cov-report=html

start-backend: ## Start backend development server
	cd backend && python run.py

start-frontend: ## Start frontend development server
	cd frontend && npm run dev

install: setup-backend setup-frontend setup-db ## Full setup: backend, frontend, and database
	@echo "Setup complete! Run 'make start-backend' and 'make start-frontend' in separate terminals."
