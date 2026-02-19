# MCP Test Configuration

## Overview

This repository uses:

- **pytest** for backend (Python)
- **vitest** for frontend (React/TypeScript)

The available automated validation tools are:

1. **user-vitest-runner MCP tools** for frontend tests/coverage
2. **user-eslint-lint-files MCP tool** for frontend lint validation
3. **test-agent subagent** for phase-level validation
4. **pytest MCP server** (optional) for backend-focused test workflows

## Available Test Tools

### 1. Test-Agent Subagent (Recommended)

The repository has a custom **test-agent** subagent that can be invoked via the `mcp_task` tool:

```python
# The agent can automatically run tests when features are complete
mcp_task(
    subagent_type="test-agent",
    description="Run full test suite",
    prompt="Run all pytest tests and report coverage"
)
```

**When to use:**
- After completing a feature or phase
- When you want comprehensive test execution with coverage
- For test-driven development workflows

**Features:**
- Runs full test suites (backend + frontend)
- Reports results with coverage
- Suggests MCP servers for test-driven development
- Proactively runs tests when features are considered complete

### 2. Frontend MCP Tools (Vitest + ESLint)

If `user-vitest-runner-run-vitest` fails with:

- `Project directory does not exist: /Users/<your-username>/path/to/your/project/root`

you need to update the MCP server config with the real project path.

Required values for this repository:

- **Project root:** `/home/daniel/repos/daniel/organizador-financeiro`
- **Frontend working directory:** `/home/daniel/repos/daniel/organizador-financeiro/frontend`
- **ESLint config file:** `/home/daniel/repos/daniel/organizador-financeiro/frontend/.eslintrc.cjs`

Recommended checks after updating config:

1. `user-vitest-runner-ping`
2. `user-vitest-runner-run-vitest`
3. `user-vitest-runner-run-vitest-coverage`
4. `user-eslint-lint-files` with changed frontend files

If `user-eslint-lint-files` says `Could not find config file`, point it to the frontend directory/config above.

### 3. Pytest MCP Server (Optional)

A pytest MCP server (`@kieranlal/mcp_pytest_service`) can be configured to provide pytest integration. This is **optional** and has been added to `docs/mcp-config.example.json`.

**To enable:**
1. Copy `docs/mcp-config.example.json` to your Cursor MCP config location
2. The pytest server will be available if configured

**Note:** The test-agent subagent is usually sufficient for most use cases.

## Current Test Setup

The repository uses:

- **pytest** backend tests (`make test`, `make test-unit`, `make test-integration`, `make test-coverage`)
- **vitest** frontend tests (`npm run test`, `npm run test:coverage` in `frontend/`)
- **eslint** frontend lint checks (`npm run lint` in `frontend/`)
- **Test database**: `organizador_financeiro_test`

## Why Test-Agent Isn't Always Used

The test-agent subagent is designed to be **proactive** but may not be invoked automatically in all scenarios:

1. **Manual invocation**: It requires explicit use of `mcp_task` with `subagent_type="test-agent"`
2. **Feature completion**: It's designed to run when features are "considered complete"
3. **Agent discretion**: The main agent decides when to invoke it based on context

## How to Use Test-Agent

To explicitly use the test-agent:

```python
# The agent should invoke this when appropriate
mcp_task(
    subagent_type="test-agent",
    description="Run tests",
    prompt="Run pytest tests for the payment models and services"
)
```

Or simply ask: "Run the test suite" or "Run tests with coverage"

## Summary

- ✅ **test-agent subagent**: Available and recommended for phase validation
- ✅ **user-vitest-runner MCP**: Applicable for frontend tests
- ✅ **user-eslint-lint-files**: Applicable for frontend lint checks
- ⚙️ **pytest MCP server**: Optional, can be configured if needed
- 📝 **Manual commands**: Always available if MCP path/config is temporarily broken

The test-agent is the primary automated testing tool for this repository and should be used proactively when features are complete.
