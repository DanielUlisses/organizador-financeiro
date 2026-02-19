# MCP Test Configuration

## Overview

This repository uses **pytest** for Python backend testing, not vitest (which is for JavaScript/TypeScript). The available test MCP servers and agents are:

1. **vitest-runner MCP** - Available but not applicable (for JS/TS projects)
2. **test-agent subagent** - Available via `mcp_task` tool, designed for this repository
3. **pytest MCP server** - Can be configured (optional)

## Why vitest-runner MCP is Not Used

The `vitest-runner` MCP server is available in Cursor but is **not configured** in this repository because:

- This project uses **pytest** (Python), not **vitest** (JavaScript/TypeScript)
- The vitest-runner MCP is designed for frontend JavaScript/TypeScript projects
- Our backend tests are written in Python using pytest

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

### 2. Pytest MCP Server (Optional)

A pytest MCP server (`@kieranlal/mcp_pytest_service`) can be configured to provide pytest integration. This is **optional** and has been added to `docs/mcp-config.example.json`.

**To enable:**
1. Copy `docs/mcp-config.example.json` to your Cursor MCP config location
2. The pytest server will be available if configured

**Note:** The test-agent subagent is usually sufficient for most use cases.

## Current Test Setup

The repository uses:

- **pytest** for Python backend tests
- **Test database**: `organizador_financeiro_test`
- **Test commands**: Available via Makefile (`make test`, `make test-unit`, `make test-integration`, `make test-coverage`)

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

- ✅ **test-agent subagent**: Available and recommended for this repository
- ❌ **vitest-runner MCP**: Not applicable (wrong test framework)
- ⚙️ **pytest MCP server**: Optional, can be configured if needed
- 📝 **Manual pytest**: Always available via `make test` commands

The test-agent is the primary automated testing tool for this repository and should be used proactively when features are complete.
