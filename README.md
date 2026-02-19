# Organizador Financeiro

Web application to help users organize their finances. Single user per deployment.

## Tech Stack

- **Backend**: Python (FastAPI, SQLAlchemy, Alembic)
- **Frontend**: React + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **Auth**: better-auth (frontend integration, backend session validation)
- **Database**: PostgreSQL 18
- **Dev**: Local PostgreSQL container via Docker Compose
- **Prod**: Docker containers

## Getting Started

### Prerequisites

- Python 3.10-3.13 (3.12 or 3.13 recommended; Python 3.14+ not yet supported by pydantic-core)
- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 18 (via Docker)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd organizador-financeiro
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start PostgreSQL and create databases**
   ```bash
   make createdb
   # Starts Docker container, creates organizador_financeiro and organizador_financeiro_test
   ```

4. **Set up backend**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

5. **Run database migrations**
   ```bash
   cd backend
   alembic upgrade head
   ```

6. **Start backend server**
   ```bash
   cd backend
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

7. **Set up frontend**
   ```bash
   cd frontend
   npm install
   ```

8. **Start frontend development server**
   ```bash
   cd frontend
   npm run dev
   ```

9. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Project Structure

```
organizador-financeiro/
├── backend/           # FastAPI backend
│   ├── app/          # Application code
│   │   ├── api/      # API routes
│   │   ├── services/ # Business logic
│   │   ├── models/   # SQLAlchemy models
│   │   └── db/       # Database setup
│   ├── alembic/      # Database migrations
│   └── requirements.txt
├── frontend/         # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── lib/
│   └── package.json
├── docker/           # Docker Compose configuration
└── docs/             # Documentation
```

## Development

### Backend

- Run migrations: `alembic revision --autogenerate -m "description"`
- Apply migrations: `alembic upgrade head`
- Run tests: `pytest` (when tests are added)

### Frontend

- Install dependencies: `npm install`
- Run dev server: `npm run dev`
- Build for production: `npm run build`
- Preview production build: `npm run preview`

## Production Deployment

Use Docker Compose production stack:

```bash
cp .env.example .env
# update secrets and ports in .env
make prod-build
make prod-up
```

Services:
- Frontend: `http://localhost:8080` (or `FRONTEND_PORT`)
- Backend: `http://localhost:8000` (or `BACKEND_PORT`)
- Postgres: internal container network

To stop:

```bash
make prod-down
```

Full deployment guide: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## Phase 1 Status

✅ Project structure (monorepo)
✅ Docker Compose for PostgreSQL
✅ Backend skeleton (FastAPI)
✅ Frontend skeleton (Vite + React + shadcn/ui + Tailwind)
✅ Alembic initialization
✅ better-auth integration structure (frontend-side, backend validation placeholder)
✅ Health/status endpoints

## Next Steps

See [docs/PLANNING.md](docs/PLANNING.md) for the development roadmap.

## Cursor / Agent Configuration

- **Base assumptions**: `.cursor/rules/repository-base-assumptions.mdc`
- **Agent instructions**: [AGENTS.md](AGENTS.md)
- **PostgreSQL troubleshooting**: `.cursor/skills/postgresql-troubleshoot/`
- **MCP config**: Copy `docs/mcp-config.example.json` to your Cursor MCP config and adjust the connection URL.
- **Test Agent**: The repository includes a custom test-agent subagent (via `mcp_task`) that can automatically run pytest test suites. The vitest-runner MCP server is available but not configured since this project uses pytest, not vitest.
