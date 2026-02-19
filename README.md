# Organizador Financeiro

Web application to help users organize their finances. Single user per deployment.

## Tech Stack

- **Backend**: Python (SQLAlchemy, Alembic)
- **Frontend**: React + shadcn/ui + Tailwind CSS
- **Auth**: better-auth
- **Database**: PostgreSQL 18
- **Dev**: Local PostgreSQL container
- **Prod**: Docker containers

## Getting Started

*Skeleton setup in progress. See [docs/PLANNING.md](docs/PLANNING.md) for the development roadmap.*

## Cursor / Agent Configuration

- **Base assumptions**: `.cursor/rules/repository-base-assumptions.mdc`
- **Agent instructions**: [AGENTS.md](AGENTS.md)
- **PostgreSQL troubleshooting**: `.cursor/skills/postgresql-troubleshoot/`
- **MCP config**: Copy `docs/mcp-config.example.json` to your Cursor MCP config and adjust the connection URL.
