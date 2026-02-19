# Deployment Guide

## Overview

Phase 6 introduces a production-ready Docker deployment with:
- `frontend` (Nginx static hosting + `/api` reverse proxy)
- `backend` (FastAPI + Alembic migration on startup)
- `postgres` (PostgreSQL 18)

## Prerequisites

- Docker
- Docker Compose

## 1. Configure environment

```bash
cp .env.example .env
```

Recommended production changes in `.env`:
- `POSTGRES_PASSWORD`
- `AUTH_SECRET`
- `ENVIRONMENT=production`
- `BACKEND_RELOAD=false`
- `UVICORN_WORKERS=2` (or higher depending on CPU)

## 2. Build and start

```bash
make prod-build
make prod-up
```

## 3. Verify

- Frontend: `http://localhost:8080`
- Backend docs: `http://localhost:8000/docs`
- API from frontend is proxied through `/api`

## 4. Logs and shutdown

```bash
make prod-logs
make prod-down
```

## Notes

- Backend container runs `alembic upgrade head` before starting Uvicorn.
- Frontend image is built with `VITE_API_URL=/api` for same-origin API calls.
- If deploying behind a public reverse proxy, expose only frontend port and keep backend internal.
