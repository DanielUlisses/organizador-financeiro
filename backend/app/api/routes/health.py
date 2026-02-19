"""Health check endpoints"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db import get_db

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health():
    """Basic health check - returns 200 if service is alive"""
    return {"status": "ok", "service": "organizador-financeiro-backend"}


@router.get("/ready")
async def ready(db: Session = Depends(get_db)):
    """Readiness check - returns 200 if service and database are ready"""
    try:
        # Test database connection
        db.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "service": "organizador-financeiro-backend",
            "database": "connected",
        }
    except Exception as e:
        return {
            "status": "not_ready",
            "service": "organizador-financeiro-backend",
            "database": "disconnected",
            "error": str(e),
        }, 503
