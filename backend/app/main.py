"""FastAPI application entry point"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
from app.api.routes import users, bank_accounts, credit_cards, investment_accounts, payments, reports

app.include_router(users.router)
app.include_router(bank_accounts.router)
app.include_router(credit_cards.router)
app.include_router(investment_accounts.router)
app.include_router(payments.router)
app.include_router(reports.router)

# Note: better-auth will be integrated on the frontend side
# Backend will validate sessions via cookies/JWT tokens
# See app/api/routes/auth.py for session validation endpoints


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Organizador Financeiro API",
        "version": "0.1.0",
        "docs": "/docs",
    }
