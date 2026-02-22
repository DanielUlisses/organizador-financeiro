"""FastAPI application entry point"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import get_settings
from app.api.routes import health, auth

settings = get_settings()

app = FastAPI(
    title="Organizador Financeiro API",
    description="Personal finance management application",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(health.router)
app.include_router(auth.router)

# Import and include domain routes
from app.api.routes import (
    users,
    bank_accounts,
    credit_cards,
    investment_accounts,
    payments,
    reports,
    transaction_metadata,
    import_export,
)

app.include_router(users.router)
app.include_router(bank_accounts.router)
app.include_router(credit_cards.router)
app.include_router(investment_accounts.router)
app.include_router(payments.router)
app.include_router(reports.router)
app.include_router(transaction_metadata.router)
app.include_router(import_export.router)

# Note: better-auth will be integrated on the frontend side
# Backend will validate sessions via cookies/JWT tokens
# See app/api/routes/auth.py for session validation endpoints

# Serve uploaded user files from mounted external storage.
uploads_dir = Path(settings.uploads_dir)
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount(settings.uploads_public_base_url, StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Organizador Financeiro API",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/config")
async def public_config():
    """Public config for the frontend (no auth). Used at runtime so Docker/production does not need VITE_* build args."""
    return {
        "googleClientId": settings.auth_google_client_id or "",
    }
