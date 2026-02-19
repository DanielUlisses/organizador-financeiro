# Organizador Financeiro — Agent Instructions

## General Development

- Follow conventions in `.cursor/rules/repository-base-assumptions.mdc`
- Prefer existing patterns in the codebase when adding features
- Run migrations with Alembic before testing database-dependent features

## Test Agent

When a feature is considered complete, the **Test Agent** workflow applies:

1. **Run tests**: Execute the full test suite (backend + frontend)
2. **Report results**: Summarize passes, failures, and coverage gaps
3. **Suggest MCP**: Recommend MCP (Model Context Protocol) servers that enable tests on-the-fly during development

### MCP Suggestions for Test-Driven Development

Configure these MCP servers in Cursor settings (`~/.cursor/mcp.json` or project `.cursor/mcp.json`) for tests on-the-fly:

**PostgreSQL MCP** — schema inspection, read-only queries, troubleshooting:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/organizador_financeiro"]
    }
  }
}
```

Replace connection URL with `DATABASE_URL` from `.env` when available. Use `postgresql-troubleshoot` skill when working with database issues.

**Other useful MCP servers**:
- Test runners (pytest/vitest) if available for your stack
- Linters (ruff/ESLint) for immediate feedback during edits

When suggesting MCP, prefer tools that integrate with Python, React, and PostgreSQL.

## PostgreSQL Troubleshooting

When debugging database issues, schema problems, or data validation:

1. Use the **postgresql-troubleshoot** skill
2. Connect to the local PostgreSQL container using project env vars
3. Run diagnostic queries, inspect schema, validate migrations
